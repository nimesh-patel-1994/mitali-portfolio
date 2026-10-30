"""Admin data access for writing samples (BE-014): all rows incl. unpublished, ordered by ``(position, created_at)``."""

from __future__ import annotations

import uuid
from typing import Any, Final

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import WritingSample
from app.repositories import crud

WRITING_SAMPLE_COLUMNS: Final = frozenset(
    {
        "slug",
        "title",
        "format",
        "client_name",
        "industry",
        "excerpt",
        "body_md",
        "body_html",
        "word_count",
        "reading_time_min",
        "published_on",
        "tags",
        "thumbnail_media_id",
        "thumbnail_alt",
        "is_featured",
        "is_published",
        "is_sample",
        "position",
        "updated_at",
    }
)


async def list_all(session: AsyncSession, *, writing_format: str | None = None) -> list[WritingSample]:
    filters = (WritingSample.format == writing_format,) if writing_format is not None else ()
    return await crud.list_ordered(session, WritingSample, filters=filters)


async def get_detail(session: AsyncSession, sample_id: uuid.UUID) -> WritingSample | None:
    row: WritingSample | None = await crud.get_by_id(
        session, WritingSample, sample_id, options=(selectinload(WritingSample.thumbnail_media),)
    )
    return row


async def get_for_update(session: AsyncSession, sample_id: uuid.UUID) -> WritingSample | None:
    row: WritingSample | None = await crud.get_by_id(session, WritingSample, sample_id, for_update=True)
    return row


async def insert(session: AsyncSession, values: dict[str, Any]) -> WritingSample:
    row: WritingSample = await crud.insert(session, WritingSample, values, WRITING_SAMPLE_COLUMNS)
    return row


async def update(session: AsyncSession, row: WritingSample, values: dict[str, Any]) -> None:
    await crud.apply_update(row, values, WRITING_SAMPLE_COLUMNS, session)


async def delete(session: AsyncSession, sample_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(session, WritingSample, sample_id)
