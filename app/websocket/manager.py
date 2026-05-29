"""
WebSocket connection manager — flat fan-out.

Maintains the set of live client connections and broadcasts JSON messages to
all of them concurrently. Slow consumers are removed on send failure.

Audit fixes in this revision (Phase 2.0):
- 12.6 Stripped the previous List-based generation of this module (~55 lines
  of dead commented code).

Outstanding (Phase 2.5):
- 4.5 No per-user / per-topic addressing. Every broadcast goes to every
  client — fine for a single-tenant demo, not fine for multi-user privacy.
- 5.9 Broadcast has no per-connection timeout / backpressure. One slow
  consumer can delay the whole loop. Phase 2.5 introduces a per-send
  timeout and a "degraded → disconnect" lifecycle.
"""

from __future__ import annotations

import asyncio
from typing import Set

from fastapi import WebSocket

from app.core.logger import get_logger

logger = get_logger("ws_manager")


class ConnectionManager:
    """Thread-safe registry of active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ connect
    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        logger.info("[ws_manager] connected (total=%d)", len(self._connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)
        logger.info("[ws_manager] disconnected (total=%d)", len(self._connections))

    # ----------------------------------------------------------------- broadcast
    async def _safe_send(self, websocket: WebSocket, message: dict) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            # Dead connection — drop it. Logged at debug to avoid spam during
            # routine reconnects.
            logger.debug("[ws_manager] send failed, dropping connection")
            await self.disconnect(websocket)

    async def broadcast(self, message: dict) -> None:
        async with self._lock:
            connections = list(self._connections)
        if not connections:
            return

        await asyncio.gather(
            *(self._safe_send(ws, message) for ws in connections),
            return_exceptions=True,
        )

    # --------------------------------------------------------------- introspection
    def connection_count(self) -> int:
        return len(self._connections)


# Module-level singleton — every emitter imports `manager` from here.
manager = ConnectionManager()
