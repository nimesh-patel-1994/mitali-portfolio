"""Media schemas (BE-017, TS-011; contract ``MediaAsset``, ``MediaPage``). The upload itself is multipart
(``file`` + optional ``alt``), declared on the route."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import Page
from app.schemas.enums import MediaMime
from app.schemas.images import ImageSource


class MediaAsset(BaseModel):
    id: uuid.UUID
    url: str
    mime: MediaMime
    width: int
    height: int
    bytes: int
    variants: list[ImageSource]
    alt: str | None
    original_filename: str | None
    source: Literal["upload", "seed"]
    created_at: datetime


class MediaPage(Page[MediaAsset]):
    pass
