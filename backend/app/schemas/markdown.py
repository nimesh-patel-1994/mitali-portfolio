"""Markdown preview schemas (BE-018, contract ``MarkdownPreviewRequest`` / ``MarkdownPreview``)."""

from __future__ import annotations

from typing import Annotated, Final

from pydantic import BaseModel, Field

from app.schemas.base import InputModel, MarkdownText

PREVIEW_MAX_LENGTH: Final = 100_000


class MarkdownPreviewRequest(InputModel):
    markdown: Annotated[MarkdownText, Field(max_length=PREVIEW_MAX_LENGTH)]


class MarkdownPreview(BaseModel):
    html: str = Field(description="Sanitized HTML")
    word_count: int = Field(ge=0)
    reading_time_min: int = Field(ge=1)
