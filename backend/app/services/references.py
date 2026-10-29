"""Reference checks for admin inputs (BE-012, TS-010 point 6): referenced media and case studies must exist,
otherwise 422 ``validation_error`` with the field path (e.g. ``cover_media_id``, ``portrait_media_id``)."""

from __future__ import annotations

import uuid
from typing import Final

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationFailedError
from app.models import CaseStudy, MediaAsset
from app.repositories import references as repository

MEDIA_NOT_FOUND: Final = "This image no longer exists. Choose another image."
CASE_STUDY_NOT_FOUND: Final = "This case study does not exist."


async def ensure_media_exists(session: AsyncSession, media_id: uuid.UUID | None, field: str) -> None:
    if media_id is not None and not await repository.row_exists(session, MediaAsset, media_id):
        raise ValidationFailedError(fields={field: MEDIA_NOT_FOUND})


async def ensure_case_study_exists(session: AsyncSession, case_study_id: uuid.UUID | None, field: str) -> None:
    if case_study_id is not None and not await repository.row_exists(session, CaseStudy, case_study_id):
        raise ValidationFailedError(fields={field: CASE_STUDY_NOT_FOUND})
