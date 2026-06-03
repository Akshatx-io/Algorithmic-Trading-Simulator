"""
Equity snapshot engine.

Periodically records an equity snapshot for every user with positions or a
non-default balance, so the equity curve is a *living* time series rather than
a couple of points written only at trade time. Mark-to-market uses the same
`market_state` prices the rest of the system sees, so the curve tracks the
synthetic (or live) market continuously.

Registered as a background task by `main.py` lifespan. Uses a synchronous DB
session inside `asyncio.to_thread` so it never blocks the event loop.
"""

from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("equity_snapshot_engine")


def _snapshot_all_users() -> int:
    """Record one snapshot per active user. Returns the count written."""
    from app.core.database import SessionLocal
    from app.models.user import User
    from app.portfolio.equity_snapshot_service import record_equity_snapshot

    db = SessionLocal()
    written = 0
    try:
        user_ids = [row[0] for row in db.query(User.id).all()]
        for uid in user_ids:
            try:
                record_equity_snapshot(db, uid)
                db.commit()
                written += 1
            except Exception:
                db.rollback()
                logger.exception("[equity_snapshot] failed for user=%s", uid)
        return written
    finally:
        db.close()


async def start_equity_snapshot_engine() -> None:
    interval = max(5, int(getattr(settings, "equity_snapshot_interval", 15)))
    logger.info("[equity_snapshot] engine started (interval=%ss)", interval)
    while True:
        try:
            await asyncio.to_thread(_snapshot_all_users)
        except asyncio.CancelledError:
            logger.info("[equity_snapshot] cancelled")
            raise
        except Exception:
            logger.exception("[equity_snapshot] loop error")
        await asyncio.sleep(interval)
