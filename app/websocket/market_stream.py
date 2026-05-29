"""
Market stream broadcaster — periodic full-state snapshot.

Phase 2.5 collapses this into the event-bus design and deletes the module.
Until then, it runs alongside the market_data_engine and candle_engine,
sending a full price + signal + last-100-candles snapshot once a second.

Audit fixes in this revision (Phase 2.0):
- 12.6 Stripped the prior commented generation of this module.

Outstanding (Phase 2.5):
- 4.2 Redundant with market_data_engine + candle_engine broadcasts. All three
  will be replaced by an event-bus + topic-based subscription model. This
  module disappears entirely in Phase 2.5.
"""

from __future__ import annotations

import asyncio
import time

from app.core.logger import get_logger
from app.market.market_state import market_state
from app.websocket.manager import manager

logger = get_logger("market_stream")

STREAM_INTERVAL = 1  # seconds between snapshots


def _build_payload() -> dict:
    prices  = market_state.get_all_prices()
    signals = market_state.get_all_signals()

    data = [
        {
            "symbol":    symbol,
            "price":     price,
            "signal":    signals.get(symbol, "HOLD"),
            "candles":   market_state.get_candles(symbol, "1m")[-100:] or [],
            "timestamp": time.time(),
        }
        for symbol, price in prices.items()
    ]

    return {"type": "market_update", "data": data}


async def start_market_stream() -> None:
    logger.info("[market_stream] started (interval=%ss)", STREAM_INTERVAL)
    while True:
        try:
            await manager.broadcast(_build_payload())
        except asyncio.CancelledError:
            logger.info("[market_stream] cancelled")
            raise
        except Exception:
            logger.exception("[market_stream] loop error")
        await asyncio.sleep(STREAM_INTERVAL)
