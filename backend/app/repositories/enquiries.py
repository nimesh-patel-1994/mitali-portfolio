"""``enquiries`` data access (BE-007; the admin part is added by BE-020)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Enquiry


async def insert(
    session: AsyncSession,
    *,
    name: str,
    email: str,
    company: str | None,
    enquiry_type: str,
    budget_range: str | None,
    message: str,
) -> Enquiry:
    row = Enquiry(
        name=name,
        email=email,
        company=company,
        enquiry_type=enquiry_type,
        budget_range=budget_range,
        message=message,
        status="new",
    )
    session.add(row)
    await session.flush()
    return row
