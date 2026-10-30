"""Public read-only schemas (BE-006, TS-004). Class names mirror the contract components.

Only the fields listed here leave the public API: never ``notification_email``, enquiries, media file names,
admin data or unpublished items/links (SEC-BE-005, BE-REV-009).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.enums import CtaTarget, ImageLayout, WritingFormat
from app.schemas.images import ImageRef

# ---------------------------------------------------------------------------------------------- site bundle


class SocialLink(BaseModel):
    label: str
    url: str


class PublicSettings(BaseModel):
    contact_email: str
    booking_url: str | None = Field(description='Absolute http(s) URL, "#" or null (null/"#" means link to /contact)')
    social_links: list[SocialLink]
    footer_signoff: str
    contact_promise: str = Field(description="Promise line under the Contact page heading; plain text (CHG-005)")
    footer_rights_line: str = Field(description="Rights line in the footer bottom bar; plain text (CHG-005)")


class VisionBlock(BaseModel):
    heading: str
    body: str


class PublicProfile(BaseModel):
    name: str
    headline: str
    bio: list[str] = Field(description="Paragraphs")
    skills: list[str]
    tools: list[str]
    years_experience: int | None
    origin_statement: str
    vision_blocks: list[VisionBlock]
    portrait: ImageRef | None


class SiteBundle(BaseModel):
    generated_at: datetime = Field(
        description="Server time of this response; the pre-renderer records it as content_snapshot_at"
    )
    settings: PublicSettings
    profile: PublicProfile


# ---------------------------------------------------------------------------------------------- case studies


class CaseStudySummary(BaseModel):
    slug: str
    title: str
    client_name: str
    campaign_type: str
    summary: str
    cover: ImageRef | None
    is_featured: bool
    is_sample: bool
    updated_at: datetime


class CaseStudyResult(BaseModel):
    id: uuid.UUID
    metric_label: str
    value: str
    before_value: str | None
    change_text: str | None
    period: str | None
    is_sample: bool


class CaseStudyImage(BaseModel):
    id: uuid.UUID
    layout: ImageLayout
    image: ImageRef
    caption: str | None


class CaseStudyDetail(CaseStudySummary):
    client_industry: str
    year: int
    timeline: str
    channels: list[str]
    goals: list[str]
    problem_html: str = Field(description="Sanitized HTML (TS-012)")
    solution_html: str = Field(description="Sanitized HTML (TS-012)")
    results: list[CaseStudyResult]
    images: list[CaseStudyImage]
    more_work: list[CaseStudySummary] = Field(
        max_length=2, description="Next published case studies by position (wrapping), excluding this one"
    )


# ---------------------------------------------------------------------------------------------- writing samples


class WritingSampleSummary(BaseModel):
    slug: str
    title: str
    format: WritingFormat
    excerpt: str
    thumbnail: ImageRef | None
    client_name: str | None
    published_on: date
    reading_time_min: int = Field(ge=1)
    is_featured: bool
    is_sample: bool
    updated_at: datetime


class WritingSampleDetail(WritingSampleSummary):
    industry: str | None
    tags: list[str]
    body_html: str = Field(description="Sanitized HTML (TS-012)")
    word_count: int = Field(ge=0)


# ---------------------------------------------------------------------------------------------- other content


class Service(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    deliverables: list[str]


class EngagementModel(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    features: list[str]
    cta_label: str
    cta_target: CtaTarget


class Testimonial(BaseModel):
    id: uuid.UUID
    quote: str
    author_name: str
    author_role: str
    company: str
    case_study_slug: str | None = Field(description="Set only when the linked case study is published")


class Faq(BaseModel):
    id: uuid.UUID
    question: str
    answer: str = Field(description="Plain text; blank lines separate paragraphs")


class FaqGroup(BaseModel):
    id: uuid.UUID
    name: str
    faqs: list[Faq]


class CoreValue(BaseModel):
    id: uuid.UUID
    title: str
    body: str


class ProcessStep(BaseModel):
    id: uuid.UUID
    title: str
    body: str
