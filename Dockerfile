# syntax=docker/dockerfile:1.7
# =============================================================================
# Multi-stage Dockerfile — HFT Trading Platform backend
#
# Targets:
#   - base    : shared OS layer + Python deps
#   - api     : FastAPI HTTP + WebSocket entrypoint (multi-worker uvicorn)
#   - workers : background engine entrypoint (single worker, asyncio supervisor)
#
# Build examples:
#   docker build --target api     -t hft-api:dev .
#   docker build --target workers -t hft-workers:dev .
#
# Phase 2.0 deliverable. See ROADMAP.md and ARCHITECTURE.md §11.2.
# =============================================================================


# -----------------------------------------------------------------------------
# Stage 1: dependency builder
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System build deps (libpq for psycopg2-binary build path)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install into an isolated virtualenv we'll copy into the runtime stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy only dependency manifests first so docker layer caching works
COPY pyproject.toml README.md ./

# Install runtime + dev (we'll prune dev later for the api/workers stages)
RUN pip install --upgrade pip wheel setuptools \
    && pip install -e .[dev]


# -----------------------------------------------------------------------------
# Stage 2: base runtime
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_ENV=production

# Runtime system deps only — no compilers in the final image
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (defense in depth)
RUN groupadd --system --gid 1001 hft \
    && useradd  --system --uid 1001 --gid hft --create-home --shell /sbin/nologin hft

WORKDIR /app

# Bring in the prebuilt venv + application code
COPY --from=builder /opt/venv /opt/venv
COPY --chown=hft:hft . /app

# Ensure logs directory exists and is writable (logger writes here at startup)
RUN mkdir -p /app/logs && chown -R hft:hft /app

USER hft

# Tini handles PID 1 signal forwarding (graceful shutdown of asyncio tasks)
ENTRYPOINT ["tini", "--"]


# -----------------------------------------------------------------------------
# Stage 3a: API target
# -----------------------------------------------------------------------------
FROM base AS api

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl --fail --silent http://localhost:8000/health || exit 1

# uvicorn workers via env: UVICORN_WORKERS=$((2 * CPU + 1)) at deploy time
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]


# -----------------------------------------------------------------------------
# Stage 3b: Workers target (background engines)
# -----------------------------------------------------------------------------
FROM base AS workers

# Workers do not expose a port; they emit metrics on /metrics inside the api
# container only (Phase 3.3). Health is observed via Redis heartbeat.

# Until Phase 2.5 introduces app/workers/entrypoint.py, the worker target
# runs the same api process — engines are started via the FastAPI lifespan.
# This will diverge once engines are extracted from the API process.
CMD ["python", "-m", "app.workers.entrypoint"]
