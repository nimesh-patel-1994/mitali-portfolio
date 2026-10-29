"""Profile and site settings schemas (BE-019, TS-013, SEC-BE-014; contract ``ProfileInput``, ``AdminProfile``,
``SettingsInput``, ``AdminSettings``)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Final

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from app.schemas.base import BookingUrl, Email, HttpUrlText, InputModel, MultiLine, SingleLine, StringList
from app.schemas.images import ImageRef

ALT_REQUIRED_MESSAGE: Final = "Describe the image (alt text is required when an image is set)."

BioParagraph = Annotated[MultiLine, Field(min_length=1, max_length=1200)]


class VisionBlockInput(InputModel):
    heading: Annotated[SingleLine, Field(min_length=1, max_length=80)]
    body: Annotated[MultiLine, Field(min_length=1, max_length=600)]


class ProfileInput(InputModel):
    name: Annotated[SingleLine, Field(min_length=1, max_length=80)]
    headline: Annotated[SingleLine, Field(min_length=1, max_length=160)]
    bio: Annotated[list[BioParagraph], Field(min_length=1, max_length=6)]
    skills: StringList
    tools: StringList
    years_experience: Annotated[int, Field(ge=0, le=60)] | None
    origin_statement: Annotated[MultiLine, Field(min_length=1, max_length=600)]
    vision_blocks: Annotated[list[VisionBlockInput], Field(min_length=2, max_length=2)]
    portrait_media_id: uuid.UUID | None
    portrait_alt: Annotated[SingleLine, Field(max_length=250)] | None

    @field_validator("portrait_alt")
    @classmethod
    def _alt_required_with_portrait(cls, value: str | None, info: ValidationInfo) -> str | None:
        if info.data.get("portrait_media_id") is not None and not value:
            raise ValueError(ALT_REQUIRED_MESSAGE)
        return value or None


class SocialLinkInput(InputModel):
    label: Annotated[SingleLine, Field(min_length=1, max_length=40)]
    url: HttpUrlText


class SettingsInput(InputModel):
    contact_email: Email
    booking_url: BookingUrl = Field(description='Absolute http(s) URL, "#" or null')
    social_links: Annotated[list[SocialLinkInput], Field(max_length=8)]
    footer_signoff: Annotated[SingleLine, Field(min_length=1, max_length=120)]
    notification_email: Email | None = Field(description="Stored only; no email is sent (out of scope)")


# ---------------------------------------------------------------------------------------------- responses


class AdminVisionBlock(BaseModel):
    heading: str
    body: str


class AdminSocialLink(BaseModel):
    label: str
    url: str


class AdminProfile(BaseModel):
    name: str
    headline: str
    bio: list[str]
    skills: list[str]
    tools: list[str]
    years_experience: int | None
    origin_statement: str
    vision_blocks: list[AdminVisionBlock]
    portrait_media_id: uuid.UUID | None
    portrait_alt: str | None
    portrait: ImageRef | None
    updated_at: datetime


class AdminSettings(BaseModel):
    contact_email: str
    booking_url: str | None
    social_links: list[AdminSocialLink]
    footer_signoff: str
    notification_email: str | None
    content_changed_at: datetime = Field(json_schema_extra={"readOnly": True})
    updated_at: datetime
