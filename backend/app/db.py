"""Async database engine and session factory (SD-001, SEC-BE-018)."""

from __future__ import annotations

import asyncio
from typing import Final

from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

POOL_SIZE: Final = 5
CONNECT_TIMEOUT_SECONDS: Final = 5
STATEMENT_TIMEOUT_MS: Final = 10_000


class DatabaseUnreachableError(RuntimeError):
    """The database could not be reached. The message names host:port only, never credentials."""


def create_engine(database_url: SecretStr, *, pool_size: int = POOL_SIZE) -> AsyncEngine:
    return create_async_engine(
        database_url.get_secret_value(),
        pool_size=pool_size,
        max_overflow=0,
        pool_pre_ping=True,
        hide_parameters=True,
        connect_args={
            "timeout": CONNECT_TIMEOUT_SECONDS,
            "server_settings": {
                "statement_timeout": str(STATEMENT_TIMEOUT_MS),
                "application_name": "mitali-portfolio",
            },
        },
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def verify_connection(engine: AsyncEngine, location: str) -> None:
    """Run ``SELECT 1``; raise ``DatabaseUnreachableError("database unreachable on <host:port>")`` on failure."""
    try:
        async with asyncio.timeout(CONNECT_TIMEOUT_SECONDS * 2):
            async with engine.connect() as connection:
                await connection.execute(select(1))
    except (OSError, TimeoutError, SQLAlchemyError) as exc:
        reason = type(exc).__name__
        raise DatabaseUnreachableError(f"database unreachable on {location} ({reason})") from None
