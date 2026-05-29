"""
Pre-trade risk gate.

Phase 2.2 changes:
- Position.avg_price (audit 3.2).
- Stripped ~95 lines of commented prior generation (audit 12.6).

Outstanding (Phase 2.4):
- Replace boolean return with `RiskAssessment` carrying structured violations.
- Concentration check + leverage check.
- Per-user limits (from risk_profiles table) instead of module constants.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logger import logger
from app.models.position import Position
from app.risk.daily_loss_engine import check_daily_loss_limit

# TODO Phase 2.4: read from risk_profiles per user.
MAX_POSITION_PER_STOCK = 100
MAX_TOTAL_EXPOSURE = 100_000.0


def check_risk_limits(
    db: Session,
    user_id: int,
    symbol: str,
    action: str,
    quantity: float,
    price: float,
) -> bool:
    try:
        if not check_daily_loss_limit(db, user_id):
            logger.warning("[risk] daily loss exceeded user=%s", user_id)
            return False

        if quantity <= 0 or price <= 0:
            return False

        position = (
            db.query(Position)
            .filter(Position.user_id == user_id, Position.symbol == symbol)
            .with_for_update()
            .first()
        )
        current_qty = float(position.quantity) if position else 0.0

        if action == "BUY":
            if current_qty + quantity > MAX_POSITION_PER_STOCK:
                return False
        elif action == "SELL":
            if quantity > current_qty:
                return False

        total_exposure = (
            db.query(func.sum(Position.quantity * Position.avg_price))
            .filter(Position.user_id == user_id)
            .scalar()
            or 0.0
        )
        if action == "BUY":
            if float(total_exposure) + quantity * price > MAX_TOTAL_EXPOSURE:
                return False

        return True

    except Exception:
        logger.exception("[risk] engine error user=%s symbol=%s", user_id, symbol)
        return False
