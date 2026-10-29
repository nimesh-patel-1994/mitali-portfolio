"""Health check (BE-005): ``SELECT 1`` with a short timeout; 503 ``service_unavailable`` when the DB is down."""

from __future__ import annotations

import asyncio
import logging
from typing import Final

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ServiceUnavailableError
from app.repositories import health as health_repository
from app.schemas.common import Health

logger = logging.getLogger(__name__)

HEALTH_TIMEOUT_SECONDS: Final = 5.0


async def check_health(session: AsyncSession) -> Health:
    try:
        async with asyncio.timeout(HEALTH_TIMEOUT_SECONDS):
            await health_repository.ping(session)
    except (OSError, TimeoutError, SQLAlchemyError) as exc:
        logger.warning("health.database_unreachable", extra={"fields": {"error_type": type(exc).__name__}})
        raise ServiceUnavailableError("The database is not reachable.") from None
    return Health(status="ok", database="ok")
