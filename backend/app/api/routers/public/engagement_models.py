"""``GET /api/public/engagement-models`` (``listPublicEngagementModels``, BE-006)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.public import EngagementModel
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get(
    "/engagement-models",
    operation_id="listPublicEngagementModels",
    summary="Published engagement models in display order",
    response_model=list[EngagementModel],
    status_code=200,
)
async def list_public_engagement_models(session: Annotated[AsyncSession, Depends(get_db)]) -> list[EngagementModel]:
    return await content_public.list_engagement_models(session)
