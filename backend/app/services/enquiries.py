"""Contact form submission (BE-007, TS-007, SEC-BE-008, SEC-BE-009). The admin part is added by BE-020.

Order: (validation by the schema) → rate-limit counter (own transaction, so it counts even if the insert fails)
→ honeypot → insert. Nothing from the enquiry is ever logged.
"""

from __future__ import annotations

from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit
from app.core.errors import RateLimitedError
from app.repositories import enquiries as repository
from app.schemas.enquiry import EnquiryCreate, EnquiryReceived
from app.services.rate_limit import CONTACT_LIMIT, CONTACT_WINDOW, hit_fixed_window

RATE_LIMITED_MESSAGE = "Too many messages from your connection. Please try again in a few minutes."


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
