"""Database ping for the health check."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def ping(session: AsyncSession) -> None:
    await session.execute(select(1))
