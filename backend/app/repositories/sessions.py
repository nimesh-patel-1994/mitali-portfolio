"""``sessions`` data access (BE-008, BE-009). Only SHA-256 hashes of tokens are stored and looked up."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AdminUser, Session


async def insert(
    session: AsyncSession,
    *,
    admin_user_id: uuid.UUID,
    token_hash: bytes,
    csrf_token_hash: bytes,
    now: datetime,
    absolute_expires_at: datetime,
) -> Session:
    row = Session(
        admin_user_id=admin_user_id,
        token_hash=token_hash,
        csrf_token_hash=csrf_token_hash,
        created_at=now,
        last_seen_at=now,
        absolute_expires_at=absolute_expires_at,
    )
    session.add(row)
    await session.flush()
    return row


async def get_with_admin(session: AsyncSession, token_hash: bytes) -> tuple[Session, AdminUser] | None:
    statement = (
        select(Session, AdminUser)
        .join(AdminUser, AdminUser.id == Session.admin_user_id)
        .where(Session.token_hash == token_hash)
    )
    row = (await session.execute(statement)).one_or_none()
    return None if row is None else (row[0], row[1])


async def delete_by_id(session: AsyncSession, session_id: uuid.UUID) -> None:
    await session.execute(delete(Session).where(Session.id == session_id))


async def delete_all_for_admin(session: AsyncSession, admin_user_id: uuid.UUID) -> None:
    await session.execute(delete(Session).where(Session.admin_user_id == admin_user_id))


async def delete_expired_for_admin(
    session: AsyncSession, admin_user_id: uuid.UUID, *, now: datetime, idle_timeout: timedelta
) -> None:
    await session.execute(
        delete(Session).where(
            Session.admin_user_id == admin_user_id,
            or_(Session.absolute_expires_at <= now, Session.last_seen_at <= now - idle_timeout),
        )
    )


async def touch(session: AsyncSession, session_id: uuid.UUID, now: datetime) -> None:
    await session.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(last_seen_at=now)
        .execution_options(synchronize_session=False)
    )


async def set_csrf_hash(session: AsyncSession, session_id: uuid.UUID, csrf_token_hash: bytes) -> None:
    await session.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(csrf_token_hash=csrf_token_hash)
        .execution_options(synchronize_session=False)
    )
