"""
Pytest fixtures — async-ready (Phase 2.2).

Tests use an in-memory SQLite (`sqlite+aiosqlite:///:memory:`) for the async
session and a sync `sqlite:///:memory:` for the legacy sync session. Both
share the same metadata via `Base.metadata.create_all`.

`asyncio_mode = "auto"` is set in pyproject.toml so async test functions
do not need decorators.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_async_db, get_db
from app.models.base import Base
from main import app


# ---------------------------------------------------------------------------
# Sync test DB (legacy routes)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def sync_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def sync_db(sync_engine) -> Iterator[Session]:
    SessionLocal = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False, future=True)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


# ---------------------------------------------------------------------------
# Async test DB (v1 routes)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session")
async def async_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def async_db(async_engine) -> AsyncIterator[AsyncSession]:
    SessionLocal = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()


# ---------------------------------------------------------------------------
# FastAPI test clients
# ---------------------------------------------------------------------------
@pytest.fixture
def client(sync_db, async_db) -> Iterator[TestClient]:
    """Sync test client — overrides both get_db and get_async_db."""
    app.dependency_overrides[get_db] = lambda: sync_db
    app.dependency_overrides[get_async_db] = lambda: async_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(sync_db, async_db) -> AsyncIterator[AsyncClient]:
    """Async ASGI test client for v1 routes."""
    app.dependency_overrides[get_db] = lambda: sync_db
    app.dependency_overrides[get_async_db] = lambda: async_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop so async fixtures share the same loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
