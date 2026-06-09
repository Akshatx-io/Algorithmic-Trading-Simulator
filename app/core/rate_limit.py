"""Shared slowapi limiter.

Defined here (rather than in main.py) so routers can apply per-route
``@limiter.limit(...)`` decorators without importing from ``main`` -- which
would create a circular import (main imports the routers). main.py binds this
same instance to ``app.state.limiter`` for SlowAPIMiddleware.

Keyed on the remote address; behind Render's proxy uvicorn runs with
``--proxy-headers --forwarded-allow-ips '*'`` so the real client IP (not the
proxy) is used.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

__all__ = ["limiter"]
