"""Content change marker (BE-012, REQ-052, TS-010 point 7).

``touch(session)`` sets ``site_settings.content_changed_at`` in the caller's transaction. Every successful
create/update/delete/reorder of content, profile or settings calls it; enquiry changes and media uploads do not.
The dashboard (BE-021) compares it with the last build's snapshot time.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import site as site_repository


async def touch(session: AsyncSession, *, now: datetime | None = None) -> datetime:
    """Mark content as changed; returns the stored timestamp. Must run inside the caller's transaction."""
    if not session.in_transaction():
        raise RuntimeError("publishing.touch() must run inside the caller's transaction")
    moment = now or datetime.now(UTC)
    await site_repository.set_content_changed_at(session, moment)
    return moment
