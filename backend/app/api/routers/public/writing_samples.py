"""``GET /api/public/writing-samples[/{slug}]`` (``listPublicWritingSamples``, ``getPublicWritingSample``)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.common import ERROR_RESPONSE
from app.schemas.enums import WritingFormat
from app.schemas.public import WritingSampleDetail, WritingSampleSummary
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get(
    "/writing-samples",
    operation_id="listPublicWritingSamples",
    summary="Published writing samples in display order, optionally filtered by format",
    response_model=list[WritingSampleSummary],
    status_code=200,
    responses={422: {**ERROR_RESPONSE, "description": "Unknown format"}},
)
async def list_public_writing_samples(
    session: Annotated[AsyncSession, Depends(get_db)],
    writing_format: Annotated[WritingFormat | None, Query(alias="format")] = None,
) -> list[WritingSampleSummary]:
    return await content_public.list_writing_samples(session, writing_format=writing_format)


@router.get(
    "/writing-samples/{slug}",
    operation_id="getPublicWritingSample",
    summary="Published writing sample with sanitized body HTML",
    response_model=WritingSampleDetail,
    status_code=200,
    responses={404: {**ERROR_RESPONSE, "description": "Unknown or unpublished writing sample"}},
)
async def get_public_writing_sample(
    slug: str, session: Annotated[AsyncSession, Depends(get_db)]
) -> WritingSampleDetail:
    return await content_public.get_writing_sample(session, slug)
