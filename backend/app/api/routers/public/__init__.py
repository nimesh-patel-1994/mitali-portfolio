"""Public routers: GET-only content (BE-006) plus ``createEnquiry`` (BE-007) and ``getHealth`` (BE-005)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routers.public import (
    case_studies,
    engagement_models,
    enquiries,
    faqs,
    health,
    process_steps,
    services,
    site,
    testimonials,
    values,
    writing_samples,
)

PUBLIC_ROUTERS: tuple[APIRouter, ...] = (
    health.router,
    site.router,
    case_studies.router,
    writing_samples.router,
    services.router,
    engagement_models.router,
    testimonials.router,
    faqs.router,
    values.router,
    process_steps.router,
    enquiries.router,
)

__all__ = ["PUBLIC_ROUTERS"]
