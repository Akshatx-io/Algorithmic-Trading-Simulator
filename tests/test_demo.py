"""Demo-account seeding invariants."""
import pytest

from app.models.equity_history import EquityHistory
from app.models.position import Position
from app.models.trade import Trade
from app.models.user import User
from app.seed.demo import DEMO_USERNAME, seed_demo_account


@pytest.mark.integration
def test_seed_demo_is_populated_and_idempotent(sync_db):
    uid = seed_demo_account(sync_db)
    user = sync_db.query(User).filter(User.username == DEMO_USERNAME).first()
    assert user is not None and user.id == uid
    assert user.balance > 0

    def counts():
        return (
            sync_db.query(Position).filter(Position.user_id == uid).count(),
            sync_db.query(Trade).filter(Trade.user_id == uid).count(),
            sync_db.query(EquityHistory).filter(EquityHistory.user_id == uid).count(),
        )

    assert counts() == (5, 9, 60)
    # Re-seeding resets to the same curated snapshot, never duplicates.
    seed_demo_account(sync_db)
    assert counts() == (5, 9, 60)
