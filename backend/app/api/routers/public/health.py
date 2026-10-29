"""``GET /api/health`` (operation ``getHealth``)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.common import ERROR_RESPONSE, Health
from app.services.health import check_health

router = APIRouter(tags=["public"])


@router.get(
    "/api/health",
    operation_id="getHealth",
    summary="Liveness and database check",
    response_model=Health,
    status_code=200,
    responses={503: {**ERROR_RESPONSE, "description": "Database unreachable"}},
)
async def get_health(session: Annotated[AsyncSession, Depends(get_db)]) -> Health:
    return await check_health(session)
