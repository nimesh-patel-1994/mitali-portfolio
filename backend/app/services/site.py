"""Profile and site settings (BE-019, TS-013, REQ-065).

Input rules live in ``schemas/site.py`` (422 with field paths, nothing saved). The service checks that a portrait
media id exists, writes the editable columns only, sets ``updated_at`` and calls ``publishing.touch()`` in the same
transaction. ``content_changed_at`` is never writable through the API.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Profile, SiteSettings
from app.repositories import site as repository
from app.schemas.site import AdminProfile, AdminSettings, AdminSocialLink, AdminVisionBlock, ProfileInput, SettingsInput
from app.services import publishing
from app.services.image_refs import image_ref
from app.services.references import ensure_media_exists


def _profile_out(row: Profile) -> AdminProfile:
    return AdminProfile(
        name=row.name,
        headline=row.headline,
        bio=list(row.bio),
        skills=list(row.skills),
        tools=list(row.tools),
        years_experience=row.years_experience,
        origin_statement=row.origin_statement,
        vision_blocks=[
            AdminVisionBlock(heading=str(block["heading"]), body=str(block["body"])) for block in row.vision_blocks
        ],
        portrait_media_id=row.portrait_media_id,
        portrait_alt=row.portrait_alt,
        portrait=image_ref(row.portrait_media, row.portrait_alt),
        updated_at=row.updated_at,
    )


def _settings_out(row: SiteSettings) -> AdminSettings:
    return AdminSettings(
        contact_email=row.contact_email,
        booking_url=row.booking_url,
        social_links=[AdminSocialLink(label=str(link["label"]), url=str(link["url"])) for link in row.social_links],
        footer_signoff=row.footer_signoff,
        contact_promise=row.contact_promise,
        footer_rights_line=row.footer_rights_line,
        notification_email=row.notification_email,
        content_changed_at=row.content_changed_at,
        updated_at=row.updated_at,
    )


async def get_profile(session: AsyncSession) -> AdminProfile:
    async with session.begin():
        return _profile_out(await repository.get_profile(session))


async def update_profile(session: AsyncSession, payload: ProfileInput) -> AdminProfile:
    now = datetime.now(UTC)
    async with session.begin():
        await ensure_media_exists(session, payload.portrait_media_id, "portrait_media_id")
        await repository.update_profile(
            session,
            {
                "name": payload.name,
                "headline": payload.headline,
                "bio": list(payload.bio),
                "skills": list(payload.skills),
                "tools": list(payload.tools),
                "years_experience": payload.years_experience,
                "origin_statement": payload.origin_statement,
                "vision_blocks": [{"heading": block.heading, "body": block.body} for block in payload.vision_blocks],
                "portrait_media_id": payload.portrait_media_id,
                "portrait_alt": payload.portrait_alt,
                "updated_at": now,
            },
        )
        await publishing.touch(session, now=now)
        return _profile_out(await repository.get_profile(session))


async def get_settings(session: AsyncSession) -> AdminSettings:
    async with session.begin():
        return _settings_out(await repository.get_settings(session))


async def update_settings(session: AsyncSession, payload: SettingsInput) -> AdminSettings:
    now = datetime.now(UTC)
    async with session.begin():
        await repository.update_settings(
            session,
            {
                "contact_email": payload.contact_email,
                "booking_url": payload.booking_url,
                "social_links": [{"label": link.label, "url": link.url} for link in payload.social_links],
                "footer_signoff": payload.footer_signoff,
                "contact_promise": payload.contact_promise,
                "footer_rights_line": payload.footer_rights_line,
                "notification_email": payload.notification_email,
                "updated_at": now,
            },
        )
        await publishing.touch(session, now=now)
        return _settings_out(await repository.get_settings(session))
