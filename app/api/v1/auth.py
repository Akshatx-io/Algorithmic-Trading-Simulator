"""
v1 auth router — async SQLAlchemy 2.0 (Phase 2.2).

Token transport (audit 6.8, 3.11):
- Access: JSON body, held in memory client-side.
- Refresh: httpOnly cookie scoped to /api/v1/auth, rotated on every refresh.
- WS: 60s JWT minted by /auth/ws-token, query-string only.
"""

from __future__ import annotations

import asyncio
from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_async
from app.auth.jwt_handler import TOKEN_TYPE_ACCESS, decode_token
from app.auth.password import hash_password, verify_password
from app.core.config import settings
from app.core.database import get_async_db
from app.core.logger import get_logger
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.seed.demo import DEMO_PASSWORD, DEMO_USERNAME, seed_demo_account
from app.services.auth_service import AuthError, auth_service

logger = get_logger("api.v1.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
COOKIE_PATH = "/api/v1/auth"


class UserPublic(BaseModel):
    id:         int
    username:   str
    email:      str | None = None
    balance:    float
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password:     str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int = Field(..., description="Access token TTL in seconds")
    user:         UserPublic


class WsTokenResponse(BaseModel):
    ws_token:   str
    expires_in: int


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=settings.jwt_refresh_days * 86400,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path=COOKIE_PATH)


def _token_response(result) -> TokenResponse:
    return TokenResponse(
        access_token=result.access_token,
        expires_in=settings.jwt_access_ttl_minutes * 60,
        user=UserPublic.model_validate(result.user),
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(5))],
)
async def register(
    payload: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_async_db),
) -> TokenResponse:
    try:
        result = await auth_service.register(db, payload.username, payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _set_refresh_cookie(response, result.refresh_token)
    return _token_response(result)


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(10))],
)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_async_db),
) -> TokenResponse:
    try:
        result = await auth_service.login(db, payload.username, payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    _set_refresh_cookie(response, result.refresh_token)
    return _token_response(result)


@router.post(
    "/demo",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(20))],
)
async def demo_login(
    response: Response,
    db: AsyncSession = Depends(get_async_db),
) -> TokenResponse:
    """One-click demo sign-in: (re)seed a curated, populated account and issue
    tokens for it through the normal login flow. The demo account is sandboxed
    and reset on every use."""
    await asyncio.to_thread(seed_demo_account)
    try:
        result = await auth_service.login(db, DEMO_USERNAME, DEMO_PASSWORD)
    except AuthError as exc:
        raise HTTPException(status_code=503, detail="Demo is temporarily unavailable") from exc
    _set_refresh_cookie(response, result.refresh_token)
    return _token_response(result)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(30))],
)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_async_db),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    try:
        result = await auth_service.refresh(db, refresh_token)
    except AuthError as exc:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    _set_refresh_cookie(response, result.refresh_token)
    return _token_response(result)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    authorization: str | None = Header(default=None),
) -> Response:
    jti: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        payload = decode_token(authorization[7:], expected_type=TOKEN_TYPE_ACCESS)
        if payload:
            jti = payload.get("jti")
    await auth_service.logout(refresh_token=refresh_token, access_jti=jti)
    _clear_refresh_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/ws-token", response_model=WsTokenResponse)
async def issue_ws_token(user: User = Depends(get_current_user_async)) -> WsTokenResponse:
    return WsTokenResponse(
        ws_token=auth_service.issue_ws_token(user.id),
        expires_in=settings.jwt_ws_ttl_seconds,
    )


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user_async)) -> UserPublic:
    return UserPublic.model_validate(user)


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user_async),
    db: AsyncSession = Depends(get_async_db),
):
    """Change the caller's password after verifying the current one."""
    row = await db.get(User, user.id)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.current_password, row.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < settings.password_min_length:
        raise HTTPException(
            status_code=400,
            detail=f"New password must be at least {settings.password_min_length} characters",
        )
    if verify_password(payload.new_password, row.hashed_password):
        raise HTTPException(status_code=400, detail="New password must differ from the current one")

    row.hashed_password = hash_password(payload.new_password)
    await db.commit()
    logger.info("[auth] password changed for user=%s", user.id)
    return {"status": "success", "message": "Password updated."}
