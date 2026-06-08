#!/usr/bin/env sh
# =============================================================================
# Production entrypoint.
#
#   1. Apply database migrations (alembic upgrade head) — the schema source of
#      truth; the app does NOT create tables at startup in production.
#   2. Launch the ASGI server bound to the platform-provided $PORT.
#
# Single uvicorn worker on purpose: the background market/candle/signal engines
# run inside the FastAPI lifespan, so multiple workers would duplicate them.
# =============================================================================
set -e

echo "[start] applying database migrations (alembic upgrade head)"
alembic upgrade head

echo "[start] launching uvicorn on port ${PORT:-8000}"
exec uvicorn main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips "*"
