"""``GET /api/public/site`` (``getPublicSite``, BE-006): public settings, profile and ``generated_at``."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.public import SiteBundle
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get(
    "/site",
    operation_id="getPublicSite",
    summary="Site bundle (public settings + profile + server time used as the build snapshot)",
    response_model=SiteBundle,
    status_code=200,
)
async def get_public_site(session: Annotated[AsyncSession, Depends(get_db)]) -> SiteBundle:
    return await content_public.get_site(session)
