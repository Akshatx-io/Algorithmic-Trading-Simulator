"""
Equity engine — total equity, realized/unrealized PnL, equity curve.

Phase 2.2:
- Position.avg_price (renamed from average_price, audit 3.2).
- EquityHistory.total_equity is the canonical column.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.market.market_state import market_state
from app.models.equity_history import EquityHistory
from app.models.position import Position
from app.models.trade import Trade
from app.models.user import User


def calculate_total_equity(db: Session, user_id: int) -> float:
    """Real-time equity = cash balance + mark-to-market positions."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return 0.0

        balance = float(user.balance or 0)
        positions = db.query(Position).filter(Position.user_id == user_id).all()
        prices = market_state.get_all_prices() or {}

        total = balance
        for pos in positions:
            price = prices.get(pos.symbol)
            if price is None or price <= 0:
                price = float(pos.avg_price or 0)
            total += price * float(pos.quantity or 0)

        return float(total)

    except Exception:
        logger.exception("[equity] total equity calc failed user=%s", user_id)
        return 0.0


def calculate_realized_pnl(db: Session, user_id: int) -> float:
    try:
        pnl = (
            db.query(func.sum(Trade.realized_pnl))
            .filter(Trade.user_id == user_id)
            .scalar()
        )
        return float(pnl or 0.0)
    except Exception:
        logger.exception("[equity] realized PnL calc failed user=%s", user_id)
        return 0.0


def calculate_unrealized_pnl(db: Session, user_id: int) -> float:
    try:
        positions = db.query(Position).filter(Position.user_id == user_id).all()
        pnl = 0.0
        for pos in positions:
            price = market_state.get_price(pos.symbol)
            if price is None:
                continue
            pnl += (price - float(pos.avg_price or 0)) * float(pos.quantity or 0)
        return pnl
    except Exception:
        logger.exception("[equity] unrealized PnL calc failed user=%s", user_id)
        return 0.0


def get_equity_curve(db: Session, user_id: int):
    try:
        history = (
            db.query(EquityHistory)
            .filter(EquityHistory.user_id == user_id)
            .order_by(EquityHistory.timestamp.asc())
            .all()
        )
        return [
            {"time": int(h.timestamp.timestamp()), "equity": float(h.total_equity)}
            for h in history
        ]
    except Exception:
        logger.exception("[equity] curve fetch failed user=%s", user_id)
        return []
