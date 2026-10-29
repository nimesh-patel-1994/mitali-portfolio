"""Media assets (tech-spec section 3.3, SD-008, SEC-BE-012)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import JSONB_EMPTY_ARRAY, Base, UUIDPrimaryKeyMixin, jsonb_array, max_length, one_of

MEDIA_MIME_TYPES = ("image/webp", "image/svg+xml")
MEDIA_SOURCES = ("upload", "seed")

# Relative path below MEDIA_ROOT: safe characters only, no leading "/" or "\", no drive letter or ":", no "..".
MEDIA_PATH_PATTERN = "^[A-Za-z0-9_][A-Za-z0-9_./-]*$"


class MediaAsset(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "media_assets"

    path: Mapped[str] = mapped_column(unique=True)
    variants: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    mime: Mapped[str]
    width: Mapped[int]
    height: Mapped[int]
    bytes: Mapped[int]
    original_filename: Mapped[str | None]
    alt: Mapped[str | None]
    source: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            f"path ~ '{MEDIA_PATH_PATTERN}' AND strpos(path, '..') = 0",
            name="path_relative",
        ),
        jsonb_array("variants"),
        one_of("mime", MEDIA_MIME_TYPES),
        max_length("original_filename", 200),
        max_length("alt", 250),
        one_of("source", MEDIA_SOURCES),
    )


Index("ix_media_assets_created_at", MediaAsset.created_at.desc())
