"""Admin case studies with nested results and gallery images (BE-013, TS-010, TS-012, REQ-063, REQ-067).

Write flow: validate (schema) → render Markdown in the threadpool (BE-018) → open the transaction → check references
(cover/gallery media) and the slug → write with the position rules of ``ordering`` → ``publishing.touch()`` → commit.
Nested results and images are always addressed through their parent; a mismatching parent is 404.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Final

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.errors import NotFoundError
from app.models import CaseStudy, CaseStudyImage, CaseStudyResult
from app.repositories import case_studies as repository
from app.schemas.case_study import (
    AdminCaseStudy,
    AdminCaseStudyImage,
    AdminCaseStudyListItem,
    AdminCaseStudyResult,
    CaseStudyImageInput,
    CaseStudyInput,
    CaseStudyResultInput,
)
from app.services import ordering, publishing
from app.services.image_refs import image_ref
from app.services.markdown import RenderedMarkdown, render_markdown
from app.services.ordering import Scope
from app.services.references import ensure_media_exists
from app.services.slugs import ensure_slug_available, raise_if_slug_violation

CASE_STUDY_NOT_FOUND: Final = "Case study not found."
RESULT_NOT_FOUND: Final = "Result not found."
IMAGE_NOT_FOUND: Final = "Gallery image not found."


def _results_scope(case_study_id: uuid.UUID) -> Scope:
    return Scope(CaseStudyResult, (CaseStudyResult.case_study_id == case_study_id,))


def _images_scope(case_study_id: uuid.UUID) -> Scope:
    return Scope(CaseStudyImage, (CaseStudyImage.case_study_id == case_study_id,))


# ---------------------------------------------------------------------------------------------- mapping


def _result_out(row: CaseStudyResult) -> AdminCaseStudyResult:
    return AdminCaseStudyResult(
        id=row.id,
        position=row.position,
        created_at=row.created_at,
        updated_at=row.updated_at,
        metric_label=row.metric_label,
        value=row.value,
        before_value=row.before_value,
        change_text=row.change_text,
        period=row.period,
        is_sample=row.is_sample,
    )


def _image_out(row: CaseStudyImage) -> AdminCaseStudyImage:
    image = image_ref(row.media, row.alt)
    if image is None:  # media_id is NOT NULL with an FK, so a gallery row always has media
        raise NotFoundError(IMAGE_NOT_FOUND)
    return AdminCaseStudyImage(
        id=row.id,
        position=row.position,
        created_at=row.created_at,
        updated_at=row.updated_at,
        media_id=row.media_id,
        alt=row.alt,
        caption=row.caption,
        layout="half" if row.layout == "half" else "full",
        image=image,
    )


def _list_item(row: CaseStudy) -> AdminCaseStudyListItem:
    return AdminCaseStudyListItem(
        id=row.id,
        slug=row.slug,
        title=row.title,
        campaign_type=row.campaign_type,
        cover=image_ref(row.cover_media, row.cover_alt),
        is_featured=row.is_featured,
        is_published=row.is_published,
        is_sample=row.is_sample,
        position=row.position,
        updated_at=row.updated_at,
    )


def _detail(row: CaseStudy) -> AdminCaseStudy:
    return AdminCaseStudy(
        id=row.id,
        position=row.position,
        created_at=row.created_at,
        updated_at=row.updated_at,
        slug=row.slug,
        title=row.title,
        client_name=row.client_name,
        client_industry=row.client_industry,
        campaign_type=row.campaign_type,
        channels=list(row.channels),
        goals=list(row.goals),
        summary=row.summary,
        problem_md=row.problem_md,
        solution_md=row.solution_md,
        year=row.year,
        timeline=row.timeline,
        cover_media_id=row.cover_media_id,
        cover_alt=row.cover_alt,
        is_featured=row.is_featured,
        is_published=row.is_published,
        is_sample=row.is_sample,
        problem_html=row.problem_html,
        solution_html=row.solution_html,
        cover=image_ref(row.cover_media, row.cover_alt),
        results=[_result_out(result) for result in row.results],
        images=[_image_out(image) for image in row.images],
    )


async def _load_detail(session: AsyncSession, case_study_id: uuid.UUID) -> AdminCaseStudy:
    row = await repository.get_detail(session, case_study_id)
    if row is None:
        raise NotFoundError(CASE_STUDY_NOT_FOUND)
    return _detail(row)


def _render_both(payload: CaseStudyInput) -> tuple[RenderedMarkdown, RenderedMarkdown]:
    return render_markdown(payload.problem_md), render_markdown(payload.solution_md)


def _editable_values(payload: CaseStudyInput, problem: RenderedMarkdown, solution: RenderedMarkdown) -> dict[str, Any]:
    return {
        "slug": payload.slug,
        "title": payload.title,
        "client_name": payload.client_name,
        "client_industry": payload.client_industry,
        "campaign_type": payload.campaign_type,
        "channels": list(payload.channels),
        "goals": list(payload.goals),
        "summary": payload.summary,
        "problem_md": payload.problem_md,
        "solution_md": payload.solution_md,
        "problem_html": problem.html,
        "solution_html": solution.html,
        "year": payload.year,
        "timeline": payload.timeline,
        "cover_media_id": payload.cover_media_id,
        "cover_alt": payload.cover_alt,
        "is_featured": payload.is_featured,
        "is_published": payload.is_published,
        "is_sample": payload.is_sample,
    }


# ---------------------------------------------------------------------------------------------- case studies


async def list_case_studies(session: AsyncSession) -> list[AdminCaseStudyListItem]:
    async with session.begin():
        return [_list_item(row) for row in await repository.list_all(session)]


async def get_case_study(session: AsyncSession, case_study_id: uuid.UUID) -> AdminCaseStudy:
    async with session.begin():
        return await _load_detail(session, case_study_id)


async def create_case_study(session: AsyncSession, payload: CaseStudyInput) -> AdminCaseStudy:
    problem, solution = await run_in_threadpool(_render_both, payload)
    now = datetime.now(UTC)
    try:
        async with session.begin():
            await ensure_media_exists(session, payload.cover_media_id, "cover_media_id")
            await ensure_slug_available(session, CaseStudy, payload.slug)
            values = _editable_values(payload, problem, solution)
            values["position"] = await ordering.next_position(session, Scope(CaseStudy))
            row = await repository.insert(session, values)
            await publishing.touch(session, now=now)
            return await _load_detail(session, row.id)
    except IntegrityError as exc:  # concurrent save of the same slug
        raise_if_slug_violation(exc, "case_studies")
        raise


async def update_case_study(session: AsyncSession, case_study_id: uuid.UUID, payload: CaseStudyInput) -> AdminCaseStudy:
    problem, solution = await run_in_threadpool(_render_both, payload)
    now = datetime.now(UTC)
    try:
        async with session.begin():
            row = await repository.get_for_update(session, case_study_id)
            if row is None:
                raise NotFoundError(CASE_STUDY_NOT_FOUND)
            await ensure_media_exists(session, payload.cover_media_id, "cover_media_id")
            await ensure_slug_available(session, CaseStudy, payload.slug, exclude_id=case_study_id)
            values = _editable_values(payload, problem, solution)
            values["updated_at"] = now
            await repository.update(session, row, values)
            await publishing.touch(session, now=now)
            return await _load_detail(session, case_study_id)
    except IntegrityError as exc:
        raise_if_slug_violation(exc, "case_studies")
        raise


async def delete_case_study(session: AsyncSession, case_study_id: uuid.UUID) -> None:
    async with session.begin():
        if not await repository.delete(session, case_study_id):
            raise NotFoundError(CASE_STUDY_NOT_FOUND)
        await publishing.touch(session)


async def reorder_case_studies(session: AsyncSession, ids: Sequence[uuid.UUID]) -> None:
    async with session.begin():
        await ordering.reorder(session, Scope(CaseStudy), ids)
        await publishing.touch(session)


async def _require_parent(session: AsyncSession, case_study_id: uuid.UUID) -> None:
    """Lock the parent row so nested position writes are serialised per case study; 404 when it does not exist."""
    if await repository.get_for_update(session, case_study_id) is None:
        raise NotFoundError(CASE_STUDY_NOT_FOUND)


# ---------------------------------------------------------------------------------------------- results


def _result_values(payload: CaseStudyResultInput) -> dict[str, Any]:
    return {
        "metric_label": payload.metric_label,
        "value": payload.value,
        "before_value": payload.before_value,
        "change_text": payload.change_text,
        "period": payload.period,
        "is_sample": payload.is_sample,
    }


async def create_result(
    session: AsyncSession, case_study_id: uuid.UUID, payload: CaseStudyResultInput
) -> AdminCaseStudyResult:
    async with session.begin():
        await _require_parent(session, case_study_id)
        values = _result_values(payload)
        values["case_study_id"] = case_study_id
        values["position"] = await ordering.next_position(session, _results_scope(case_study_id))
        row = await repository.insert_result(session, values)
        await publishing.touch(session)
        await session.refresh(row)
        return _result_out(row)


async def update_result(
    session: AsyncSession, case_study_id: uuid.UUID, result_id: uuid.UUID, payload: CaseStudyResultInput
) -> AdminCaseStudyResult:
    now = datetime.now(UTC)
    async with session.begin():
        row = await repository.get_result(session, case_study_id, result_id)
        if row is None:
            raise NotFoundError(RESULT_NOT_FOUND)
        values = _result_values(payload)
        values["updated_at"] = now
        await repository.update_result(session, row, values)
        await publishing.touch(session, now=now)
        return _result_out(row)


async def delete_result(session: AsyncSession, case_study_id: uuid.UUID, result_id: uuid.UUID) -> None:
    async with session.begin():
        if not await repository.delete_result(session, case_study_id, result_id):
            raise NotFoundError(RESULT_NOT_FOUND)
        await publishing.touch(session)


async def reorder_results(session: AsyncSession, case_study_id: uuid.UUID, ids: Sequence[uuid.UUID]) -> None:
    async with session.begin():
        await _require_parent(session, case_study_id)
        await ordering.reorder(session, _results_scope(case_study_id), ids)
        await publishing.touch(session)


# ---------------------------------------------------------------------------------------------- images


def _image_values(payload: CaseStudyImageInput) -> dict[str, Any]:
    return {"media_id": payload.media_id, "alt": payload.alt, "caption": payload.caption, "layout": payload.layout}


async def _image_detail(session: AsyncSession, case_study_id: uuid.UUID, image_id: uuid.UUID) -> AdminCaseStudyImage:
    row = await repository.get_image(session, case_study_id, image_id)
    if row is None:
        raise NotFoundError(IMAGE_NOT_FOUND)
    return _image_out(row)


async def create_image(
    session: AsyncSession, case_study_id: uuid.UUID, payload: CaseStudyImageInput
) -> AdminCaseStudyImage:
    async with session.begin():
        await _require_parent(session, case_study_id)
        await ensure_media_exists(session, payload.media_id, "media_id")
        values = _image_values(payload)
        values["case_study_id"] = case_study_id
        values["position"] = await ordering.next_position(session, _images_scope(case_study_id))
        row = await repository.insert_image(session, values)
        await publishing.touch(session)
        return await _image_detail(session, case_study_id, row.id)


async def update_image(
    session: AsyncSession, case_study_id: uuid.UUID, image_id: uuid.UUID, payload: CaseStudyImageInput
) -> AdminCaseStudyImage:
    now = datetime.now(UTC)
    async with session.begin():
        row = await repository.get_image(session, case_study_id, image_id)
        if row is None:
            raise NotFoundError(IMAGE_NOT_FOUND)
        await ensure_media_exists(session, payload.media_id, "media_id")
        values = _image_values(payload)
        values["updated_at"] = now
        await repository.update_image(session, row, values)
        await publishing.touch(session, now=now)
        return await _image_detail(session, case_study_id, image_id)


async def delete_image(session: AsyncSession, case_study_id: uuid.UUID, image_id: uuid.UUID) -> None:
    """Removes the gallery entry only; the media asset and its files are kept (TS-011)."""
    async with session.begin():
        if not await repository.delete_image(session, case_study_id, image_id):
            raise NotFoundError(IMAGE_NOT_FOUND)
        await publishing.touch(session)


async def reorder_images(session: AsyncSession, case_study_id: uuid.UUID, ids: Sequence[uuid.UUID]) -> None:
    async with session.begin():
        await _require_parent(session, case_study_id)
        await ordering.reorder(session, _images_scope(case_study_id), ids)
        await publishing.touch(session)
