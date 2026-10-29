"""Existence checks by primary key (used by ``services/references.py``)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession


async def row_exists(session: AsyncSession, model: Any, row_id: uuid.UUID) -> bool:
    return bool((await session.execute(select(exists().where(model.id == row_id)))).scalar())
