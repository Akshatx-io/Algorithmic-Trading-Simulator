"""
JWT token issuance and verification.

All configuration is read from `settings`. There are no module-level secrets
(audit finding 3.1 — the previous file hardcoded SECRET_KEY = "supersecretkey"
and bypassed the config system entirely).

Token model:
- Access token  : short-lived JWT (15 min default), carries user_id + jti + aud.
- Refresh token : OPAQUE (random URL-safe string) stored in Redis. Not a JWT.
                  Issued/rotated by app/services/auth_service.AuthService.
- WS token      : short-lived JWT (60 sec default), specifically for the
                  WebSocket handshake (browser cannot set headers on the WS
                  upgrade — token rides in query string).

Backward compatibility: `verify_token` is preserved as a shim so
`app/auth/dependencies.py` and any legacy callers continue to work during the
strangler-fig migration into `app/api/v1/`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4

import jwt  # PyJWT
from jwt import (
    ExpiredSignatureError,
    InvalidAudienceError,
    InvalidSignatureError,
    InvalidTokenError,
    PyJWTError,
)

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("jwt")

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_WS = "ws"


# ---------------------------------------------------------------------------
# Encoders
# ---------------------------------------------------------------------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    user_id: int | str,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Issue a short-lived access token.

    Returns:
        (encoded_jwt, jti) — jti is the unique token id (useful for logout
        blocklisting in future phases).
    """
    now = _now()
    jti = str(uuid4())
    claims: Dict[str, Any] = {
        "sub":  str(user_id),
        "iat":  int(now.timestamp()),
        "exp":  int((now + timedelta(minutes=settings.jwt_access_ttl_minutes)).timestamp()),
        "jti":  jti,
        "aud":  settings.jwt_audience,
        "type": TOKEN_TYPE_ACCESS,
    }
    if extra_claims:
        # Defensive: never let callers overwrite reserved claims
        for k in ("sub", "iat", "exp", "jti", "aud", "type"):
            extra_claims.pop(k, None)
        claims.update(extra_claims)

    token = jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti


def create_ws_token(user_id: int | str) -> str:
    """Issue an ephemeral WebSocket handshake token (60s default TTL)."""
    now = _now()
    claims = {
        "sub":  str(user_id),
        "iat":  int(now.timestamp()),
        "exp":  int((now + timedelta(seconds=settings.jwt_ws_ttl_seconds)).timestamp()),
        "jti":  str(uuid4()),
        "aud":  settings.jwt_audience,
        "type": TOKEN_TYPE_WS,
    }
    return jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


# ---------------------------------------------------------------------------
# Decoders
# ---------------------------------------------------------------------------
def decode_token(
    token: str,
    *,
    expected_type: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Validate signature, audience, and expiry. Optionally enforce a token type.

    Returns the decoded claims dict, or None if invalid. Never raises.
    """
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            options={"require": ["sub", "exp", "iat"]},
        )
    except ExpiredSignatureError:
        return None
    except (InvalidAudienceError, InvalidSignatureError, InvalidTokenError, PyJWTError):
        return None
    except Exception:
        # Defensive: catch anything else from the JWT library to avoid 500s.
        logger.exception("[jwt] unexpected decode error")
        return None

    if expected_type and payload.get("type") != expected_type:
        return None

    return payload


# ---------------------------------------------------------------------------
# Back-compat shim
# ---------------------------------------------------------------------------
def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Legacy alias kept for `app/auth/dependencies.py` and the WebSocket endpoint
    in `app/api/routes.py`. New code should call `decode_token` directly with
    an explicit `expected_type`.
    """
    return decode_token(token)
