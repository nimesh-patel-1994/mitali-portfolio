"""Alembic environment (async, SQLAlchemy 2.0 + asyncpg).

The URL comes from ``config.attributes["database_url"]`` when set by code (test harness, BE-025), otherwise from
``Settings.database_url`` (``backend/.env``). It is never written to ``alembic.ini`` or printed.
"""

from __future__ import annotations

import asyncio
import logging.config

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import load_settings
from app.models import Base

config = context.config

if config.config_file_name is not None and not config.attributes.get("skip_logging_config"):
    logging.config.fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _database_url() -> str:
    explicit = config.attributes.get("database_url")
    if isinstance(explicit, str) and explicit:
        return explicit
    return load_settings().database_url.get_secret_value()


def run_migrations_offline() -> None:
    """Render SQL (``alembic upgrade head --sql``) without connecting."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run_sync(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if isinstance(connection, Connection):
        _run_sync(connection)
        return
    engine = create_async_engine(_database_url(), poolclass=NullPool, hide_parameters=True)
    try:
        async with engine.connect() as async_connection:
            await async_connection.run_sync(_run_sync)
    finally:
        await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
