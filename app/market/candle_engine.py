"""
Candle aggregation engine — current polling implementation.

Takes the latest tick from `market_state` and folds it into per-timeframe OHLC
candles. Broadcasts the recent candle window to all WebSocket clients.

Audit fixes in this revision (Phase 2.0):
- 12.6 Stripped two earlier generations of this module (~230 lines of dead
  commented code).

Outstanding (deferred):
- 4.2 (Phase 2.5): this engine currently broadcasts the *entire* last-100
  candle array per symbol × per timeframe every second. That's ~3.3K candle
  objects/sec on the wire per connected client. Phase 2.5 reshapes this:
  - subscribe to `PriceTicked` events from the event bus
  - emit `CandleActive` on every tick that mutates an active candle
  - emit `CandleClosed` only on candle-close boundaries
  Frontend then uses `series.update(activeCandle)` for incremental render.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from typing import Dict

from app.core.logger import get_logger
from app.market.market_state import market_state
from app.websocket.manager import manager

logger = get_logger("candle_engine")

# Timeframe label -> bucket size in seconds.
TIMEFRAMES = {
    "1m":   60,
    "5m":   300,
    "15m":  900,
}

SYMBOLS = [
    "AAPL", "TSLA", "MSFT", "NVDA", "AMZN",
    "GOOGL", "META", "NFLX", "AMD", "INTC", "UBER",
]

# Active (open) candle per (symbol, timeframe). Mutated in-place until close.
_active: Dict[str, Dict[str, dict]] = defaultdict(lambda: defaultdict(dict))


def _bucket_start(ts: int, tf_seconds: int) -> int:
    return ts - (ts % tf_seconds)


def _update_candle(symbol: str, timeframe: str, price: float, ts: int) -> None:
    """
    Fold `price` at time `ts` into the active candle for (symbol, timeframe).
    When the bucket rolls over, the prior candle is persisted to market_state
    and a new active candle begins.
    """
    tf_seconds = TIMEFRAMES[timeframe]
    bucket = _bucket_start(ts, tf_seconds)
    candle = _active[symbol][timeframe]

    if not candle or candle.get("time") != bucket:
        # Bucket boundary crossed: finalize prior candle (if any) and start new.
        if candle:
            market_state.add_candle(symbol, timeframe, candle.copy())
        _active[symbol][timeframe] = {
            "time":  bucket,
            "open":  price,
            "high":  price,
            "low":   price,
            "close": price,
        }
    else:
        candle["high"]  = max(candle["high"], price)
        candle["low"]   = min(candle["low"],  price)
        candle["close"] = price


async def start_candle_engine() -> None:
    """Background loop: fold ticks into candles, broadcast snapshots."""
    logger.info("[candle] engine started (symbols=%d, timeframes=%s)",
                len(SYMBOLS), list(TIMEFRAMES.keys()))

    while True:
        try:
            now_int = int(time.time())

            for symbol in SYMBOLS:
                price = market_state.get_price(symbol)
                if price is None:
                    continue

                # Update candles for every timeframe BEFORE broadcasting.
                for tf in TIMEFRAMES:
                    _update_candle(symbol, tf, price, now_int)

                # Broadcast — Phase 2.5 swaps this for incremental events.
                for tf in TIMEFRAMES:
                    candles = market_state.get_candles(symbol, tf)
                    if candles:
                        await manager.broadcast({
                            "type":      "candle_update",
                            "symbol":    symbol,
                            "timeframe": tf,
                            "candles":   candles[-100:],
                        })

        except asyncio.CancelledError:
            logger.info("[candle] cancelled")
            raise
        except Exception:
            logger.exception("[candle] engine loop error")

        await asyncio.sleep(1)
