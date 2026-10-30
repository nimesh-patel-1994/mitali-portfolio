"""Admin case-study schemas (BE-013, TS-010; contract ``CaseStudyInput``, ``AdminCaseStudyListItem``,
``AdminCaseStudy``, ``CaseStudyResultInput``, ``AdminCaseStudyResult``, ``CaseStudyImageInput``,
``AdminCaseStudyImage``).

Inputs list exactly the editable fields; ``id``, ``position``, ``*_html``, ``created_at`` and ``updated_at`` are
server-managed and rejected by ``extra="forbid"``.
"""

from __future__ import annotations

import uuid
from datetime import datetime
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
from app.schemas.enums import ImageLayout
from app.schemas.images import ImageRef

CASE_STUDY_MARKDOWN_MAX = 20_000

Alt = Annotated[SingleLine, Field(max_length=250)]


class CaseStudyInput(InputModel):
    slug: Slug
    title: Annotated[SingleLine, Field(min_length=1, max_length=120)]
    client_name: Annotated[SingleLine, Field(min_length=1, max_length=120)]
    client_industry: Annotated[SingleLine, Field(min_length=1, max_length=80)]
    campaign_type: Annotated[SingleLine, Field(min_length=1, max_length=60)]
    channels: StringList
    goals: StringList
    summary: Annotated[MultiLine, Field(min_length=1, max_length=600)]
    problem_md: Annotated[MarkdownText, Field(min_length=1, max_length=CASE_STUDY_MARKDOWN_MAX)]
    solution_md: Annotated[MarkdownText, Field(min_length=1, max_length=CASE_STUDY_MARKDOWN_MAX)]
    year: Annotated[int, Field(ge=2000, le=2100)]
    timeline: Annotated[SingleLine, Field(min_length=1, max_length=40)]
    cover_media_id: uuid.UUID | None
    cover_alt: Alt | None = Field(description="Required (non-blank) when cover_media_id is set")
    is_featured: bool
    is_published: bool
    is_sample: bool

    @field_validator("cover_alt")
    @classmethod
    def _alt_required_with_cover(cls, value: str | None, info: ValidationInfo) -> str | None:
        return alt_for_media(info.data.get("cover_media_id"), value)


class CaseStudyResultInput(InputModel):
    metric_label: Annotated[SingleLine, Field(min_length=1, max_length=80)]
    value: Annotated[SingleLine, Field(min_length=1, max_length=30)]
    before_value: Annotated[SingleLine, Field(max_length=30)] | None
    change_text: Annotated[SingleLine, Field(max_length=30)] | None = Field(description="e.g. +120 % or +2.1 pts")
    period: Annotated[SingleLine, Field(max_length=40)] | None
    is_sample: bool

    @field_validator("before_value", "change_text", "period")
    @classmethod
    def _empty_is_null(cls, value: str | None) -> str | None:
        return optional_text(value)


class CaseStudyImageInput(InputModel):
    media_id: uuid.UUID
    alt: Annotated[SingleLine, Field(min_length=1, max_length=250, description="Non-blank alt text is mandatory")]
    caption: Annotated[SingleLine, Field(max_length=200)] | None
    layout: ImageLayout

    @field_validator("caption")
    @classmethod
    def _empty_is_null(cls, value: str | None) -> str | None:
        return optional_text(value)


# ---------------------------------------------------------------------------------------------- responses


class AdminCaseStudyResult(AdminMeta):
    metric_label: str
    value: str
    before_value: str | None
    change_text: str | None
    period: str | None
    is_sample: bool


class AdminCaseStudyImage(AdminMeta):
    media_id: uuid.UUID
    alt: str
    caption: str | None
    layout: ImageLayout
    image: ImageRef


class AdminCaseStudyListItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    campaign_type: str
    cover: ImageRef | None
    is_featured: bool
    is_published: bool
    is_sample: bool
    position: int
    updated_at: datetime


class AdminCaseStudy(AdminMeta):
    slug: str
    title: str
    client_name: str
    client_industry: str
    campaign_type: str
    channels: list[str]
    goals: list[str]
    summary: str
    problem_md: str
    solution_md: str
    year: int
    timeline: str
    cover_media_id: uuid.UUID | None
    cover_alt: str | None
    is_featured: bool
    is_published: bool
    is_sample: bool
    problem_html: str
    solution_html: str
    cover: ImageRef | None
    results: list[AdminCaseStudyResult]
    images: list[AdminCaseStudyImage]
