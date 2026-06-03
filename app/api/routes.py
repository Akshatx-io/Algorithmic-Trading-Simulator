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
from typing import Optional

from fastapi import (
    APIRouter,
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
from app.quant.signal_engine import signal_engine
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

    provider_price: Optional[float] = None
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
    token: Optional[str] = Query(default=None),
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
