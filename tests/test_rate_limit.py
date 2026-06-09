"""Auth rate-limiting (brute-force protection).

A failed login still passes through the slowapi limiter before the handler
runs, so flooding /login with bad credentials exercises the limit without
needing a real account or Redis: the first requests return 401, and once the
per-IP budget is exhausted the limiter short-circuits with 429.
"""
import pytest


@pytest.mark.integration
def test_login_is_rate_limited(client):
    codes = [
        client.post(
            "/api/v1/auth/login",
            json={"username": "ghost", "password": "wrong-password"},
        ).status_code
        for _ in range(13)
    ]
    assert codes[0] == 401, f"first attempt should be a normal auth failure, got {codes}"
    assert 429 in codes, f"expected a 429 once the limit is hit, got {codes}"
    # Limit is 10/min, so the 11th+ should be throttled.
    assert codes.count(429) >= 2, f"expected several throttled attempts, got {codes}"
