"""``enquiries`` data access: insert from the contact form (BE-007) and admin management (BE-020).

The admin list is ordered ``created_at DESC, id`` and filtered by status through the ``(status, created_at DESC)``
index. Enquiry values are personal data: they are never logged here.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Enquiry
from app.repositories import crud


async def insert(
    session: AsyncSession,
    *,
    name: str,
    email: str,
    company: str | None,
    enquiry_type: str,
    budget_range: str | None,
    message: str,
) -> Enquiry:
    row = Enquiry(
        name=name,
        email=email,
        company=company,
        enquiry_type=enquiry_type,
        budget_range=budget_range,
        message=message,
        status="new",
    )
    session.add(row)
    await session.flush()
    return row


async def list_page(session: AsyncSession, *, status: str | None, offset: int, limit: int) -> tuple[list[Enquiry], int]:
    filters = (Enquiry.status == status,) if status is not None else ()
    total = int((await session.execute(select(func.count(Enquiry.id)).where(*filters))).scalar_one())
    if offset >= total:  # past the last page: empty page, no second query
        return [], total
    statement = (
        select(Enquiry).where(*filters).order_by(Enquiry.created_at.desc(), Enquiry.id).offset(offset).limit(limit)
    )
    return list((await session.execute(statement)).scalars().all()), total


async def get(session: AsyncSession, enquiry_id: uuid.UUID, *, for_update: bool = False) -> Enquiry | None:
    row: Enquiry | None = await crud.get_by_id(session, Enquiry, enquiry_id, for_update=for_update)
    return row


async def set_status(session: AsyncSession, row: Enquiry, *, status: str, moment: datetime) -> None:
    row.status = status
    row.status_changed_at = moment
    row.updated_at = moment
    await session.flush()


async def delete(session: AsyncSession, enquiry_id: uuid.UUID) -> bool:
    return await crud.delete_by_id(session, Enquiry, enquiry_id)
