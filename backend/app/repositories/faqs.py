"""Admin data access for FAQ categories and FAQs (BE-016).

Category lists carry their FAQ count from one grouped subquery (no N+1). FAQ lists are ordered by category position,
then FAQ position (``created_at`` breaks ties at both levels).
"""

from __future__ import annotations

import uuid
from typing import Any, Final

from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Faq, FaqCategory
from app.repositories import crud

CATEGORY_COLUMNS: Final = frozenset({"name", "is_published", "position", "updated_at"})
FAQ_COLUMNS: Final = frozenset(
    {"category_id", "question", "answer", "show_in_preview", "is_published", "position", "updated_at"}
)


def _faq_counts() -> Any:
    return (
        select(Faq.category_id, func.count(Faq.id).label("faq_count")).group_by(Faq.category_id).subquery("faq_counts")
    )


async def list_categories(session: AsyncSession) -> list[tuple[FaqCategory, int]]:
    counts = _faq_counts()
    statement = (
        select(FaqCategory, func.coalesce(counts.c.faq_count, 0))
        .outerjoin(counts, counts.c.category_id == FaqCategory.id)
        .order_by(FaqCategory.position, FaqCategory.created_at)
    )
    return [(row[0], int(row[1])) for row in (await session.execute(statement)).all()]


async def get_category(
    session: AsyncSession, category_id: uuid.UUID, *, for_update: bool = False
) -> FaqCategory | None:
    row: FaqCategory | None = await crud.get_by_id(session, FaqCategory, category_id, for_update=for_update)
    return row


async def count_faqs(session: AsyncSession, category_id: uuid.UUID) -> int:
    statement = select(func.count(Faq.id)).where(Faq.category_id == category_id)
    return int((await session.execute(statement)).scalar_one())


async def category_name_in_use(session: AsyncSession, name: str, *, exclude_id: uuid.UUID | None = None) -> bool:
    condition = FaqCategory.name == name
    if exclude_id is not None:
        condition = condition & (FaqCategory.id != exclude_id)
    return bool((await session.execute(select(exists().where(condition)))).scalar())


async def insert_category(session: AsyncSession, values: dict[str, Any]) -> FaqCategory:
    row: FaqCategory = await crud.insert(session, FaqCategory, values, CATEGORY_COLUMNS)
    await session.refresh(row)
    return row


async def update_category(session: AsyncSession, row: FaqCategory, values: dict[str, Any]) -> None:
    await crud.apply_update(row, values, CATEGORY_COLUMNS, session)


async def delete_category(session: AsyncSession, category_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(session, FaqCategory, category_id)


# ---------------------------------------------------------------------------------------------- FAQs


async def list_faqs(session: AsyncSession, *, category_id: uuid.UUID | None = None) -> list[Faq]:
    statement = select(Faq).join(FaqCategory, FaqCategory.id == Faq.category_id)
    if category_id is not None:
        statement = statement.where(Faq.category_id == category_id)
    statement = statement.order_by(FaqCategory.position, FaqCategory.created_at, Faq.position, Faq.created_at)
    return list((await session.execute(statement)).scalars().all())


async def get_faq(session: AsyncSession, faq_id: uuid.UUID, *, for_update: bool = False) -> Faq | None:
    row: Faq | None = await crud.get_by_id(session, Faq, faq_id, for_update=for_update)
    return row


async def insert_faq(session: AsyncSession, values: dict[str, Any]) -> Faq:
    row: Faq = await crud.insert(session, Faq, values, FAQ_COLUMNS)
    await session.refresh(row)
    return row


async def update_faq(session: AsyncSession, row: Faq, values: dict[str, Any]) -> None:
    await crud.apply_update(row, values, FAQ_COLUMNS, session)


async def delete_faq(session: AsyncSession, faq_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(session, Faq, faq_id)
