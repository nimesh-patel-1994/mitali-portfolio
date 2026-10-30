"""Dashboard counts (BE-021, TS-015): one statement with scalar subqueries, independent of row counts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Final

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CaseStudy,
    CoreValue,
    EngagementModel,
    Enquiry,
    Faq,
    FaqCategory,
    ProcessStep,
    Service,
    SiteSettings,
    Testimonial,
    WritingSample,
)
from app.models.singletons import SINGLETON_ID

# Contract ``Dashboard.content_counts`` keys → models (all have ``is_published``).
COUNTED_MODELS: Final[dict[str, Any]] = {
    "case_studies": CaseStudy,
    "writing_samples": WritingSample,
    "services": Service,
    "engagement_models": EngagementModel,
    "testimonials": Testimonial,
    "faq_categories": FaqCategory,
    "faqs": Faq,
    "values": CoreValue,
    "process_steps": ProcessStep,
}


async def summary(session: AsyncSession) -> tuple[int, datetime, dict[str, tuple[int, int]]]:
    """``(new_enquiries, content_changed_at, {key: (total, published)})`` from a single SELECT."""
    columns: list[Any] = [
        select(func.count(Enquiry.id)).where(Enquiry.status == "new").scalar_subquery().label("new_enquiries"),
        select(SiteSettings.content_changed_at)
        .where(SiteSettings.id == SINGLETON_ID)
        .scalar_subquery()
        .label("content_changed_at"),
    ]
    for key, model in COUNTED_MODELS.items():
        columns.append(select(func.count(model.id)).scalar_subquery().label(f"{key}__total"))
        columns.append(
            select(func.count(model.id))
            .where(model.is_published.is_(True))
            .scalar_subquery()
            .label(f"{key}__published")
        )
    row = (await session.execute(select(*columns))).one()._mapping
    counts = {key: (int(row[f"{key}__total"]), int(row[f"{key}__published"])) for key in COUNTED_MODELS}
    return int(row["new_enquiries"]), row["content_changed_at"], counts
