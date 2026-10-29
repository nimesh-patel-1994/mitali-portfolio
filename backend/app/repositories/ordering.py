"""Position queries for ordered scopes (used by ``services/ordering.py``)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnElement, bindparam, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession


async def max_position_plus_one(session: AsyncSession, model: Any, filters: Sequence[ColumnElement[bool]]) -> int:
    statement = select(func.coalesce(func.max(model.position), -1) + 1).where(*filters)
    return int((await session.execute(statement)).scalar_one())


async def lock_scope_ids(session: AsyncSession, model: Any, filters: Sequence[ColumnElement[bool]]) -> set[uuid.UUID]:
    statement = select(model.id).where(*filters).with_for_update()
    return set((await session.execute(statement)).scalars().all())


async def write_positions(session: AsyncSession, model: Any, ordered_ids: Sequence[uuid.UUID]) -> None:
    table = model.__table__
    statement = update(table).where(table.c.id == bindparam("row_id")).values(position=bindparam("new_position"))
    await session.execute(
        statement, [{"row_id": row_id, "new_position": index} for index, row_id in enumerate(ordered_ids)]
    )
