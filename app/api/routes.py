"""
API routes — current monolithic router.

This file is a transitional artifact. The Phase 2.3 refactor splits it into
per-domain routers under `app/api/v1/{auth, portfolio, trading, market, signals,
analytics, ws, health}.py`. Do not add new endpoints here; add them in the
appropriate v1 module instead.

Audit fixes in this revision (Phase 2.0):
- 3.3 Deleted ~960 lines of commented-out previous-generation router code.
- 12.2/12.6 Emoji-theater docstrings and dead "🔥 ELITE" comments removed.

Outstanding (deferred to Phase 2.3):
- Split into per-domain routers.
- 12.5 Standardize sync/async usage per endpoint.
- 12.4 Adopt consistent response envelope {data, meta, error}.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta

from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.jwt_handler import verify_token
from app.core.config import settings
from app.core.database import get_db
from app.core.logger import get_logger
from app.execution.execution_engine import execute_trade
from app.market.fetch_stock_data import fetch_stock_data
from app.market.market_state import market_state
from app.models.equity_history import EquityHistory
from app.models.position import Position
from app.models.trade import Trade
from app.models.user import User
from app.portfolio.equity_engine import get_equity_curve
from app.portfolio.equity_snapshot_service import record_equity_snapshot
from app.portfolio.performance_engine import calculate_performance_metrics
from app.portfolio.pnl_engine import get_total_pnl
from app.quant.backtester import run_backtest
from app.quant.optimizer import optimize_portfolio
from app.quant.option_pricer import price_option
from app.quant.regime import analyze_regime
from app.quant.return_predictor import predict_returns
from app.quant.sentiment import analyze_sentiment
from app.quant.signal_engine import signal_engine
from app.quant.vol_surface import build_vol_forecast, build_vol_surface
from app.risk.risk_engine import check_risk_limits
from app.schemas.trade import ExecuteTradeRequest, TradeResponse
from app.websocket.manager import manager

logger = get_logger("api")
ws_logger = get_logger("websocket")
router = APIRouter()


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@router.get("/health")
async def health():
    return {
        "status":  "healthy",
        "version": settings.app_version,
        "time":    datetime.utcnow().isoformat(),
    }


# -----------------------------------------------------------------------------
# Auth — moved to app/api/v1/auth.py in Phase 2.1.
# Refer all new auth work to that module.
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# Portfolio
# -----------------------------------------------------------------------------
@router.get("/portfolio")
def portfolio(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_total_pnl(db, user.id)


@router.post("/account/reset")
def reset_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reset the caller's paper-trading account to a clean slate:
    delete all positions, trades, and equity history, and restore the
    starting cash balance. Idempotent.
    """
    db.query(Position).filter(Position.user_id == user.id).delete(synchronize_session=False)
    db.query(Trade).filter(Trade.user_id == user.id).delete(synchronize_session=False)
    db.query(EquityHistory).filter(EquityHistory.user_id == user.id).delete(synchronize_session=False)

    user_row = db.query(User).filter(User.id == user.id).first()
    if user_row is not None:
        user_row.balance = float(settings.default_user_balance)
    db.commit()

    logger.info("[account] reset for user=%s -> balance=%.2f", user.id, settings.default_user_balance)
    return {
        "status": "success",
        "message": "Account reset to starting balance.",
        "balance": float(settings.default_user_balance),
    }


@router.get("/portfolio/history")
def portfolio_history(
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    history = (
        db.query(EquityHistory)
        .filter(EquityHistory.user_id == user.id, EquityHistory.timestamp >= cutoff)
        .order_by(EquityHistory.timestamp)
        .all()
    )
    return {
        "equity_curve": [
            {"time": h.timestamp.isoformat(), "equity": h.total_equity}
            for h in history
        ]
    }


# -----------------------------------------------------------------------------
# Performance / Analytics
# -----------------------------------------------------------------------------
@router.get("/performance")
def performance(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    metrics = calculate_performance_metrics(db, user.id)
    equity_curve = get_equity_curve(db, user.id)
    return {
        "status":       "success",
        "metrics":      metrics,
        "equity_curve": equity_curve or [],
    }


# -----------------------------------------------------------------------------
# Trading
# -----------------------------------------------------------------------------
@router.post("/trades", response_model=TradeResponse)
def trade(
    request: ExecuteTradeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if request.quantity <= 0:
        raise HTTPException(status_code=400, detail="Invalid quantity")

    price = market_state.get_price(request.symbol)
    if price is None or price <= 0:
        raise HTTPException(status_code=400, detail="Invalid market price")

    if not check_risk_limits(
        db,
        user.id,
        request.symbol,
        request.action,
        request.quantity,
        price,
    ):
        raise HTTPException(status_code=400, detail="Risk limit exceeded")

    result = execute_trade(db, user.id, request)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Trade failed"))

    # Equity snapshot is best-effort: a failure here must not fail the trade
    try:
        record_equity_snapshot(db, user.id)
        db.commit()
    except Exception:
        logger.exception("[trade] equity snapshot failed for user %s", user.id)

    return result


@router.get("/trades")
def trades(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trades = (
        db.query(Trade)
        .filter(Trade.user_id == user.id)
        .order_by(Trade.timestamp.desc())
        .all()
    )
    return {
        "trades": [
            {
                "id":            t.id,
                "symbol":        t.symbol,
                "action":        t.action,
                "quantity":      t.quantity,
                "price":         t.price,
                "timestamp":     t.timestamp,
                "realized_pnl":  t.realized_pnl,
            }
            for t in trades
        ]
    }


# -----------------------------------------------------------------------------
# Market data
# -----------------------------------------------------------------------------
@router.get("/market")
def market():
    return {
        "prices":  market_state.get_all_prices(),
        "signals": market_state.get_all_signals(),
    }


@router.get("/market/{symbol}")
def market_symbol(symbol: str):
    """
    Return the latest price for `symbol`, with provider fallback if the
    in-memory state is stale or divergent.

    Phase 2.4 target: stop calling the provider synchronously from the
    request path. The market_feed engine should keep market_state warm
    enough that this endpoint never hits yfinance.
    """
    symbol = symbol.upper()
    price, ts = market_state.get_price_with_time(symbol)
    now = time.time()
    state_stale = (ts is None) or ((now - float(ts)) > 5.0)

    provider_price: float | None = None
    try:
        df = fetch_stock_data(symbol, interval="1m")
        if df is not None and not df.empty and "close" in df.columns:
            provider_price = float(df["close"].iloc[-1])
    except Exception:
        provider_price = None

    if provider_price is not None:
        if price is None:
            price = provider_price
        else:
            try:
                divergence = abs(float(price) - provider_price) / max(provider_price, 1e-9)
            except Exception:
                divergence = 1.0
            if state_stale or divergence > 0.15:
                price = provider_price
        market_state.update_price(symbol, float(price), now)

    if price is None:
        raise HTTPException(status_code=404, detail="Symbol not found")

    return {"symbol": symbol, "price": float(price)}


@router.get("/candles/{symbol}")
def candles(symbol: str, timeframe: str = Query(default="1m")):
    """Historical candles. Frontend chart fetches this once on mount; live
    updates arrive via the WebSocket candle topic in Phase 2.5."""
    symbol = symbol.upper()
    interval_map = {"1m": "1m", "5m": "5m", "15m": "15m"}
    interval = interval_map.get(timeframe, "1m")

    try:
        df = fetch_stock_data(symbol, interval=interval)
        if df is not None and not df.empty:
            candles_data = [
                {
                    "time":  int(ts.timestamp()),
                    "open":  float(row["open"]),
                    "high":  float(row["high"]),
                    "low":   float(row["low"]),
                    "close": float(row["close"]),
                }
                for ts, row in df.tail(220).iterrows()
            ]
            if candles_data:
                return {"symbol": symbol, "candles": candles_data}
    except Exception:
        logger.exception("[candles] provider fetch failed for %s", symbol)

    # Fallback: in-memory stream candles
    return {
        "symbol":  symbol,
        "candles": market_state.get_candles(symbol, "1m")[-100:],
    }


# -----------------------------------------------------------------------------
# Signals
# -----------------------------------------------------------------------------
@router.get("/signals/{symbol}")
def get_signal(symbol: str):
    result = signal_engine.generate(symbol.upper())
    if not result:
        return {
            "symbol":       symbol.upper(),
            "signal":       "HOLD",
            "risk_metrics": {},
            "confidence":   0,
            "factors":      {},
        }
    return result.to_dict()


@router.get("/signals")
def all_signals():
    return {"signals": list(signal_engine.get_all().values())}


# -----------------------------------------------------------------------------
# Market Regime Detection (Track C)
# -----------------------------------------------------------------------------
@router.get("/regime/{symbol}")
def market_regime(symbol: str, interval: str = Query(default="1d")):
    """K-Means market-regime classification (Bull / Bear / Sideways) over the
    symbol's price history, with a per-regime risk profile and transition
    matrix. Deterministic for a given input series."""
    return analyze_regime(symbol, interval=interval)


# -----------------------------------------------------------------------------
# Smart Portfolio Optimizer (Track C)
# -----------------------------------------------------------------------------
@router.get("/optimizer")
def portfolio_optimizer(
    symbols: str = Query(..., description="Comma-separated tickers, e.g. AAPL,MSFT,NVDA"),
    interval: str = Query(default="1d"),
    n: int = Query(default=6000, ge=500, le=20000),
):
    """Monte-Carlo efficient frontier over the given basket. Returns the
    portfolio cloud plus the max-Sharpe and min-volatility optima with their
    weights. Deterministic for a given basket."""
    syms = [s for s in symbols.split(",") if s.strip()]
    return optimize_portfolio(syms, interval=interval, n_portfolios=n)


# -----------------------------------------------------------------------------
# Monte Carlo Option Pricing Simulator (Track C)
# -----------------------------------------------------------------------------
@router.get("/options/montecarlo")
def option_montecarlo(
    s: float = Query(..., gt=0, description="Spot price S0"),
    k: float = Query(..., gt=0, description="Strike price K"),
    t: float = Query(1.0, gt=0, le=30, description="Time to expiry in years"),
    r: float = Query(0.05, ge=-1, le=1, description="Risk-free rate"),
    sigma: float = Query(0.2, gt=0, le=5, description="Annualized volatility"),
    kind: str = Query("call", pattern="^(call|put)$"),
    n: int = Query(20000, ge=1000, le=100000, description="Number of MC paths"),
):
    """Monte-Carlo price a European option under GBM, with a Black-Scholes
    benchmark, Greeks, sample price paths, and the terminal-price distribution."""
    return price_option(s, k, t, r, sigma, kind=kind, n_paths=n)


# -----------------------------------------------------------------------------
# Neural Volatility Surface (Track C)
# -----------------------------------------------------------------------------
@router.get("/vol/surface")
def volatility_surface(
    s: float = Query(100.0, gt=0, description="Spot price"),
    r: float = Query(0.04, ge=-1, le=1, description="Risk-free rate"),
    base_vol: float = Query(0.22, gt=0, le=3, description="ATM vol level"),
    skew: float = Query(-0.16, ge=-2, le=2, description="Smile skew (vol per log-moneyness)"),
    curv: float = Query(0.7, ge=0, le=5, description="Smile convexity"),
    term: float = Query(0.05, ge=-1, le=1, description="ATM term-structure slope"),
):
    """Implied-vol surface across strikes x expiries: parametric price surface
    inverted to IV via vectorized Newton-Raphson, then smoothed (neural fit)."""
    return build_vol_surface(s, r, base_vol, skew, curv, term)


@router.get("/vol/forecast")
def volatility_forecast(
    s: float = Query(100.0, gt=0),
    r: float = Query(0.04, ge=-1, le=1),
    base_vol: float = Query(0.22, gt=0, le=3),
    skew: float = Query(-0.16, ge=-2, le=2),
    curv: float = Query(0.7, ge=0, le=5),
    term: float = Query(0.05, ge=-1, le=1),
    horizon: int = Query(5, ge=1, le=30, description="Forecast horizon (trading days)"),
):
    """Forecast how the vol surface evolves h days out via mean-reverting AR(1)
    factor dynamics, with a 95% band and today-vs-forecast comparison."""
    return build_vol_forecast(s, r, base_vol, skew, curv, term, horizon)


# -----------------------------------------------------------------------------
# Strategy Backtester (Track C)
# -----------------------------------------------------------------------------
@router.get("/backtest")
def backtest(
    symbol: str = Query("AAPL"),
    strategy: str = Query("sma", pattern="^(sma|ema|rsi|momentum|bollinger)$"),
    fast: int = Query(20, ge=2, le=200),
    slow: int = Query(50, ge=3, le=400),
    rsi_period: int = Query(14, ge=2, le=60),
    rsi_buy: float = Query(30, ge=1, le=99),
    rsi_sell: float = Query(55, ge=1, le=99),
    cost_bps: float = Query(5, ge=0, le=100),
    years: int = Query(3, ge=1, le=10),
    initial: float = Query(100000, gt=0),
):
    """Backtest a rule-based strategy over deterministic history with transaction
    costs, returning equity vs buy-and-hold, drawdown, trade signals, and metrics."""
    return run_backtest(symbol, strategy, fast, slow, rsi_period, rsi_buy,
                        rsi_sell, cost_bps, years, initial)


# -----------------------------------------------------------------------------
# Stock Return Predictor (Track C)
# -----------------------------------------------------------------------------
@router.get("/predict")
def predict(
    symbol: str = Query("AAPL"),
    years: int = Query(4, ge=2, le=8),
    n_estimators: int = Query(80, ge=20, le=200),
    max_depth: int = Query(6, ge=2, le=12),
    cost_bps: float = Query(2.0, ge=0, le=100),
    mc_sims: int = Query(400, ge=50, le=1000),
):
    """Random-Forest next-day return prediction with out-of-sample metrics, a
    long/short backtest vs buy-and-hold, feature importances, and Monte Carlo
    bootstrap resampling of the strategy returns."""
    return predict_returns(symbol, years, n_estimators, max_depth, cost_bps, mc_sims)


# -----------------------------------------------------------------------------
# Earnings-Call Sentiment Analyzer (Track C)
# -----------------------------------------------------------------------------
@router.post("/sentiment/analyze")
def sentiment_analyze(payload: dict = Body(default={})):
    """Score earnings-call sentiment (LM-style financial NLP) and run an
    event-study backtest of sentiment vs post-earnings drift. Body: {symbol?, text?}."""
    return analyze_sentiment(payload.get("symbol", "AAPL"), payload.get("text"))


# -----------------------------------------------------------------------------
# WebSocket
#
# Audit findings outstanding (Phase 2.5):
# - 4.5 No per-user / per-topic addressing.
# - 4.2 Broadcast still uses three duplicate engines.
# - 7   No server-driven heartbeat with timeout.
# - 6.8 WS token reuses the long-lived access token (should be short-lived).
# -----------------------------------------------------------------------------
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(default=None),
):
    """JWT-authenticated WebSocket endpoint with basic ping/pong heartbeat."""

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = verify_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = payload.get("sub")
    await manager.connect(websocket)
    ws_logger.info("[ws] connected user=%s", user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                ws_logger.warning("[ws] invalid JSON from user=%s", user_id)
                continue

            msg_type = message.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})

            elif msg_type == "subscribe":
                channel = message.get("channel")
                ws_logger.info("[ws] subscribe user=%s channel=%s", user_id, channel)
                await websocket.send_json({"type": "subscribed", "channel": channel})

            else:
                ws_logger.warning("[ws] unknown message type=%r user=%s", msg_type, user_id)

    except WebSocketDisconnect:
        ws_logger.info("[ws] disconnected user=%s", user_id)
        await manager.disconnect(websocket)

    except Exception:
        ws_logger.exception("[ws] error user=%s", user_id)
        await manager.disconnect(websocket)
        try:
            await websocket.close()
        except Exception:
            pass
