"""Slug rules (BE-012, TS-010 point 1): pattern ``^[a-z0-9]+(?:-[a-z0-9]+)*$``, at most 80 characters, unique per
entity. Pattern and length are enforced by the ``Slug`` input type (422); uniqueness is checked before writing and a
unique violation that still happens (concurrent save) is translated to 409 ``slug_taken`` with ``fields.slug``.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import SlugTakenError
from app.repositories import slugs as repository
from app.repositories.integrity import UNIQUE_VIOLATION, constraint_name, sqlstate
from app.schemas.base import SLUG_MAX_LENGTH, SLUG_PATTERN

SLUG_TAKEN_MESSAGE = "This slug is already used. Choose another one."


def is_valid_slug(value: str) -> bool:
    return len(value) <= SLUG_MAX_LENGTH and SLUG_PATTERN.fullmatch(value) is not None


async def ensure_slug_available(
    session: AsyncSession, model: Any, slug: str, *, exclude_id: uuid.UUID | None = None
) -> None:
    if await repository.slug_in_use(session, model, slug, exclude_id=exclude_id):
        raise SlugTakenError(SLUG_TAKEN_MESSAGE)


def is_slug_violation(exc: IntegrityError, table_name: str) -> bool:
    return sqlstate(exc) == UNIQUE_VIOLATION and constraint_name(exc) == f"uq_{table_name}_slug"


def raise_if_slug_violation(exc: IntegrityError, table_name: str) -> None:
    """Re-raise a slug unique violation as 409 ``slug_taken``; other integrity errors are left to the caller."""
    if is_slug_violation(exc, table_name):
        raise SlugTakenError(SLUG_TAKEN_MESSAGE) from None
