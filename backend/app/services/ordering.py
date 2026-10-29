"""Display order within a scope (BE-012, TS-010 points 1-2, BE-REV-012).

A scope is a model plus filters, e.g. ``Scope(Service)`` (global) or ``Scope(Faq, (Faq.category_id == cid,))``.
``next_position`` appends at ``max(position) + 1`` (0 when empty). ``reorder`` locks the scope rows
(``SELECT ... FOR UPDATE``), requires the exact current id set (no missing, unknown or duplicate ids, else 422
``order_mismatch``) and rewrites positions 0..n-1. Both run inside the caller's transaction; the caller also calls
``publishing.touch()``.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import OrderMismatchError
from app.repositories import ordering as repository


@dataclass(frozen=True)
class Scope:
    model: Any  # an ORM class with ``id`` and ``position`` columns
    filters: tuple[ColumnElement[bool], ...] = field(default_factory=tuple)


async def next_position(session: AsyncSession, scope: Scope) -> int:
    return await repository.max_position_plus_one(session, scope.model, scope.filters)


async def reorder(session: AsyncSession, scope: Scope, ids: Sequence[uuid.UUID]) -> None:
    current = await repository.lock_scope_ids(session, scope.model, scope.filters)
    requested = list(ids)
    if len(requested) != len(set(requested)) or set(requested) != current:
        raise OrderMismatchError()
    await repository.write_positions(session, scope.model, requested)
