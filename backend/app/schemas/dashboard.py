"""Dashboard schemas (BE-021, TS-015; contract ``Dashboard``, ``LastBuild``, ``ContentCount``)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ContentCount(BaseModel):
    total: int = Field(ge=0)
    published: int = Field(ge=0)


class LastBuild(BaseModel):
    built_at: datetime
    content_snapshot_at: datetime


class Dashboard(BaseModel):
    new_enquiries: int = Field(ge=0)
    content_changed_at: datetime
    last_build: LastBuild | None
    needs_rebuild: bool = Field(
        description="True when there is no build or content_changed_at > last_build.content_snapshot_at"
    )
    rebuild_command: str
    content_counts: dict[str, ContentCount] = Field(
        description=(
            "Keys case_studies, writing_samples, services, engagement_models, testimonials, faq_categories, faqs, "
            "values, process_steps"
        )
    )
