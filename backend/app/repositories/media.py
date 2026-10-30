"""``media_assets`` data access (BE-017): insert, paginated list (newest first), reference check, delete."""

from __future__ import annotations

import uuid
from typing import Any, Final

from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CaseStudy, CaseStudyImage, MediaAsset, Profile, WritingSample
from app.repositories import crud

MEDIA_COLUMNS: Final = frozenset(
    {"path", "variants", "mime", "width", "height", "bytes", "original_filename", "alt", "source"}
)


async def insert(session: AsyncSession, values: dict[str, Any]) -> MediaAsset:
    row: MediaAsset = await crud.insert(session, MediaAsset, values, MEDIA_COLUMNS)
    await session.refresh(row)  # created_at (server default)
    return row


async def list_page(session: AsyncSession, *, offset: int, limit: int) -> tuple[list[MediaAsset], int]:
    total = int((await session.execute(select(func.count(MediaAsset.id)))).scalar_one())
    if offset >= total:  # past the last page: empty page, no second query
        return [], total
    statement = (
        select(MediaAsset).order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc()).offset(offset).limit(limit)
    )
    return list((await session.execute(statement)).scalars().all()), total


async def get_for_update(session: AsyncSession, media_id: uuid.UUID) -> MediaAsset | None:
    row: MediaAsset | None = await crud.get_by_id(session, MediaAsset, media_id, for_update=True)
    return row


async def is_referenced(session: AsyncSession, media_id: uuid.UUID) -> bool:
    """True while any cover, gallery image, thumbnail or portrait points at the asset (FK ``RESTRICT`` set)."""
    condition = or_(
        exists().where(CaseStudy.cover_media_id == media_id),
        exists().where(CaseStudyImage.media_id == media_id),
        exists().where(WritingSample.thumbnail_media_id == media_id),
        exists().where(Profile.portrait_media_id == media_id),
    )
    return bool((await session.execute(select(condition))).scalar())


async def delete(session: AsyncSession, media_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(session, MediaAsset, media_id)
