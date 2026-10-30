"""Contact form submission (BE-007, TS-007, SEC-BE-008, SEC-BE-009) and admin enquiry management (BE-020, TS-014).

Submission order: (validation by the schema) → rate-limit counter (own transaction, so it counts even if the insert
fails) → honeypot → insert. Nothing from an enquiry is ever logged. Admin changes (status, delete) never call
``publishing.touch()``: enquiries are not site content.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit
from app.core.errors import NotFoundError, RateLimitedError
from app.models import Enquiry
from app.repositories import enquiries as repository
from app.schemas.common import PageParams
from app.schemas.enquiry import Enquiry as EnquiryDetail
from app.schemas.enquiry import EnquiryCreate, EnquiryPage, EnquiryReceived, EnquirySummary
from app.schemas.enums import EnquiryStatus
from app.services.rate_limit import CONTACT_LIMIT, CONTACT_WINDOW, hit_fixed_window

RATE_LIMITED_MESSAGE = "Too many messages from your connection. Please try again in a few minutes."
ENQUIRY_NOT_FOUND = "Enquiry not found."


async def submit_enquiry(
    session: AsyncSession, payload: EnquiryCreate, *, client_ip: str, hash_secret: SecretStr
) -> EnquiryReceived:
    async with session.begin():
        result = await hit_fixed_window(
            session, hash_secret, "contact_ip", client_ip, limit=CONTACT_LIMIT, window=CONTACT_WINDOW
        )
    if not result.allowed:
        audit("contact.rate_limited")
        raise RateLimitedError(result.retry_after_seconds, RATE_LIMITED_MESSAGE)

    if payload.is_honeypot_hit:
        audit("contact.honeypot_hit")
        return EnquiryReceived(received=True)

    async with session.begin():
        await repository.insert(
            session,
            name=payload.name,
            email=payload.email,
            company=payload.company or None,
            enquiry_type=payload.enquiry_type,
            budget_range=payload.budget_range,
            message=payload.message,
        )
    return EnquiryReceived(received=True)


# ---------------------------------------------------------------------------------------------- admin (BE-020)


def _summary(row: Enquiry) -> EnquirySummary:
    return EnquirySummary.model_validate(row, from_attributes=True)


def _detail(row: Enquiry) -> EnquiryDetail:
    return EnquiryDetail.model_validate(row, from_attributes=True)


async def list_enquiries(session: AsyncSession, *, status: EnquiryStatus | None, params: PageParams) -> EnquiryPage:
    async with session.begin():
        rows, total = await repository.list_page(session, status=status, offset=params.offset, limit=params.limit)
        return EnquiryPage(
            items=[_summary(row) for row in rows], total=total, page=params.page, page_size=params.page_size
        )


async def get_enquiry(session: AsyncSession, enquiry_id: uuid.UUID) -> EnquiryDetail:
    async with session.begin():
        row = await repository.get(session, enquiry_id)
        if row is None:
            raise NotFoundError(ENQUIRY_NOT_FOUND)
        return _detail(row)


async def update_status(session: AsyncSession, enquiry_id: uuid.UUID, status: EnquiryStatus) -> EnquiryDetail:
    """Any status to any status; ``status_changed_at`` (and ``updated_at``) set to now."""
    async with session.begin():
        row = await repository.get(session, enquiry_id, for_update=True)
        if row is None:
            raise NotFoundError(ENQUIRY_NOT_FOUND)
        await repository.set_status(session, row, status=status, moment=datetime.now(UTC))
        return _detail(row)


async def delete_enquiry(session: AsyncSession, enquiry_id: uuid.UUID) -> None:
    """Hard delete (REQ-NFR-005)."""
    async with session.begin():
        if not await repository.delete(session, enquiry_id):
            raise NotFoundError(ENQUIRY_NOT_FOUND)
