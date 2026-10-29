"""Contact enquiries (tech-spec section 3.3, REQ-NFR-005). Enquiry fields are personal data: never log them."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, EntityMixin, max_length, one_of

ENQUIRY_TYPES = (
    "content_strategy",
    "copywriting",
    "seo_content",
    "brand_messaging",
    "campaign_planning",
    "other",
)
BUDGET_RANGES = ("under_1000", "1000_3000", "3000_7500", "7500_15000", "over_15000", "not_sure")
ENQUIRY_STATUSES = ("new", "replied", "archived")


class Enquiry(EntityMixin, Base):
    __tablename__ = "enquiries"

    name: Mapped[str]
    email: Mapped[str]
    company: Mapped[str | None]
    enquiry_type: Mapped[str]
    budget_range: Mapped[str | None]
    message: Mapped[str]
    status: Mapped[str] = mapped_column(server_default=text("'new'"))
    status_changed_at: Mapped[datetime | None]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    __table_args__ = (
        max_length("name", 120),
        max_length("email", 254),
        max_length("company", 120),
        one_of("enquiry_type", ENQUIRY_TYPES),
        one_of("budget_range", BUDGET_RANGES),
        max_length("message", 5000),
        one_of("status", ENQUIRY_STATUSES),
    )

    def __repr__(self) -> str:  # never include personal data in reprs (they end up in logs and tracebacks)
        return f"Enquiry(id={self.id!s})"


Index("ix_enquiries_status_created_at", Enquiry.status, Enquiry.created_at.desc())
Index("ix_enquiries_created_at", Enquiry.created_at.desc())
