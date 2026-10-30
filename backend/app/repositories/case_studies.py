"""Admin data access for case studies, their results and gallery images (BE-013).

Lists include unpublished rows and are ordered by ``(position, created_at)``; relations are loaded with
``selectinload`` (fixed number of statements). Nested rows are always looked up together with their parent id, so a
mismatching parent finds nothing (404, BE-REV-013).
"""

from __future__ import annotations

import uuid
from typing import Any, Final

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import CaseStudy, CaseStudyImage, CaseStudyResult
from app.repositories import crud

CASE_STUDY_COLUMNS: Final = frozenset(
    {
        "slug",
        "title",
        "client_name",
        "client_industry",
        "campaign_type",
        "channels",
        "goals",
        "summary",
        "problem_md",
        "solution_md",
        "problem_html",
        "solution_html",
        "year",
        "timeline",
        "cover_media_id",
        "cover_alt",
        "is_featured",
        "is_published",
        "is_sample",
        "position",
        "updated_at",
    }
)
RESULT_COLUMNS: Final = frozenset(
    {
        "case_study_id",
        "metric_label",
        "value",
        "before_value",
        "change_text",
        "period",
        "is_sample",
        "position",
        "updated_at",
    }
)
IMAGE_COLUMNS: Final = frozenset({"case_study_id", "media_id", "alt", "caption", "layout", "position", "updated_at"})

_DETAIL_OPTIONS: Final = (
    selectinload(CaseStudy.cover_media),
    selectinload(CaseStudy.results),
    selectinload(CaseStudy.images).selectinload(CaseStudyImage.media),
)


async def list_all(session: AsyncSession) -> list[CaseStudy]:
    return await crud.list_ordered(session, CaseStudy, options=(selectinload(CaseStudy.cover_media),))


async def get_detail(session: AsyncSession, case_study_id: uuid.UUID) -> CaseStudy | None:
    row: CaseStudy | None = await crud.get_by_id(session, CaseStudy, case_study_id, options=_DETAIL_OPTIONS)
    return row


async def get_for_update(session: AsyncSession, case_study_id: uuid.UUID) -> CaseStudy | None:
    row: CaseStudy | None = await crud.get_by_id(session, CaseStudy, case_study_id, for_update=True)
    return row


async def insert(session: AsyncSession, values: dict[str, Any]) -> CaseStudy:
    row: CaseStudy = await crud.insert(session, CaseStudy, values, CASE_STUDY_COLUMNS)
    return row


async def update(session: AsyncSession, row: CaseStudy, values: dict[str, Any]) -> None:
    await crud.apply_update(row, values, CASE_STUDY_COLUMNS, session)


async def delete(session: AsyncSession, case_study_id: uuid.UUID) -> bool:
    """Results and images go with it (``ON DELETE CASCADE``); linked testimonials keep their row (``SET NULL``)."""
    return await crud.delete_by_id(session, CaseStudy, case_study_id)


# ---------------------------------------------------------------------------------------------- results


async def get_result(session: AsyncSession, case_study_id: uuid.UUID, result_id: uuid.UUID) -> CaseStudyResult | None:
    row: CaseStudyResult | None = await crud.get_by_id(
        session, CaseStudyResult, result_id, filters=(CaseStudyResult.case_study_id == case_study_id,)
    )
    return row


async def insert_result(session: AsyncSession, values: dict[str, Any]) -> CaseStudyResult:
    row: CaseStudyResult = await crud.insert(session, CaseStudyResult, values, RESULT_COLUMNS)
    return row


async def update_result(session: AsyncSession, row: CaseStudyResult, values: dict[str, Any]) -> None:
    await crud.apply_update(row, values, RESULT_COLUMNS, session)


async def delete_result(session: AsyncSession, case_study_id: uuid.UUID, result_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(
        session, CaseStudyResult, result_id, filters=(CaseStudyResult.case_study_id == case_study_id,)
    )


# ---------------------------------------------------------------------------------------------- images


async def get_image(session: AsyncSession, case_study_id: uuid.UUID, image_id: uuid.UUID) -> CaseStudyImage | None:
    row: CaseStudyImage | None = await crud.get_by_id(
        session,
        CaseStudyImage,
        image_id,
        filters=(CaseStudyImage.case_study_id == case_study_id,),
        options=(selectinload(CaseStudyImage.media),),
    )
    return row


async def insert_image(session: AsyncSession, values: dict[str, Any]) -> CaseStudyImage:
    row: CaseStudyImage = await crud.insert(session, CaseStudyImage, values, IMAGE_COLUMNS)
    return row


async def update_image(session: AsyncSession, row: CaseStudyImage, values: dict[str, Any]) -> None:
    await crud.apply_update(row, values, IMAGE_COLUMNS, session)


async def delete_image(session: AsyncSession, case_study_id: uuid.UUID, image_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(
        session, CaseStudyImage, image_id, filters=(CaseStudyImage.case_study_id == case_study_id,)
    )
