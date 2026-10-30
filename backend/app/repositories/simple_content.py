"""Data access for the five simple content types (BE-015): services, engagement models, testimonials, core values
and process steps. Writable columns per model are listed explicitly (no mass assignment)."""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Any, Final

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CoreValue, EngagementModel, ProcessStep, Service, Testimonial
from app.repositories import crud

_COMMON: Final = frozenset({"is_published", "position", "updated_at"})

WRITABLE_COLUMNS: Final[dict[type[Any], frozenset[str]]] = {
    Service: _COMMON | {"name", "description", "deliverables"},
    EngagementModel: _COMMON | {"name", "description", "features", "cta_label", "cta_target"},
    Testimonial: _COMMON | {"quote", "author_name", "author_role", "company", "case_study_id"},
    CoreValue: _COMMON | {"title", "body"},
    ProcessStep: _COMMON | {"title", "body"},
}


async def list_all(session: AsyncSession, model: Any) -> list[Any]:
    return await crud.list_ordered(session, model)


async def get(session: AsyncSession, model: Any, row_id: uuid.UUID, *, for_update: bool = False) -> Any | None:
    return await crud.get_by_id(session, model, row_id, for_update=for_update)


async def insert(session: AsyncSession, model: Any, values: Mapping[str, Any]) -> Any:
    row = await crud.insert(session, model, values, WRITABLE_COLUMNS[model])
    await session.refresh(row)  # server defaults (created_at, updated_at)
    return row


async def update(session: AsyncSession, row: Any, values: Mapping[str, Any]) -> None:
    await crud.apply_update(row, values, WRITABLE_COLUMNS[type(row)], session)


async def delete(session: AsyncSession, model: Any, row_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(session, model, row_id)
