"""One generic service for the five simple content types (BE-015, TS-010): services, engagement models,
testimonials, values (table ``core_values``) and process steps.

Each type is a ``ContentType`` description (model, editable fields, output schema, optional reference check); the
CRUD + order pattern is shared: create appends at ``max(position) + 1``, update replaces the editable fields and sets
``updated_at``, delete is 204/404, reorder needs the exact id set; every mutation calls ``publishing.touch()`` in the
same transaction.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Final

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models import CoreValue, EngagementModel, ProcessStep, Service, Testimonial
from app.repositories import simple_content as repository
from app.schemas.simple_content import (
    AdminCoreValue,
    AdminEngagementModel,
    AdminProcessStep,
    AdminService,
    AdminTestimonial,
    TestimonialInput,
)
from app.services import ordering, publishing
from app.services.ordering import Scope
from app.services.references import ensure_case_study_exists

Check = Callable[[AsyncSession, Any], Awaitable[None]]


@dataclass(frozen=True)
class ContentType[OutT: BaseModel]:
    model: Any
    fields: tuple[str, ...]  # editable fields, copied explicitly from the input model
    output: type[OutT]
    not_found: str
    check: Check | None = None
    list_fields: frozenset[str] = frozenset()  # jsonb string lists (copied as plain lists)

    def values(self, payload: BaseModel) -> dict[str, Any]:
        values: dict[str, Any] = {}
        for name in self.fields:
            value = getattr(payload, name)
            values[name] = list(value) if name in self.list_fields else value
        return values

    def out(self, row: Any) -> OutT:
        return self.output.model_validate(row, from_attributes=True)


async def _check_testimonial(session: AsyncSession, payload: Any) -> None:
    if isinstance(payload, TestimonialInput):
        await ensure_case_study_exists(session, payload.case_study_id, "case_study_id")


SERVICES: Final = ContentType(
    model=Service,
    fields=("name", "description", "deliverables", "is_published"),
    output=AdminService,
    not_found="Service not found.",
    list_fields=frozenset({"deliverables"}),
)
ENGAGEMENT_MODELS: Final = ContentType(
    model=EngagementModel,
    fields=("name", "description", "features", "cta_label", "cta_target", "is_published"),
    output=AdminEngagementModel,
    not_found="Engagement model not found.",
    list_fields=frozenset({"features"}),
)
TESTIMONIALS: Final = ContentType(
    model=Testimonial,
    fields=("quote", "author_name", "author_role", "company", "case_study_id", "is_published"),
    output=AdminTestimonial,
    not_found="Testimonial not found.",
    check=_check_testimonial,
)
VALUES: Final = ContentType(
    model=CoreValue, fields=("title", "body", "is_published"), output=AdminCoreValue, not_found="Value not found."
)
PROCESS_STEPS: Final = ContentType(
    model=ProcessStep,
    fields=("title", "body", "is_published"),
    output=AdminProcessStep,
    not_found="Process step not found.",
)


async def list_items[OutT: BaseModel](session: AsyncSession, kind: ContentType[OutT]) -> list[OutT]:
    async with session.begin():
        return [kind.out(row) for row in await repository.list_all(session, kind.model)]


async def get_item[OutT: BaseModel](session: AsyncSession, kind: ContentType[OutT], item_id: uuid.UUID) -> OutT:
    async with session.begin():
        row = await repository.get(session, kind.model, item_id)
        if row is None:
            raise NotFoundError(kind.not_found)
        return kind.out(row)


async def create_item[OutT: BaseModel](session: AsyncSession, kind: ContentType[OutT], payload: BaseModel) -> OutT:
    async with session.begin():
        if kind.check is not None:
            await kind.check(session, payload)
        values = kind.values(payload)
        values["position"] = await ordering.next_position(session, Scope(kind.model))
        row = await repository.insert(session, kind.model, values)
        await publishing.touch(session)
        return kind.out(row)


async def update_item[OutT: BaseModel](
    session: AsyncSession, kind: ContentType[OutT], item_id: uuid.UUID, payload: BaseModel
) -> OutT:
    now = datetime.now(UTC)
    async with session.begin():
        row = await repository.get(session, kind.model, item_id, for_update=True)
        if row is None:
            raise NotFoundError(kind.not_found)
        if kind.check is not None:
            await kind.check(session, payload)
        values = kind.values(payload)
        values["updated_at"] = now
        await repository.update(session, row, values)
        await publishing.touch(session, now=now)
        return kind.out(row)


async def delete_item[OutT: BaseModel](session: AsyncSession, kind: ContentType[OutT], item_id: uuid.UUID) -> None:
    async with session.begin():
        if not await repository.delete(session, kind.model, item_id):
            raise NotFoundError(kind.not_found)
        await publishing.touch(session)


async def reorder_items[OutT: BaseModel](
    session: AsyncSession, kind: ContentType[OutT], ids: Sequence[uuid.UUID]
) -> None:
    async with session.begin():
        await ordering.reorder(session, Scope(kind.model), ids)
        await publishing.touch(session)
