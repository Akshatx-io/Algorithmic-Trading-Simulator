"""
Market data engine — current polling implementation.

A background async loop that fetches latest quotes for a configured symbol
list, updates `market_state`, and broadcasts batch updates to WebSocket
clients.

Audit fixes in this revision (Phase 2.0):
- 12.6 Stripped two earlier generations of this module (~200 lines of dead
  commented code).
- Removed the unused `BATCH_BROADCAST_INTERVAL` constant.

Outstanding (deferred):
- 4.2 / 4.6 (Phase 2.5): replace the direct `manager.broadcast(...)` call with
  an `await bus.emit(PriceTicked(...))`. The WebSocket subscriber on the bus
  becomes the only broadcaster; the candle and stream engines subscribe to
  the same events instead of running their own polling loops.
- 5.5 (Phase 2.4): the current 2-second fetch cadence × 11 symbols will hit
  yfinance rate limits. Either stagger fetches, lengthen the cadence, or
  switch the default provider to the synthetic generator for demo mode.
"""

from __future__ import annotations

import asyncio
import math
import time
from typing import Optional

from app.core.logger import get_logger
from app.market.fetch_stock_data import fetch_stock_data
from app.market.market_state import market_state
from app.websocket.manager import manager

logger = get_logger("market_data_engine")

# Symbols followed by the engine. Phase 3.3 makes this user-configurable.
SYMBOLS = [
    "AAPL", "TSLA", "MSFT", "NVDA", "AMZN",
    "GOOGL", "META", "NFLX", "AMD", "INTC", "UBER",
]

# Time between full polling rounds (in seconds).
FETCH_INTERVAL = 2


def extract_price(df) -> Optional[float]:
    """
    Pull a finite scalar `close` out of an arbitrary provider dataframe.

    Yahoo's response shapes change between versions (sometimes Series,
    sometimes 2D for multi-symbol requests, sometimes a MultiIndex column),
    so we walk down to a scalar defensively.
    """
    try:
        if df is None or df.empty:
            return None

        col = "close" if "close" in df.columns else "Close"
        if col not in df.columns:
            return None

        value = df[col].iloc[-1]

        # Possible shapes: scalar, numpy scalar, pandas Series, iterable.
        if hasattr(value, "iloc"):
            if len(value) == 0:
                return None
            value = value.iloc[-1]
        elif hasattr(value, "__iter__") and not isinstance(value, (str, bytes)):
            seq = list(value)
            if not seq:
                return None
            value = seq[-1]

        if hasattr(value, "item"):
            value = value.item()

        price = float(value)
        if not math.isfinite(price) or price <= 0:
            return None
        return price

    except Exception:
        logger.exception("[market_data] price extraction failed")
        return None


async def process_symbol(symbol: str) -> Optional[dict]:
    """Fetch one symbol's latest price, update state, return an update record."""
    try:
        df = await asyncio.to_thread(fetch_stock_data, symbol)
        price = extract_price(df)
        if price is None:
            logger.warning("[market_data] invalid price for %s", symbol)
            return None

        ts = time.time()
        market_state.update_price(symbol, price, ts)
        return {"symbol": symbol, "price": price, "timestamp": ts}

    except Exception:
        logger.exception("[market_data] error processing %s", symbol)
        return None


async def start_market_data_engine() -> None:
    """Background loop: fetch every symbol, broadcast batch, sleep, repeat."""
    logger.info("[market_data] engine started (symbols=%d, interval=%ss)",
                len(SYMBOLS), FETCH_INTERVAL)

    while True:
        try:
            results = await asyncio.gather(
                *(process_symbol(s) for s in SYMBOLS),
                return_exceptions=True,
            )
            updates = [r for r in results if isinstance(r, dict)]

            if updates:
                await manager.broadcast({"type": "market_batch", "payload": updates})

        except asyncio.CancelledError:
            logger.info("[market_data] cancelled")
            raise
        except Exception:
            logger.exception("[market_data] engine loop error")

        await asyncio.sleep(FETCH_INTERVAL)
