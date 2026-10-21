"""Alembic environment.

Sources `target_metadata` from `app.models.Base.metadata` so autogenerate
detects every ORM change. Reads the database URL from settings (env-aware)
rather than alembic.ini.

Supports running offline (`alembic upgrade head --sql`) and online (apply
to a live DB). Async URLs (`postgresql+asyncpg://...`) are coerced to sync
form because Alembic itself does not run inside the event loop.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make the app package importable when alembic runs from the repo root.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings, to_sync_pg_url
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _sync_url(url: str) -> str:
    """Normalize the DB URL for Alembic (which runs synchronously).

    Delegates Postgres to ``to_sync_pg_url`` so this file and ``config.py``
    cannot drift: it reads ``$DATABASE_URL`` directly and therefore never
    passes through the Settings validator. That shared helper also pins the
    DBAPI to psycopg2 explicitly -- a bare ``postgresql://`` resolves to
    psycopg (v3) on SQLAlchemy 2.1, which is not a dependency here.

    SQLite keeps its local handling: Alembic does not run inside the event
    loop, so the async driver must be stripped.
    """
    url = to_sync_pg_url(url)
    if "+aiosqlite" in url:
        return url.replace("+aiosqlite", "")
    return url


database_url = os.getenv("DATABASE_URL", settings.database_url)
config.set_main_option("sqlalchemy.url", _sync_url(database_url))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
