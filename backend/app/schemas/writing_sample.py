"""Admin writing-sample schemas (BE-014, TS-010, TS-012; contract ``WritingSampleInput``,
``AdminWritingSampleListItem``, ``AdminWritingSample``).

``body_html``, ``word_count`` and ``reading_time_min`` are computed from ``body_md`` on every save and never accepted
as input (``extra="forbid"``).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from app.schemas.base import (
    InputModel,
    MarkdownText,
    MultiLine,
    SingleLine,
    Slug,
    StringList,
    alt_for_media,
    optional_text,
)
from app.schemas.common import AdminMeta
from app.schemas.enums import WritingFormat
from app.schemas.images import ImageRef

WRITING_MARKDOWN_MAX = 100_000


class WritingSampleInput(InputModel):
    slug: Slug
    title: Annotated[SingleLine, Field(min_length=1, max_length=120)]
    format: WritingFormat
    client_name: Annotated[SingleLine, Field(max_length=120)] | None
    industry: Annotated[SingleLine, Field(max_length=80)] | None
    excerpt: Annotated[MultiLine, Field(min_length=1, max_length=600)]
    body_md: Annotated[MarkdownText, Field(min_length=1, max_length=WRITING_MARKDOWN_MAX)]
    published_on: date
    tags: StringList
    thumbnail_media_id: uuid.UUID | None
    thumbnail_alt: Annotated[SingleLine, Field(max_length=250)] | None = Field(
        description="Required (non-blank) when thumbnail_media_id is set"
    )
    is_featured: bool
    is_published: bool
    is_sample: bool

    @field_validator("client_name", "industry")
    @classmethod
    def _empty_is_null(cls, value: str | None) -> str | None:
        return optional_text(value)

    @field_validator("thumbnail_alt")
    @classmethod
    def _alt_required_with_thumbnail(cls, value: str | None, info: ValidationInfo) -> str | None:
        return alt_for_media(info.data.get("thumbnail_media_id"), value)


class AdminWritingSampleListItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    format: WritingFormat
    is_published: bool
    is_sample: bool
    position: int
    updated_at: datetime


class AdminWritingSample(AdminMeta):
    slug: str
    title: str
    format: WritingFormat
    client_name: str | None
    industry: str | None
    excerpt: str
    body_md: str
    published_on: date
    tags: list[str]
    thumbnail_media_id: uuid.UUID | None
    thumbnail_alt: str | None
    is_featured: bool
    is_published: bool
    is_sample: bool
    body_html: str
    word_count: int = Field(ge=0)
    reading_time_min: int = Field(ge=1)
    thumbnail: ImageRef | None
