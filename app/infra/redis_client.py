"""
Async Redis client — process-wide singleton.

Phase 2.1 adopts Redis for the refresh-token store and the access-token
blocklist. Phase 2.4 will reuse the same client for the idempotency store.
Phase 2.5 reuses it again for pub/sub.

Connection lifecycle is owned by `main.py` lifespan:
    await init_redis()   # at startup, optional but useful for fail-fast
    await close_redis()  # at shutdown

All other modules just call `get_redis()` to get the live client.

Local-dev fallback (Phase 2.3)
------------------------------
Running the full stack used to require a real Redis server (Docker). To make
the app runnable on a laptop with zero external infra, this module can fall
back to an in-process, Redis-API-compatible store (`fakeredis`):

- When `settings.use_fake_redis` is true, OR `settings.redis_url` is unset, the
  fake client is used directly.
- When a real Redis URL is configured but unreachable, `init_redis()` degrades
  to the fake client *in non-production environments* (production still
  fail-fasts — a missing token store there is a real outage, not a convenience
  problem).

`fakeredis` is process-local and non-persistent: tokens live only for the
lifetime of the process. That is exactly the right semantics for local dev and
CI, and never silently masks a production misconfiguration.
"""

from __future__ import annotations

from typing import Optional

from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("redis")

_pool:   Optional[ConnectionPool] = None
_client: Optional[Redis] = None
# Sticky flag: once we decide to use the in-memory client (either by config or
# by graceful degradation), every later get_redis() call must return the same
# fake client rather than retrying a dead TCP connection.
_use_fake: bool = False


def _build_fake_client() -> Redis:
    """Construct an in-memory, Redis-API-compatible async client."""
    try:
        from fakeredis import FakeAsyncRedis
    except ImportError as exc:  # pragma: no cover - import guard
        raise RuntimeError(
            "In-memory Redis fallback requested but 'fakeredis' is not "
            "installed. Install it with 'pip install fakeredis', or point "
            "REDIS_URL at a running Redis server."
        ) from exc
    logger.warning(
        "[redis] using in-memory fakeredis client — data is process-local and "
        "non-persistent (suitable for local dev / CI only)"
    )
    return FakeAsyncRedis(decode_responses=True)


def get_redis() -> Redis:
    """Return the process-wide async Redis client. Lazily initialized."""
    global _pool, _client
    if _client is not None:
        return _client

    if _use_fake or settings.use_fake_redis or not settings.redis_url:
        _client = _build_fake_client()
        return _client

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
    """
    Startup probe: ensure we can talk to Redis before serving.

    Returns True when a usable client (real or fake) is ready, False only when
    no token store can be provided and the environment demands a real one.
    """
    global _use_fake

    # Explicit opt-in to the in-memory client, or no URL configured at all.
    if settings.use_fake_redis or not settings.redis_url:
        _use_fake = True
        client = get_redis()
        await client.ping()
        return True

    try:
        client = get_redis()
        if await client.ping():
            logger.info("[redis] ping ok")
            return True
        raise RuntimeError("redis ping returned a falsy value")
    except Exception:
        logger.exception("[redis] init failed")
        # Production must fail fast: a missing token store is a real outage.
        if settings.is_production:
            return False
        # Non-production: degrade to the in-memory client so the app still runs.
        logger.warning(
            "[redis] real Redis unreachable in env=%s — degrading to in-memory "
            "fakeredis so the app can run without external infra",
            settings.environment,
        )
        await _reset_client_only()
        _use_fake = True
        client = get_redis()
        await client.ping()
        return True


async def _reset_client_only() -> None:
    """Tear down a half-built real client before swapping in the fake one."""
    global _client, _pool
    try:
        if _client is not None:
            await _client.aclose()
        if _pool is not None:
            await _pool.aclose()
    except Exception:
        logger.debug("[redis] error disposing failed real client", exc_info=True)
    finally:
        _client = None
        _pool = None


async def close_redis() -> None:
    """Cleanly tear down the pool on application shutdown."""
    global _client, _pool, _use_fake
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
        _use_fake = False
        logger.info("[redis] closed")
