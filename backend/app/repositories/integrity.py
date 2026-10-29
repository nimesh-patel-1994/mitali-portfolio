"""Helpers to read the SQLSTATE and constraint name of an ``IntegrityError`` (asyncpg via SQLAlchemy)."""

from __future__ import annotations

from typing import Final

from sqlalchemy.exc import IntegrityError

UNIQUE_VIOLATION: Final = "23505"
FOREIGN_KEY_VIOLATION: Final = "23503"


def _candidates(exc: IntegrityError) -> list[object]:
    orig = exc.orig
    return [candidate for candidate in (orig, getattr(orig, "__cause__", None)) if candidate is not None]


def sqlstate(exc: IntegrityError) -> str | None:
    for candidate in _candidates(exc):
        for attribute in ("sqlstate", "pgcode"):
            value = getattr(candidate, attribute, None)
            if isinstance(value, str):
                return value
    return None


def constraint_name(exc: IntegrityError) -> str | None:
    for candidate in _candidates(exc):
        value = getattr(candidate, "constraint_name", None)
        if isinstance(value, str):
            return value
    return None
