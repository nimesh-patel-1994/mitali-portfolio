"""``admin_users`` data access (BE-008, BE-011)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AdminUser


async def get_by_email(session: AsyncSession, normalised_email: str) -> AdminUser | None:
    statement = select(AdminUser).where(func.lower(AdminUser.email) == normalised_email)
    return (await session.execute(statement)).scalar_one_or_none()


async def get_by_id(session: AsyncSession, admin_id: uuid.UUID) -> AdminUser | None:
    return await session.get(AdminUser, admin_id)


async def get_by_id_for_update(session: AsyncSession, admin_id: uuid.UUID) -> AdminUser | None:
    """Lock the admin row for the rest of the transaction (serialises login completion with password resets)."""
    statement = (
        select(AdminUser)
        .where(AdminUser.id == admin_id)
        .with_for_update()
        # The request session may already hold this row from the reservation step; reload it so a concurrent
        # password reset is seen.
        .execution_options(populate_existing=True)
    )
    return (await session.execute(statement)).scalar_one_or_none()


async def get_single(session: AsyncSession) -> AdminUser | None:
    return (await session.execute(select(AdminUser).limit(1))).scalar_one_or_none()


async def any_exists(session: AsyncSession) -> bool:
    return bool((await session.execute(select(exists().select_from(AdminUser)))).scalar())


async def insert(session: AsyncSession, *, email: str, password_hash: str, now: datetime) -> AdminUser:
    row = AdminUser(email=email, password_hash=password_hash, password_changed_at=now, created_at=now, updated_at=now)
    session.add(row)
    await session.flush()
    return row


async def set_password_hash(
    session: AsyncSession, admin_id: uuid.UUID, password_hash: str, *, now: datetime, changed: bool
) -> None:
    values: dict[str, object] = {"password_hash": password_hash, "updated_at": now}
    if changed:
        values["password_changed_at"] = now
    await session.execute(
        update(AdminUser).where(AdminUser.id == admin_id).values(values).execution_options(synchronize_session=False)
    )


async def set_last_login(session: AsyncSession, admin_id: uuid.UUID, now: datetime) -> None:
    await session.execute(
        update(AdminUser)
        .where(AdminUser.id == admin_id)
        .values(last_login_at=now)
        .execution_options(synchronize_session=False)
    )
