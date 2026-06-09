"""
Demo account seeding.

Builds a curated, populated paper-trading account (``demo``) so a visitor can
explore a live-looking dashboard with a single click: open positions carrying
unrealized P&L, a trade history with realized gains, and a rising equity curve.

* Idempotent  -- each call clears the demo account and re-inserts the same
  curated snapshot, so every demo session starts from an identical, polished
  state regardless of what previous visitors did.
* Deterministic -- positions and the equity curve are fixed (seeded RNG), so
  the dashboard looks the same every time.
* Process-locked -- a module lock serializes seeds (the service runs a single
  worker), so concurrent ``/auth/demo`` clicks can never interleave.

Prices come from the synthetic market (``price_at``), so unrealized P&L is
consistent with what the live dashboard shows.
"""

from __future__ import annotations

import math
import random
import threading
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.core.database import SessionLocal
from app.core.logger import get_logger
from app.market.fetch_stock_data import price_at
from app.models.equity_history import EquityHistory
from app.models.position import Position
from app.models.trade import Trade
from app.models.user import User

logger = get_logger("seed.demo")

# Public on purpose -- the demo account is sandboxed and reset on every use.
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo-explorer-2025"
DEMO_EMAIL = "demo@algo-trading-simulator.app"

_START_CAPITAL = 100_000.0
_FEE = 1.0  # flat per-trade fee

# Open positions, bought below current synthetic levels -> mostly green.
# symbol -> (quantity, avg_buy_price)
_OPEN: dict[str, tuple[float, float]] = {
    "AAPL": (40, 205.00),
    "NVDA": (120, 118.00),
    "MSFT": (15, 410.00),
    "AMZN": (30, 200.00),
    "TSLA": (25, 360.00),  # deliberate small loser, for realism
}

# Closed round-trips (BUY then SELL) -> realized P&L + trade history.
# symbol -> (quantity, buy_price, sell_price)
_CLOSED: dict[str, tuple[float, float, float]] = {
    "GOOGL": (50, 180.00, 195.00),
    "AMD": (80, 150.00, 165.00),
}

_seed_lock = threading.Lock()


def _build_trades(now: datetime) -> tuple[list[Trade], float, float]:
    """Return (trades, realized_pnl, open_cost) for the curated history."""
    trades: list[Trade] = []
    realized = 0.0
    open_cost = 0.0

    day = 45
    for sym, (qty, buy, sell) in _CLOSED.items():
        pnl = (sell - buy) * qty - 2 * _FEE
        realized += pnl
        trades.append(Trade(symbol=sym, action="BUY", quantity=qty, price=buy,
                            fees=_FEE, realized_pnl=None,
                            timestamp=now - timedelta(days=day, hours=2)))
        trades.append(Trade(symbol=sym, action="SELL", quantity=qty, price=sell,
                            fees=_FEE, realized_pnl=round(pnl, 2),
                            timestamp=now - timedelta(days=day - 6)))
        day -= 6

    day = 30
    for sym, (qty, avg) in _OPEN.items():
        open_cost += qty * avg + _FEE
        trades.append(Trade(symbol=sym, action="BUY", quantity=qty, price=avg,
                            fees=_FEE, realized_pnl=None,
                            timestamp=now - timedelta(days=day, hours=1)))
        day -= 4

    return trades, realized, open_cost


def _build_equity_curve(now: datetime, start: float, end: float,
                        points: int = 60, days: int = 30) -> list[tuple[datetime, float]]:
    """Deterministic curve from exactly `start` to exactly `end`, with mid-path
    volatility that tapers to zero at both endpoints."""
    rng = random.Random(42)
    out: list[tuple[datetime, float]] = []
    for i in range(points):
        frac = i / (points - 1)
        base = start + (end - start) * frac
        envelope = math.sin(math.pi * frac)            # 0 at ends, 1 mid
        noise = (rng.random() - 0.5) * start * 0.02 * envelope
        ts = now - timedelta(days=days) + timedelta(days=days * frac)
        out.append((ts, round(base + noise, 2)))
    out[-1] = (now, round(end, 2))                     # pin to live equity
    return out


def seed_demo_account(db: Session | None = None) -> int:
    """Create/refresh the demo account. Returns the demo user id.

    Pass `db` to reuse a session (tests); otherwise a private session is used.
    """
    with _seed_lock:
        own = db is None
        session = db or SessionLocal()
        try:
            user = session.query(User).filter(User.username == DEMO_USERNAME).first()
            if user is None:
                user = User(username=DEMO_USERNAME, email=DEMO_EMAIL,
                            hashed_password=hash_password(DEMO_PASSWORD))
                session.add(user)
                session.flush()
            else:
                user.hashed_password = hash_password(DEMO_PASSWORD)

            # wipe prior demo state
            for model in (Position, Trade, EquityHistory):
                session.query(model).filter(model.user_id == user.id).delete(
                    synchronize_session=False)

            now = datetime.utcnow()
            trades, realized, open_cost = _build_trades(now)
            for t in trades:
                t.user_id = user.id
                session.add(t)

            market_value = 0.0
            for sym, (qty, avg) in _OPEN.items():
                session.add(Position(user_id=user.id, symbol=sym, quantity=qty, avg_price=avg))
                market_value += qty * price_at(sym)

            cash = _START_CAPITAL - open_cost + realized
            user.balance = round(cash, 2)
            end_equity = cash + market_value

            for ts, val in _build_equity_curve(now, _START_CAPITAL, end_equity):
                session.add(EquityHistory(user_id=user.id, total_equity=val, timestamp=ts))

            session.commit()
            logger.info("[seed] demo ready (id=%s, equity=%.0f, positions=%d, trades=%d)",
                        user.id, end_equity, len(_OPEN), len(trades))
            return user.id
        except Exception:
            session.rollback()
            logger.exception("[seed] demo seeding failed")
            raise
        finally:
            if own:
                session.close()
