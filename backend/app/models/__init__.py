"""SQLAlchemy models. Importing this package registers every table on ``Base.metadata`` (Alembic relies on it)."""

from app.models.auth import AdminUser, RateLimitCounter, Session
from app.models.base import Base
from app.models.content import (
    CaseStudy,
    CaseStudyImage,
    CaseStudyResult,
    CoreValue,
    EngagementModel,
    ProcessStep,
    Service,
    Testimonial,
    WritingSample,
)
from app.models.enquiry import Enquiry
from app.models.faq import Faq, FaqCategory
from app.models.media import MediaAsset
from app.models.singletons import Profile, SiteSettings

__all__ = [
    "AdminUser",
    "Base",
    "CaseStudy",
    "CaseStudyImage",
    "CaseStudyResult",
    "CoreValue",
    "EngagementModel",
    "Enquiry",
    "Faq",
    "FaqCategory",
    "MediaAsset",
    "ProcessStep",
    "Profile",
    "RateLimitCounter",
    "Service",
    "Session",
    "SiteSettings",
    "Testimonial",
    "WritingSample",
]
