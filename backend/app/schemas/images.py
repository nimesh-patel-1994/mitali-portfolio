"""Image references returned by the API (contract ``ImageRef`` / ``ImageSource``)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.enums import MediaMime


class ImageSource(BaseModel):
    width: int
    url: str = Field(description="Root-relative URL under /media/")


class ImageRef(BaseModel):
    url: str = Field(description="Root-relative URL of the largest variant or the SVG")
    alt: str
    width: int
    height: int
    mime: MediaMime
    srcset: list[ImageSource] = Field(description="Responsive WebP variants (empty for SVG)")
