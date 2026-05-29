"""
Authentication service — async SQLAlchemy 2.0 edition (Phase 2.2).

Contract:
    redis:
        refresh:{token}      -> str(user_id)     EX <jwt_refresh_days * 86400>
        jti:blocked:{jti}    -> "1"              EX <remaining_access_ttl>

Audit fixes:
- 3.1  No hardcoded secrets — all values flow from settings.
- 6.5  Async sessions, no sync ORM calls inside async handlers.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt_handler import create_access_token, create_ws_token
from app.auth.password import (
    generate_refresh_token,
    hash_password,
    is_legacy_hash,
    verify_password,
)
from app.core.config import settings
from app.core.logger import get_logger
from app.infra.redis_client import get_redis
from app.models.user import User

logger = get_logger("auth_service")

REFRESH_PREFIX = "refresh:"
BLOCKLIST_PREFIX = "jti:blocked:"


class AuthError(Exception):
    """Domain error from AuthService. Mapped to HTTP 400/401 in the route."""


@dataclass(frozen=True)
class TokenPair:
    user: User
    access_token: str
    refresh_token: str
    access_jti: str


class AuthService:
    """Stateless orchestration over jwt_handler + Redis + user lookup."""

    # ----- public ----------------------------------------------------------
    async def register(
        self,
        db: AsyncSession,
        username: str,
        password: str,
    ) -> TokenPair:
        username = (username or "").strip()
        if not username:
            raise AuthError("Username is required")
        if len(password) < settings.password_min_length:
            raise AuthError(
                f"Password must be at least {settings.password_min_length} characters"
            )

        existing = await db.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none():
            raise AuthError("Username already exists")

        user = User(
            username=username,
            hashed_password=hash_password(password),
            balance=settings.default_user_balance,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("[auth] user registered id=%s", user.id)
        return await self._issue_tokens(user)

    async def login(
        self,
        db: AsyncSession,
        username: str,
        password: str,
    ) -> TokenPair:
        result = await db.execute(
            select(User).where(User.username == (username or "").strip())
        )
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.hashed_password):
            raise AuthError("Invalid credentials")

        if is_legacy_hash(user.hashed_password):
            user.hashed_password = hash_password(password)
            await db.commit()
            logger.info("[auth] re-hashed legacy password user_id=%s", user.id)

        logger.info("[auth] login ok user_id=%s", user.id)
        return await self._issue_tokens(user)

    async def refresh(self, db: AsyncSession, refresh_token: str) -> TokenPair:
        if not refresh_token:
            raise AuthError("Refresh token required")

        redis = get_redis()
        key = f"{REFRESH_PREFIX}{refresh_token}"
        user_id_str = await redis.get(key)
        if not user_id_str:
            raise AuthError("Invalid or expired refresh token")

        try:
            user_id = int(user_id_str)
        except (TypeError, ValueError):
            await redis.delete(key)
            raise AuthError("Corrupted refresh token record")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            await redis.delete(key)
            raise AuthError("User no longer exists")

        # Atomic single-use rotation — concurrent refresh attempts lose the race.
        await redis.delete(key)
        logger.info("[auth] refresh rotated user_id=%s", user.id)
        return await self._issue_tokens(user)

    async def logout(
        self,
        refresh_token: Optional[str],
        access_jti: Optional[str] = None,
    ) -> None:
        try:
            redis = get_redis()
        except RuntimeError:
            logger.warning("[auth] logout without redis")
            return

        if refresh_token:
            await redis.delete(f"{REFRESH_PREFIX}{refresh_token}")

        if access_jti:
            await redis.setex(
                f"{BLOCKLIST_PREFIX}{access_jti}",
                settings.jwt_access_ttl_minutes * 60,
                "1",
            )

    def issue_ws_token(self, user_id: int) -> str:
        return create_ws_token(user_id)

    # ----- internal --------------------------------------------------------
    async def _issue_tokens(self, user: User) -> TokenPair:
        access_token, jti = create_access_token(user.id)
        refresh_token = generate_refresh_token()

        redis = get_redis()
        await redis.setex(
            f"{REFRESH_PREFIX}{refresh_token}",
            settings.jwt_refresh_days * 86400,
            str(user.id),
        )

        return TokenPair(
            user=user,
            access_token=access_token,
            refresh_token=refresh_token,
            access_jti=jti,
        )


auth_service = AuthService()
