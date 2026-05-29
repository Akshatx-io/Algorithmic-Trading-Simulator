"""
API v1 — modular per-domain routers.

Phase 2.1 ships only `auth`. Phases 2.3+ add portfolio, trading, market,
signals, analytics, ws, health under the same prefix.

The aggregator router is mounted by main.py at `/api/v1` and takes precedence
over the legacy `app.api.routes` router for any overlapping paths.
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router

router = APIRouter()
router.include_router(auth_router)

__all__ = ["router"]
