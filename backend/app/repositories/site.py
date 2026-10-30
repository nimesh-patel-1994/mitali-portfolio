"""``profile`` and ``site_settings`` singleton rows (BE-019, BE-012 ``publishing.touch``).

Both rows are created by migration ``0001`` (``id = 1``; ``0002`` adds the settings copy fields), so reads never
miss. Updates are explicit column lists
(no mass assignment); reads after an update use ``populate_existing`` so the returned row is current.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Profile, SiteSettings
from app.models.singletons import SINGLETON_ID

PROFILE_COLUMNS = frozenset(
    {
        "name",
        "headline",
        "bio",
        "skills",
        "tools",
        "years_experience",
        "origin_statement",
        "vision_blocks",
        "portrait_media_id",
        "portrait_alt",
        "updated_at",
    }
)
SETTINGS_COLUMNS = frozenset(
    {
        "contact_email",
        "booking_url",
        "social_links",
        "footer_signoff",
        "contact_promise",
        "footer_rights_line",
        "notification_email",
        "updated_at",
    }
)


async def get_profile(session: AsyncSession) -> Profile:
    statement = (
        select(Profile)
        .where(Profile.id == SINGLETON_ID)
        .options(selectinload(Profile.portrait_media))
        .execution_options(populate_existing=True)
    )
    return (await session.execute(statement)).scalar_one()


async def get_settings(session: AsyncSession) -> SiteSettings:
    statement = select(SiteSettings).where(SiteSettings.id == SINGLETON_ID).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


def _checked(values: dict[str, Any], allowed: frozenset[str]) -> dict[str, Any]:
    unknown = set(values) - allowed
    if unknown:
        raise ValueError(f"not writable: {sorted(unknown)}")
    return values


async def update_profile(session: AsyncSession, values: dict[str, Any]) -> None:
    await session.execute(
        update(Profile)
        .where(Profile.id == SINGLETON_ID)
        .values(_checked(values, PROFILE_COLUMNS))
        .execution_options(synchronize_session=False)
    )


async def update_settings(session: AsyncSession, values: dict[str, Any]) -> None:
    await session.execute(
        update(SiteSettings)
        .where(SiteSettings.id == SINGLETON_ID)
        .values(_checked(values, SETTINGS_COLUMNS))
        .execution_options(synchronize_session=False)
    )


async def set_content_changed_at(session: AsyncSession, moment: datetime) -> None:
    await session.execute(
        update(SiteSettings)
        .where(SiteSettings.id == SINGLETON_ID)
        .values(content_changed_at=moment)
        .execution_options(synchronize_session=False)
    )
