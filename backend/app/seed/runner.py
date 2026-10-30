"""``run_seed(reset)`` (BE-023, TS-017): opens its own engine and session (CLI context) and calls the seed service.

Used by ``python -m app.cli seed [--reset]``. Tests pass ``session_factory`` (sessions joined to the test
transaction) and ``settings`` (temporary ``MEDIA_ROOT``, chosen ``APP_ENV``).
"""

from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db import create_engine, create_sessionmaker, verify_connection
from app.services.seed import SeedSummary, seed_content


async def run_seed(
    reset: bool,
    *,
    settings: Settings,
    session_factory: Callable[[], AsyncSession] | None = None,
) -> SeedSummary:
    engine = None
    try:
        if session_factory is None:
            engine = create_engine(settings.database_url, pool_size=1)
            await verify_connection(engine, settings.database_location())
            session_factory = create_sessionmaker(engine)
        async with session_factory() as session:
            return await seed_content(
                session, reset=reset, app_env=settings.app_env, media_root=settings.media_root_path
            )
    finally:
        if engine is not None:
            await engine.dispose()
