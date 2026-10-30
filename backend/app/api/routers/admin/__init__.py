"""Admin API routers (BE-009, SEC-BE-005, BE-REV-003).

``protected_router`` carries ``get_current_admin`` (401 without a live session) and ``require_csrf`` (403 for
state-changing methods without a valid token) as router-level dependencies. Every admin router is included into it;
the only route outside is ``adminLogin`` (``login_router``). New admin routers are protected by being included
here; there is no per-route opt-out.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin, require_csrf
from app.api.routers.admin import (
    auth,
    case_studies,
    dashboard,
    engagement_models,
    enquiries,
    faq_categories,
    faqs,
    markdown,
    media,
    process_steps,
    profile,
    services,
    settings,
    testimonials,
    values,
    writing_samples,
)
from app.api.routers.admin.auth import login_router

ADMIN_PREFIX = "/api/admin"

protected_router = APIRouter(
    prefix=ADMIN_PREFIX,
    dependencies=[Depends(get_current_admin), Depends(require_csrf)],
)
for _router in (
    auth.router,
    dashboard.router,
    case_studies.router,
    writing_samples.router,
    services.router,
    engagement_models.router,
    testimonials.router,
    faq_categories.router,
    faqs.router,
    values.router,
    process_steps.router,
    media.router,
    markdown.router,
    profile.router,
    settings.router,
    enquiries.router,
):
    protected_router.include_router(_router)

__all__ = ["ADMIN_PREFIX", "login_router", "protected_router"]
