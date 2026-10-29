"""Content tables (tech-spec section 3.1): case studies with results and images, writing samples, services,
engagement models, testimonials, core values and process steps. FAQ tables are in ``faq.py``."""

from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Index, SmallInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    FALSE,
    JSONB_EMPTY_ARRAY,
    Base,
    EntityMixin,
    alt_required_with,
    jsonb_array,
    max_length,
    one_of,
    slug_checks,
)

if TYPE_CHECKING:
    from app.models.media import MediaAsset

IMAGE_LAYOUTS = ("full", "half")
WRITING_FORMATS = ("blog", "web_copy", "email", "social", "landing_page", "newsletter")
CTA_TARGETS = ("booking", "contact")


class CaseStudy(EntityMixin, Base):
    __tablename__ = "case_studies"

    slug: Mapped[str] = mapped_column(unique=True)
    title: Mapped[str]
    client_name: Mapped[str]
    client_industry: Mapped[str]
    campaign_type: Mapped[str]
    channels: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    goals: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    summary: Mapped[str]
    problem_md: Mapped[str]
    solution_md: Mapped[str]
    problem_html: Mapped[str]
    solution_html: Mapped[str]
    year: Mapped[int] = mapped_column(SmallInteger)
    timeline: Mapped[str]
    cover_media_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="RESTRICT"))
    cover_alt: Mapped[str | None]
    is_featured: Mapped[bool] = mapped_column(server_default=FALSE)
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    is_sample: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    # Read-only helper for eager loading (``selectinload``); lazy loading is refused in async code.
    cover_media: Mapped[MediaAsset | None] = relationship(foreign_keys=[cover_media_id], lazy="raise", viewonly=True)
    results: Mapped[list[CaseStudyResult]] = relationship(
        back_populates="case_study",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="[CaseStudyResult.position, CaseStudyResult.created_at]",
    )
    images: Mapped[list[CaseStudyImage]] = relationship(
        back_populates="case_study",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="[CaseStudyImage.position, CaseStudyImage.created_at]",
    )

    __table_args__ = (
        *slug_checks(),
        max_length("title", 120, min_length=1),
        max_length("client_name", 120),
        max_length("client_industry", 80),
        max_length("campaign_type", 60),
        jsonb_array("channels"),
        jsonb_array("goals"),
        max_length("summary", 600),
        CheckConstraint("year BETWEEN 2000 AND 2100", name="year_range"),
        max_length("timeline", 40),
        alt_required_with("cover_media_id", "cover_alt"),
        Index("ix_case_studies_is_published_position", "is_published", "position"),
        Index(
            "ix_case_studies_featured_position",
            "position",
            postgresql_where=text("is_featured AND is_published"),
        ),
    )


class CaseStudyResult(EntityMixin, Base):
    __tablename__ = "case_study_results"

    case_study_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("case_studies.id", ondelete="CASCADE"))
    metric_label: Mapped[str]
    value: Mapped[str]
    before_value: Mapped[str | None]
    change_text: Mapped[str | None]
    period: Mapped[str | None]
    is_sample: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    case_study: Mapped[CaseStudy] = relationship(back_populates="results")

    __table_args__ = (
        max_length("metric_label", 80),
        max_length("value", 30),
        max_length("before_value", 30),
        max_length("change_text", 30),
        max_length("period", 40),
        Index("ix_case_study_results_case_study_id_position", "case_study_id", "position"),
    )


class CaseStudyImage(EntityMixin, Base):
    __tablename__ = "case_study_images"

    case_study_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("case_studies.id", ondelete="CASCADE"))
    media_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_assets.id", ondelete="RESTRICT"))
    alt: Mapped[str]
    caption: Mapped[str | None]
    layout: Mapped[str]
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    case_study: Mapped[CaseStudy] = relationship(back_populates="images")
    media: Mapped[MediaAsset] = relationship(foreign_keys=[media_id], lazy="raise", viewonly=True)

    __table_args__ = (
        CheckConstraint("char_length(btrim(alt)) > 0", name="alt_not_blank"),
        max_length("alt", 250),
        max_length("caption", 200),
        one_of("layout", IMAGE_LAYOUTS),
        Index("ix_case_study_images_case_study_id_position", "case_study_id", "position"),
    )


class WritingSample(EntityMixin, Base):
    __tablename__ = "writing_samples"

    slug: Mapped[str] = mapped_column(unique=True)
    title: Mapped[str]
    format: Mapped[str]
    client_name: Mapped[str | None]
    industry: Mapped[str | None]
    excerpt: Mapped[str]
    body_md: Mapped[str]
    body_html: Mapped[str]
    word_count: Mapped[int]
    reading_time_min: Mapped[int] = mapped_column(SmallInteger)
    published_on: Mapped[date]
    tags: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    thumbnail_media_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="RESTRICT"))
    thumbnail_alt: Mapped[str | None]
    is_featured: Mapped[bool] = mapped_column(server_default=FALSE)
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    is_sample: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    thumbnail_media: Mapped[MediaAsset | None] = relationship(
        foreign_keys=[thumbnail_media_id], lazy="raise", viewonly=True
    )

    __table_args__ = (
        *slug_checks(),
        max_length("title", 120, min_length=1),
        one_of("format", WRITING_FORMATS),
        max_length("excerpt", 600),
        CheckConstraint("word_count >= 0", name="word_count_non_negative"),
        CheckConstraint("reading_time_min >= 1", name="reading_time_min_positive"),
        jsonb_array("tags"),
        alt_required_with("thumbnail_media_id", "thumbnail_alt"),
        Index("ix_writing_samples_is_published_position", "is_published", "position"),
        Index("ix_writing_samples_is_published_format_position", "is_published", "format", "position"),
    )


class Service(EntityMixin, Base):
    __tablename__ = "services"

    name: Mapped[str]
    description: Mapped[str]
    deliverables: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    __table_args__ = (
        max_length("name", 80),
        max_length("description", 600),
        jsonb_array("deliverables"),
        Index("ix_services_is_published_position", "is_published", "position"),
    )


class EngagementModel(EntityMixin, Base):
    __tablename__ = "engagement_models"

    name: Mapped[str]
    description: Mapped[str]
    features: Mapped[list[str]] = mapped_column(JSONB, server_default=JSONB_EMPTY_ARRAY)
    cta_label: Mapped[str] = mapped_column(server_default=text("'Book a call'"))
    cta_target: Mapped[str] = mapped_column(server_default=text("'booking'"))
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    __table_args__ = (
        max_length("name", 80),
        max_length("description", 600),
        jsonb_array("features"),
        max_length("cta_label", 40),
        one_of("cta_target", CTA_TARGETS),
    )


class Testimonial(EntityMixin, Base):
    __tablename__ = "testimonials"

    quote: Mapped[str]
    author_name: Mapped[str]
    author_role: Mapped[str]
    company: Mapped[str]
    case_study_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("case_studies.id", ondelete="SET NULL"))
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    __table_args__ = (
        max_length("quote", 600),
        max_length("author_name", 80),
        max_length("author_role", 80),
        max_length("company", 120),
    )


class CoreValue(EntityMixin, Base):
    """Entity "values" (API path ``/values``); the table is ``core_values`` because VALUES is reserved."""

    __tablename__ = "core_values"

    title: Mapped[str]
    body: Mapped[str]
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    __table_args__ = (max_length("title", 80), max_length("body", 600))


class ProcessStep(EntityMixin, Base):
    __tablename__ = "process_steps"

    title: Mapped[str]
    body: Mapped[str]
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    __table_args__ = (max_length("title", 80), max_length("body", 600))
