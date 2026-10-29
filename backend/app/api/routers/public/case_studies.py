"""``GET /api/public/case-studies[/{slug}]`` (``listPublicCaseStudies``, ``getPublicCaseStudy``, BE-006)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.common import ERROR_RESPONSE
from app.schemas.public import CaseStudyDetail, CaseStudySummary
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get(
    "/case-studies",
    operation_id="listPublicCaseStudies",
    summary="Published case studies in display order",
    response_model=list[CaseStudySummary],
    status_code=200,
    responses={422: {**ERROR_RESPONSE, "description": "Invalid query parameter"}},
)
async def list_public_case_studies(
    session: Annotated[AsyncSession, Depends(get_db)],
    featured: Annotated[bool | None, Query(description="When true, only featured case studies")] = None,
) -> list[CaseStudySummary]:
    return await content_public.list_case_studies(session, featured=featured)


@router.get(
    "/case-studies/{slug}",
    operation_id="getPublicCaseStudy",
    summary='Published case study with results, gallery and two "more work" items',
    response_model=CaseStudyDetail,
    status_code=200,
    responses={404: {**ERROR_RESPONSE, "description": "Unknown or unpublished case study"}},
)
async def get_public_case_study(slug: str, session: Annotated[AsyncSession, Depends(get_db)]) -> CaseStudyDetail:
    return await content_public.get_case_study(session, slug)
