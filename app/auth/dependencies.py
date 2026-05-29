"""
FastAPI dependencies for authentication.

Two variants ship side-by-side during the strangler migration:
- `get_current_user`       (sync)  — legacy `app/api/routes.py` consumers.
- `get_current_user_async` (async) — canonical, used by `app/api/v1/*`.

Both validate signature, audience, expiry and `type=access`.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.auth.jwt_handler import TOKEN_TYPE_ACCESS, decode_token
from app.core.database import get_async_db, get_db
from app.core.logger import get_logger
from app.models.user import User

logger = get_logger("auth_deps")

# auto_error=False so we control the 401 response shape uniformly.
_bearer = HTTPBearer(auto_error=False)


def _decode_or_401(credentials: HTTPAuthorizationCredentials | None) -> tuple[int, dict]:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials, expected_type=TOKEN_TYPE_ACCESS)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    return user_id, payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Sync variant — kept for legacy routes during the 2.3 migration."""
    user_id, _ = _decode_or_401(credentials)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


async def get_current_user_async(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_async_db),
) -> User:
    """Async variant — canonical."""
    user_id, _ = _decode_or_401(credentials)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user
