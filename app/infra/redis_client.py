"""
Async Redis client — process-wide singleton.

Phase 2.1 adopts Redis for the refresh-token store and the access-token
blocklist. Phase 2.4 will reuse the same client for the idempotency store.
Phase 2.5 reuses it again for pub/sub.

Connection lifecycle is owned by `main.py` lifespan:
    await init_redis()   # at startup, optional but useful for fail-fast
    await close_redis()  # at shutdown

All other modules just call `get_redis()` to get the live client.
"""

from __future__ import annotations

from typing import Optional

from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("redis")

_pool:   Optional[ConnectionPool] = None
_client: Optional[Redis] = None


def get_redis() -> Redis:
    """Return the process-wide async Redis client. Lazily initialized."""
    global _pool, _client
    if _client is not None:
        return _client

    if not settings.redis_url:
        raise RuntimeError(
            "REDIS_URL is not configured — set it in .env or via env var."
        )

    _pool = ConnectionPool.from_url(
        settings.redis_url,
        max_connections=20,
        decode_responses=True,
        # Health check interval so dead connections are pruned proactively.
        health_check_interval=30,
    )
    _client = Redis(connection_pool=_pool)
    logger.info("[redis] client initialized")
    return _client


async def init_redis() -> bool:
    """Optional startup probe: ensures we can talk to Redis before serving."""
    try:
        client = get_redis()
        pong = await client.ping()
        if pong:
            logger.info("[redis] ping ok")
            return True
        return False
    except Exception:
        logger.exception("[redis] init failed")
        return False


async def close_redis() -> None:
    """Cleanly tear down the pool on application shutdown."""
    global _client, _pool
    try:
        if _client is not None:
            await _client.aclose()
        if _pool is not None:
            await _pool.aclose()
    except Exception:
        logger.exception("[redis] close error")
    finally:
        _client = None
        _pool = None
        logger.info("[redis] closed")
