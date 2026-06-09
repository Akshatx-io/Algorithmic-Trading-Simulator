"""Rate limiting.

Two mechanisms, on purpose:

* ``limiter`` -- the slowapi ``Limiter`` instance, bound to ``app.state`` and
  used by main.py for GET endpoints (root, health). slowapi's decorator works
  cleanly on endpoints that have no request body.

* ``rate_limit(n)`` -- a FastAPI dependency for endpoints that DO carry a
  Pydantic request body (auth register/login/refresh). slowapi's ``@limit``
  decorator wraps the endpoint signature, and in some FastAPI versions that
  makes the body model get misread as a *query* parameter (=> 422
  ``payload: Field required``). A dependency never touches the endpoint
  signature, so request-body parsing is always correct.

Fixed-window, keyed per client IP + path. In-memory is sufficient: the service
runs a single uvicorn worker (the background market/candle/signal engines live
in the app lifespan and must not be duplicated across workers).
"""

import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address

# slowapi limiter (GET endpoints + SlowAPIMiddleware in main.py)
limiter = Limiter(key_func=get_remote_address)

_WINDOW_SECONDS = 60.0
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(max_per_minute: int) -> Callable:
    """Dependency: allow at most ``max_per_minute`` requests per client IP per
    endpoint within a rolling 60-second window, else raise HTTP 429."""

    async def _dependency(request: Request) -> None:
        ip = get_remote_address(request)
        key = f"{ip}:{request.url.path}"
        now = time.monotonic()
        bucket = _hits[key]
        cutoff = now - _WINDOW_SECONDS
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= max_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again shortly.",
            )
        bucket.append(now)

    return _dependency


__all__ = ["limiter", "rate_limit"]
