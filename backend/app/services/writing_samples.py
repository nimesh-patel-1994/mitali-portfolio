"""Admin writing samples (BE-014, TS-010, TS-012, REQ-064, REQ-067).

``body_html``, ``word_count`` and ``reading_time_min`` come from ``render_markdown(body_md)`` on every save (run in the
threadpool); the thumbnail must exist; slug rules as for case studies (409 ``slug_taken``).
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Final, cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.errors import NotFoundError
from app.models import WritingSample
from app.repositories import writing_samples as repository
from app.schemas.enums import WritingFormat
from app.schemas.writing_sample import AdminWritingSample, AdminWritingSampleListItem, WritingSampleInput
from app.services import ordering, publishing
from app.services.image_refs import image_ref
from app.services.markdown import RenderedMarkdown, render_markdown
from app.services.ordering import Scope
from app.services.references import ensure_media_exists
from app.services.slugs import ensure_slug_available, raise_if_slug_violation

NOT_FOUND: Final = "Writing sample not found."


def _format(value: str) -> WritingFormat:
    # The CHECK constraint guarantees one of the six values; the response model validates it again.
    return cast(WritingFormat, value)


def _list_item(row: WritingSample) -> AdminWritingSampleListItem:
    return AdminWritingSampleListItem(
        id=row.id,
        slug=row.slug,
        title=row.title,
        format=_format(row.format),
        is_published=row.is_published,
        is_sample=row.is_sample,
        position=row.position,
        updated_at=row.updated_at,
    )


def _detail(row: WritingSample) -> AdminWritingSample:
    return AdminWritingSample(
        id=row.id,
        position=row.position,
        created_at=row.created_at,
        updated_at=row.updated_at,
        slug=row.slug,
        title=row.title,
        format=_format(row.format),
        client_name=row.client_name,
        industry=row.industry,
        excerpt=row.excerpt,
        body_md=row.body_md,
        published_on=row.published_on,
        tags=list(row.tags),
        thumbnail_media_id=row.thumbnail_media_id,
        thumbnail_alt=row.thumbnail_alt,
        is_featured=row.is_featured,
        is_published=row.is_published,
        is_sample=row.is_sample,
        body_html=row.body_html,
        word_count=row.word_count,
        reading_time_min=row.reading_time_min,
        thumbnail=image_ref(row.thumbnail_media, row.thumbnail_alt),
    )


async def _load_detail(session: AsyncSession, sample_id: uuid.UUID) -> AdminWritingSample:
    row = await repository.get_detail(session, sample_id)
    if row is None:
        raise NotFoundError(NOT_FOUND)
    return _detail(row)


def _values(payload: WritingSampleInput, body: RenderedMarkdown) -> dict[str, Any]:
    return {
        "slug": payload.slug,
        "title": payload.title,
        "format": payload.format,
        "client_name": payload.client_name,
        "industry": payload.industry,
        "excerpt": payload.excerpt,
        "body_md": payload.body_md,
        "body_html": body.html,
        "word_count": body.word_count,
        "reading_time_min": body.reading_time_min,
        "published_on": payload.published_on,
        "tags": list(payload.tags),
        "thumbnail_media_id": payload.thumbnail_media_id,
        "thumbnail_alt": payload.thumbnail_alt,
        "is_featured": payload.is_featured,
        "is_published": payload.is_published,
        "is_sample": payload.is_sample,
    }


async def list_writing_samples(
    session: AsyncSession, *, writing_format: WritingFormat | None = None
) -> list[AdminWritingSampleListItem]:
    async with session.begin():
        return [_list_item(row) for row in await repository.list_all(session, writing_format=writing_format)]


async def get_writing_sample(session: AsyncSession, sample_id: uuid.UUID) -> AdminWritingSample:
    async with session.begin():
        return await _load_detail(session, sample_id)


async def create_writing_sample(session: AsyncSession, payload: WritingSampleInput) -> AdminWritingSample:
    body = await run_in_threadpool(render_markdown, payload.body_md)
    now = datetime.now(UTC)
    try:
        async with session.begin():
            await ensure_media_exists(session, payload.thumbnail_media_id, "thumbnail_media_id")
            await ensure_slug_available(session, WritingSample, payload.slug)
            values = _values(payload, body)
            values["position"] = await ordering.next_position(session, Scope(WritingSample))
            row = await repository.insert(session, values)
            await publishing.touch(session, now=now)
            return await _load_detail(session, row.id)
    except IntegrityError as exc:
        raise_if_slug_violation(exc, "writing_samples")
        raise


async def update_writing_sample(
    session: AsyncSession, sample_id: uuid.UUID, payload: WritingSampleInput
) -> AdminWritingSample:
    body = await run_in_threadpool(render_markdown, payload.body_md)
    now = datetime.now(UTC)
    try:
        async with session.begin():
            row = await repository.get_for_update(session, sample_id)
            if row is None:
                raise NotFoundError(NOT_FOUND)
            await ensure_media_exists(session, payload.thumbnail_media_id, "thumbnail_media_id")
            await ensure_slug_available(session, WritingSample, payload.slug, exclude_id=sample_id)
            values = _values(payload, body)
            values["updated_at"] = now
            await repository.update(session, row, values)
            await publishing.touch(session, now=now)
            return await _load_detail(session, sample_id)
    except IntegrityError as exc:
        raise_if_slug_violation(exc, "writing_samples")
        raise


async def delete_writing_sample(session: AsyncSession, sample_id: uuid.UUID) -> None:
    async with session.begin():
        if not await repository.delete(session, sample_id):
            raise NotFoundError(NOT_FOUND)
        await publishing.touch(session)


async def reorder_writing_samples(session: AsyncSession, ids: Sequence[uuid.UUID]) -> None:
    async with session.begin():
        await ordering.reorder(session, Scope(WritingSample), ids)
        await publishing.touch(session)
