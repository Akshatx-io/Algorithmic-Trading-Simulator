"""
Equity snapshot writer.

Phase 2.2: uses EquityHistory.total_equity (the actual model column —
audit fix for prior code that wrote `equity_value` against a model that
didn't have it).
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.models.equity_history import EquityHistory

SNAPSHOT_COOLDOWN_SECONDS = 5  # rate-limit duplicate snapshots


def record_equity_snapshot(db: Session, user_id: int):
    """Persist a snapshot. Caller owns the commit (transaction boundary)."""
    try:
        # Lazy import — equity_engine imports from this file transitively.
        from app.portfolio.equity_engine import calculate_total_equity

        last = (
            db.query(EquityHistory)
            .filter(EquityHistory.user_id == user_id)
            .order_by(EquityHistory.timestamp.desc())
            .first()
        )

        now = datetime.utcnow()
        if last and (now - last.timestamp).total_seconds() < SNAPSHOT_COOLDOWN_SECONDS:
            return last.total_equity

        equity = calculate_total_equity(db, user_id)
        db.add(EquityHistory(user_id=user_id, total_equity=equity, timestamp=now))

        logger.info("[snapshot] user=%s equity=%.2f", user_id, equity)
        return equity

    except Exception:
        logger.exception("[snapshot] failed user=%s", user_id)
        return None
