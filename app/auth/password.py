"""
Password hashing and refresh-token generation.

Direct bcrypt 4.x usage (audit 3.7 — drops the deprecated `passlib` chain).
bcrypt's `checkpw` is constant-time, which is the property we need.

If the existing user table contains argon2-hashed passwords from the previous
implementation, those rows must be re-hashed at the next successful login.
A one-line migration helper (`is_legacy_hash`) is provided for that.
"""

from __future__ import annotations

import secrets

import bcrypt

# bcrypt cost factor. 12 ≈ ~250ms on commodity hardware — appropriate for an
# interactive login path. Production may bump to 13–14.
_BCRYPT_ROUNDS = 12


# ---------------------------------------------------------------------------
# Hash + verify
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Return a bcrypt hash string. Raises on empty input."""
    if not password:
        raise ValueError("Password cannot be empty")
    hashed = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(rounds=_BCRYPT_ROUNDS),
    )
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time password comparison. Returns False on malformed input."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Malformed hash (e.g., legacy argon2 string under bcrypt's parser).
        return False


def is_legacy_hash(hashed_password: str) -> bool:
    """True if the stored hash looks like an argon2/passlib record."""
    return bool(hashed_password) and hashed_password.startswith("$argon2")


# ---------------------------------------------------------------------------
# Refresh-token generator (used by AuthService)
# ---------------------------------------------------------------------------
def generate_refresh_token() -> str:
    """
    Cryptographically secure opaque refresh token.

    URL-safe so it can ride in an httpOnly cookie without escaping. 32 bytes
    of entropy (~256 bits) — collision-resistant against the entire user base
    for the lifetime of the universe.
    """
    return secrets.token_urlsafe(32)
