"""Singleton rows ``profile`` and ``site_settings`` (tech-spec section 3.2).

Both rows (``id = 1``) are inserted by migration ``0001_initial_schema`` with the placeholder values below; the
migration keeps its own frozen copy and a unit test checks that the two stay equal.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Final

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import JSONB_EMPTY_ARRAY, Base, alt_required_with, jsonb_array, max_length

if TYPE_CHECKING:
    from app.models.media import MediaAsset

SINGLETON_ID: Final = 1

PROFILE_PLACEHOLDER: Final[dict[str, Any]] = {
    "name": "Your name",
    "headline": "Add your headline in the admin",
    "bio": ["Add a short bio in the admin."],
    "skills": [],
    "tools": [],
    "years_experience": None,
    "origin_statement": "Add your origin statement in the admin.",
    "vision_blocks": [
        {"heading": "Vision", "body": "Add your vision in the admin."},
        {"heading": "Mission", "body": "Add your mission in the admin."},
    ],
}

SETTINGS_PLACEHOLDER: Final[dict[str, Any]] = {
    "contact_email": "hello@example.com",
    "booking_url": None,
    "social_links": [],
    "footer_signoff": "Add a footer sign-off in the admin",
    "notification_email": None,
}


def _singleton_id() -> Mapped[int]:
    return mapped_column(SmallInteger, primary_key=True, server_default=text("1"), autoincrement=False)


class Profile(Base):
    __tablename__ = "profile"

    id: Mapped[int] = _singleton_id()
    name: Mapped[str]
    headline: Mapped[str]
    bio: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    skills: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    tools: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    years_experience: Mapped[int | None] = mapped_column(SmallInteger)
    origin_statement: Mapped[str]
    vision_blocks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    portrait_media_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="RESTRICT"))
    portrait_alt: Mapped[str | None]
    seed_key: Mapped[str | None] = mapped_column(unique=True)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Read-only helper for eager loading (``selectinload``); lazy loading is refused in async code.
    portrait_media: Mapped[MediaAsset | None] = relationship(
        foreign_keys=[portrait_media_id], lazy="raise", viewonly=True
    )

    __table_args__ = (
        CheckConstraint("id = 1", name="singleton"),
        max_length("headline", 160),
        jsonb_array("bio"),
        jsonb_array("skills"),
        jsonb_array("tools"),
        CheckConstraint("years_experience BETWEEN 0 AND 60", name="years_experience_range"),
        max_length("origin_statement", 600),
        CheckConstraint(
            "CASE WHEN jsonb_typeof(vision_blocks) = 'array' THEN jsonb_array_length(vision_blocks) = 2 ELSE false END",
            name="vision_blocks_two",
        ),
        alt_required_with("portrait_media_id", "portrait_alt"),
    )


class SiteSettings(Base):
    __tablename__ = "site_settings"

    id: Mapped[int] = _singleton_id()
    contact_email: Mapped[str]
    booking_url: Mapped[str | None]
    social_links: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    footer_signoff: Mapped[str]
    notification_email: Mapped[str | None]
    content_changed_at: Mapped[datetime] = mapped_column(server_default=func.now())
    seed_key: Mapped[str | None] = mapped_column(unique=True)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        CheckConstraint("id = 1", name="singleton"),
        jsonb_array("social_links"),
        max_length("footer_signoff", 120),
    )
