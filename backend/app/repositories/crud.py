"""Generic data access for the admin content types (BE-013..BE-016).

Used by the per-aggregate repositories and ``services/simple_content.py``. Everything is ``select()`` style with
bound parameters; lists are ordered explicitly by ``(position, created_at)``; writes take explicit column lists (no
mass assignment) and flush in the caller's transaction (no commits here).
"""

from __future__ import annotations

import uuid
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import ColumnElement, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.interfaces import LoaderOption


def _checked(model: Any, values: Mapping[str, Any], allowed: frozenset[str]) -> dict[str, Any]:
    unknown = set(values) - allowed
    if unknown:
        raise ValueError(f"{model.__tablename__}: not writable: {sorted(unknown)}")
    return dict(values)


async def list_ordered(
    session: AsyncSession,
    model: Any,
    *,
    filters: Sequence[ColumnElement[bool]] = (),
    options: Sequence[LoaderOption] = (),
) -> list[Any]:
    statement = select(model).where(*filters).options(*options).order_by(model.position, model.created_at)
    return list((await session.execute(statement)).scalars().all())


async def get_by_id(
    session: AsyncSession,
    model: Any,
    row_id: uuid.UUID,
    *,
    filters: Sequence[ColumnElement[bool]] = (),
    options: Sequence[LoaderOption] = (),
    for_update: bool = False,
) -> Any | None:
    statement = (
        select(model).where(model.id == row_id, *filters).options(*options).execution_options(populate_existing=True)
    )
    if for_update:
        statement = statement.with_for_update(of=model)
    return (await session.execute(statement)).scalar_one_or_none()


async def insert(session: AsyncSession, model: Any, values: Mapping[str, Any], allowed: frozenset[str]) -> Any:
    row = model(**_checked(model, values, allowed))
    session.add(row)
    await session.flush()
    return row


async def apply_update(row: Any, values: Mapping[str, Any], allowed: frozenset[str], session: AsyncSession) -> Any:
    for key, value in _checked(type(row), values, allowed).items():
        setattr(row, key, value)
    await session.flush()
    return row


async def delete_by_id(
    session: AsyncSession, model: Any, row_id: uuid.UUID, *, filters: Sequence[ColumnElement[bool]] = ()
) -> bool:
    """Delete one row; ``False`` when no row matched (the caller answers 404)."""
    statement = delete(model).where(model.id == row_id, *filters).returning(model.id)
    deleted = (await session.execute(statement)).scalar_one_or_none()
    return deleted is not None
