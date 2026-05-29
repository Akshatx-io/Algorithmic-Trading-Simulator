"""
PnL computation — current FIFO implementation.

Owns:
- Unrealized PnL across open positions, given current market prices.
- Realized PnL from trade history via FIFO lot matching.

Audit fixes in this revision (Phase 2.0):
- 3.4 Removed the duplicate class-based `PnLEngine` implementation that
  referenced fields not present on the current `Position` model
  (`pos.avg_price`, `pos.updated_at`, `pos.signal`, `pos.current_price`).
  The class would have crashed on first call. Only the functional FIFO path
  remains.
- 12.6 Stripped ~430 lines of commented-out previous implementations.

Outstanding (deferred):
- 5.3  `get_safe_price` still falls back to a synchronous yfinance call when
       market_state is cold. Phase 2.4 replaces this with a "stale price"
       marker that the frontend renders explicitly — yfinance must never
       block the portfolio request path.
- Phase 2.4 will move this module into `app/services/portfolio_service.py`
  and reshape returns as domain entities rather than dicts.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Union

from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.market.fetch_stock_data import fetch_stock_data
from app.market.market_state import market_state
from app.models.position import Position
from app.models.trade import Trade

logger = get_logger("pnl_engine")

# Quantize key — 4 decimal places is enough for unit equities; phase 2.4
# tightens this to currency-2dp at the API boundary while keeping 8dp internally.
_QUANTUM = Decimal("0.0001")


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def safe_decimal(value: Any) -> Optional[Decimal]:
    """
    Coerce a number-like value into a quantized Decimal.

    Returns None for strings that aren't numeric (defensive: protects against
    "BUY"/"SELL" being passed by mistake).
    """
    try:
        if value is None:
            return None
        if isinstance(value, (int, float, Decimal)):
            return Decimal(str(value)).quantize(_QUANTUM, rounding=ROUND_HALF_UP)
        return None
    except (InvalidOperation, TypeError):
        return None


def get_safe_price(symbol: str) -> Optional[Decimal]:
    """
    Return latest known price for `symbol` as a Decimal.

    Phase 2.4 TODO (audit 5.3): never call the provider synchronously from
    the request path. Until then, this is a known latency footgun on cold
    cache.
    """
    try:
        price = market_state.get_price(symbol)
        if price is None:
            data = fetch_stock_data(symbol)
            if data is None or data.empty or "close" not in data.columns:
                return None
            price = float(data["close"].iloc[-1])
        return safe_decimal(price)
    except Exception:
        logger.exception("[pnl] price lookup failed for %s", symbol)
        return None


# -----------------------------------------------------------------------------
# Unrealized PnL (per-position breakdown)
# -----------------------------------------------------------------------------
def calculate_unrealized_pnl(db: Session, user_id: int) -> List[Dict[str, Any]]:
    positions = db.query(Position).filter(Position.user_id == user_id).all()
    results: List[Dict[str, Any]] = []

    for pos in positions:
        try:
            current_price = get_safe_price(pos.symbol)
            avg_price     = safe_decimal(pos.avg_price)
            quantity      = safe_decimal(pos.quantity)

            if current_price is None or avg_price is None or quantity is None:
                logger.warning("[pnl] skipping %s (insufficient data)", pos.symbol)
                continue

            unrealized = (current_price - avg_price) * quantity
            signal = market_state.get_signal(pos.symbol)

            results.append({
                "symbol":         pos.symbol,
                "quantity":       float(quantity),
                "avg_price":      float(avg_price),
                "current_price":  float(current_price),
                "market_value":   float(quantity * current_price),
                "unrealized_pnl": float(unrealized),
                "signal":         signal,
            })
        except Exception:
            logger.exception("[pnl] unrealized calc failed for %s", pos.symbol)

    return results


# -----------------------------------------------------------------------------
# Realized PnL (FIFO lot matching)
# -----------------------------------------------------------------------------
def calculate_realized_pnl(db: Session, user_id: int) -> float:
    """
    FIFO realized PnL across the user's full trade history.

    Each BUY appends a lot. Each SELL consumes lots in order, accumulating
    (sell_price - lot_price) × matched_qty. We deliberately do NOT cross-lot
    by symbol — symbol is the matching key (you can't sell AAPL out of an
    MSFT lot).
    """
    trades = (
        db.query(Trade)
        .filter(Trade.user_id == user_id)
        .order_by(Trade.id.asc())
        .all()
    )

    pnl = Decimal("0.0000")
    open_lots: Dict[str, List[Dict[str, Decimal]]] = {}

    for trade in trades:
        symbol = trade.symbol
        qty   = safe_decimal(trade.quantity)
        price = safe_decimal(trade.price)
        if qty is None or price is None:
            logger.warning("[pnl] skipping malformed trade id=%s", trade.id)
            continue

        if trade.action == "BUY":
            open_lots.setdefault(symbol, []).append({"qty": qty, "price": price})

        elif trade.action == "SELL":
            remaining = qty
            lots = open_lots.get(symbol, [])
            while remaining > 0 and lots:
                lot = lots[0]
                matched = min(remaining, lot["qty"])
                pnl += (price - lot["price"]) * matched
                lot["qty"] -= matched
                remaining -= matched
                if lot["qty"] == 0:
                    lots.pop(0)

    return float(pnl)


# -----------------------------------------------------------------------------
# Aggregate
# -----------------------------------------------------------------------------
def get_total_pnl(db: Session, user_id: int) -> Dict[str, Union[str, list, dict]]:
    unrealized_positions = calculate_unrealized_pnl(db, user_id)
    realized_pnl         = calculate_realized_pnl(db, user_id)
    total_unrealized     = sum(p["unrealized_pnl"] for p in unrealized_positions)

    return {
        "status":    "success",
        "positions": unrealized_positions,
        "summary": {
            "realized_pnl":   realized_pnl,
            "unrealized_pnl": total_unrealized,
            "total_pnl":      total_unrealized + realized_pnl,
        },
    }
