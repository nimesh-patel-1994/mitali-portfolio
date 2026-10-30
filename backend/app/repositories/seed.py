"""Seed upserts (BE-023, TS-017 step 2). PostgreSQL ``INSERT ... ON CONFLICT`` with bound parameters only.

* Content rows: conflict target ``seed_key``. Default mode ``DO NOTHING`` (keeps the admin's edits); ``reset`` mode
  ``DO UPDATE`` back to the seed values. Either way the id of the seeded row is returned.
* Media rows: conflict target ``path`` (``DO UPDATE``; the generated files are deterministic).
* Singletons: plain ``UPDATE`` of row ``id = 1``.
"""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from datetime import datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MediaAsset, Profile, SiteSettings
from app.models.singletons import SINGLETON_ID


async def upsert_by_seed_key(
    session: AsyncSession, model: Any, values: Mapping[str, Any], *, reset: bool, now: datetime
) -> uuid.UUID:
    statement = insert(model).values(**values)
    if reset:
        updates: dict[str, Any] = {key: statement.excluded[key] for key in values if key != "seed_key"}
        updates["updated_at"] = now
        statement = statement.on_conflict_do_update(index_elements=["seed_key"], set_=updates)
    else:
        statement = statement.on_conflict_do_nothing(index_elements=["seed_key"])
    inserted = (await session.execute(statement.returning(model.id))).scalar_one_or_none()
    if inserted is not None:
        return uuid.UUID(str(inserted))
    existing = await session.execute(select(model.id).where(model.seed_key == values["seed_key"]))
    return uuid.UUID(str(existing.scalar_one()))


async def upsert_media(session: AsyncSession, values: Mapping[str, Any]) -> uuid.UUID:
    statement = insert(MediaAsset).values(**values)
    updates = {key: statement.excluded[key] for key in values if key != "path"}
    upsert = statement.on_conflict_do_update(index_elements=["path"], set_=updates).returning(MediaAsset.id)
    return uuid.UUID(str((await session.execute(upsert)).scalar_one()))


async def get_profile(session: AsyncSession) -> Profile:
    statement = select(Profile).where(Profile.id == SINGLETON_ID).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


async def get_settings(session: AsyncSession) -> SiteSettings:
    statement = select(SiteSettings).where(SiteSettings.id == SINGLETON_ID).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


async def update_singleton(session: AsyncSession, model: Any, values: Mapping[str, Any]) -> None:
    await session.execute(
        update(model)
        .where(model.id == SINGLETON_ID)
        .values(**values, updated_at=func.now())
        .execution_options(synchronize_session=False)
    )


async def count_rows(session: AsyncSession, model: Any) -> int:
    return int((await session.execute(select(func.count()).select_from(model))).scalar_one())
