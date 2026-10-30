"""Admin FAQ categories and FAQs (BE-016, TS-010 points 4-5, REQ-064, REQ-006).

* Deleting a category that still has FAQs → 409 ``category_not_empty`` (also when the FK ``RESTRICT`` fires because
  an FAQ was added concurrently).
* Duplicate category name → 422 ``validation_error`` with ``fields.name`` (backend-scope open question BQ-1 default;
  the contract has no dedicated code).
* FAQ positions are scoped per category; moving an FAQ to another category appends it at the end of the target.
* Unknown ``category_id`` on create/update → 422 ``fields.category_id``; reorder of an unknown category → 404.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any, Final

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import CategoryNotEmptyError, NotFoundError, ValidationFailedError
from app.models import Faq, FaqCategory
from app.repositories import faqs as repository
from app.repositories.integrity import FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION, constraint_name, sqlstate
from app.schemas.faq import AdminFaq, AdminFaqCategory, FaqCategoryInput, FaqInput
from app.services import ordering, publishing
from app.services.ordering import Scope

CATEGORY_NOT_FOUND: Final = "FAQ category not found."
FAQ_NOT_FOUND: Final = "FAQ not found."
NAME_TAKEN: Final = "A category with this name already exists."
UNKNOWN_CATEGORY: Final = "This category does not exist."


def _faq_scope(category_id: uuid.UUID) -> Scope:
    return Scope(Faq, (Faq.category_id == category_id,))


def _category_out(row: FaqCategory, faq_count: int) -> AdminFaqCategory:
    return AdminFaqCategory(
        id=row.id,
        position=row.position,
        created_at=row.created_at,
        updated_at=row.updated_at,
        name=row.name,
        is_published=row.is_published,
        faq_count=faq_count,
    )


def _faq_out(row: Faq) -> AdminFaq:
    return AdminFaq.model_validate(row, from_attributes=True)


def _raise_if_name_violation(exc: IntegrityError) -> None:
    if sqlstate(exc) == UNIQUE_VIOLATION and constraint_name(exc) == "uq_faq_categories_name":
        raise ValidationFailedError(fields={"name": NAME_TAKEN}) from None


async def _ensure_name_available(session: AsyncSession, name: str, *, exclude_id: uuid.UUID | None = None) -> None:
    if await repository.category_name_in_use(session, name, exclude_id=exclude_id):
        raise ValidationFailedError(fields={"name": NAME_TAKEN})


async def _ensure_category(session: AsyncSession, category_id: uuid.UUID) -> None:
    if await repository.get_category(session, category_id) is None:
        raise ValidationFailedError(fields={"category_id": UNKNOWN_CATEGORY})


# ---------------------------------------------------------------------------------------------- categories


async def list_categories(session: AsyncSession) -> list[AdminFaqCategory]:
    async with session.begin():
        return [_category_out(row, count) for row, count in await repository.list_categories(session)]


async def get_category(session: AsyncSession, category_id: uuid.UUID) -> AdminFaqCategory:
    async with session.begin():
        row = await repository.get_category(session, category_id)
        if row is None:
            raise NotFoundError(CATEGORY_NOT_FOUND)
        return _category_out(row, await repository.count_faqs(session, category_id))


async def create_category(session: AsyncSession, payload: FaqCategoryInput) -> AdminFaqCategory:
    try:
        async with session.begin():
            await _ensure_name_available(session, payload.name)
            values: dict[str, Any] = {"name": payload.name, "is_published": payload.is_published}
            values["position"] = await ordering.next_position(session, Scope(FaqCategory))
            row = await repository.insert_category(session, values)
            await publishing.touch(session)
            return _category_out(row, 0)
    except IntegrityError as exc:
        _raise_if_name_violation(exc)
        raise


async def update_category(session: AsyncSession, category_id: uuid.UUID, payload: FaqCategoryInput) -> AdminFaqCategory:
    now = datetime.now(UTC)
    try:
        async with session.begin():
            row = await repository.get_category(session, category_id, for_update=True)
            if row is None:
                raise NotFoundError(CATEGORY_NOT_FOUND)
            await _ensure_name_available(session, payload.name, exclude_id=category_id)
            values = {"name": payload.name, "is_published": payload.is_published, "updated_at": now}
            await repository.update_category(session, row, values)
            await publishing.touch(session, now=now)
            return _category_out(row, await repository.count_faqs(session, category_id))
    except IntegrityError as exc:
        _raise_if_name_violation(exc)
        raise


async def delete_category(session: AsyncSession, category_id: uuid.UUID) -> None:
    try:
        async with session.begin():
            row = await repository.get_category(session, category_id, for_update=True)
            if row is None:
                raise NotFoundError(CATEGORY_NOT_FOUND)
            if await repository.count_faqs(session, category_id) > 0:
                raise CategoryNotEmptyError()
            await repository.delete_category(session, category_id)
            await publishing.touch(session)
    except IntegrityError as exc:
        if sqlstate(exc) == FOREIGN_KEY_VIOLATION:
            raise CategoryNotEmptyError() from None
        raise


async def reorder_categories(session: AsyncSession, ids: Sequence[uuid.UUID]) -> None:
    async with session.begin():
        await ordering.reorder(session, Scope(FaqCategory), ids)
        await publishing.touch(session)


# ---------------------------------------------------------------------------------------------- FAQs


def _faq_values(payload: FaqInput) -> dict[str, Any]:
    return {
        "category_id": payload.category_id,
        "question": payload.question,
        "answer": payload.answer,
        "show_in_preview": payload.show_in_preview,
        "is_published": payload.is_published,
    }


async def list_faqs(session: AsyncSession, *, category_id: uuid.UUID | None = None) -> list[AdminFaq]:
    async with session.begin():
        return [_faq_out(row) for row in await repository.list_faqs(session, category_id=category_id)]


async def get_faq(session: AsyncSession, faq_id: uuid.UUID) -> AdminFaq:
    async with session.begin():
        row = await repository.get_faq(session, faq_id)
        if row is None:
            raise NotFoundError(FAQ_NOT_FOUND)
        return _faq_out(row)


async def create_faq(session: AsyncSession, payload: FaqInput) -> AdminFaq:
    async with session.begin():
        await _ensure_category(session, payload.category_id)
        values = _faq_values(payload)
        values["position"] = await ordering.next_position(session, _faq_scope(payload.category_id))
        row = await repository.insert_faq(session, values)
        await publishing.touch(session)
        return _faq_out(row)


async def update_faq(session: AsyncSession, faq_id: uuid.UUID, payload: FaqInput) -> AdminFaq:
    now = datetime.now(UTC)
    async with session.begin():
        row = await repository.get_faq(session, faq_id, for_update=True)
        if row is None:
            raise NotFoundError(FAQ_NOT_FOUND)
        values = _faq_values(payload)
        if payload.category_id != row.category_id:
            await _ensure_category(session, payload.category_id)
            values["position"] = await ordering.next_position(session, _faq_scope(payload.category_id))
        values["updated_at"] = now
        await repository.update_faq(session, row, values)
        await publishing.touch(session, now=now)
        return _faq_out(row)


async def delete_faq(session: AsyncSession, faq_id: uuid.UUID) -> None:
    async with session.begin():
        if not await repository.delete_faq(session, faq_id):
            raise NotFoundError(FAQ_NOT_FOUND)
        await publishing.touch(session)


async def reorder_faqs(session: AsyncSession, category_id: uuid.UUID, ids: Sequence[uuid.UUID]) -> None:
    async with session.begin():
        if await repository.get_category(session, category_id, for_update=True) is None:
            raise NotFoundError(CATEGORY_NOT_FOUND)
        await ordering.reorder(session, _faq_scope(category_id), ids)
        await publishing.touch(session)
