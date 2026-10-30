"""Existence checks by primary key (used by ``services/references.py``)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def row_exists(session: AsyncSession, model: Any, row_id: uuid.UUID) -> bool:
    """True when the row exists; it is then locked ``FOR SHARE`` until the caller's transaction ends.

    The share lock keeps a concurrent delete (which locks the row ``FOR UPDATE`` first) from removing the row between
    this check and the caller's insert/update of the referencing foreign key, so the FK can never fail with a 500.
    """
    statement = select(model.id).where(model.id == row_id).with_for_update(read=True)
    return (await session.execute(statement)).first() is not None
