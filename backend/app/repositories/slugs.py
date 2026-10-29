"""Slug existence query (used by ``services/slugs.py``)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession


async def slug_in_use(session: AsyncSession, model: Any, slug: str, *, exclude_id: uuid.UUID | None = None) -> bool:
    condition = model.slug == slug
    if exclude_id is not None:
        condition = condition & (model.id != exclude_id)
    return bool((await session.execute(select(exists().where(condition)))).scalar())
