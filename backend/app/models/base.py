"""Declarative base, constraint naming convention and shared column helpers (TS-002, tech-spec section 3)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, MetaData, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$"


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map: dict[Any, Any] = {  # noqa: RUF012 - SQLAlchemy class-level configuration
        str: Text(),
        datetime: DateTime(timezone=True),
        uuid.UUID: UUID(as_uuid=True),
    }


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"), sort_order=-10)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), sort_order=10)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), sort_order=10)


class EntityMixin(UUIDPrimaryKeyMixin, TimestampMixin):
    """``id`` / ``created_at`` / ``updated_at`` common to most tables (``updated_at`` is set by services)."""


def max_length(column: str, limit: int, *, min_length: int | None = None) -> CheckConstraint:
    """``char_length`` CHECK named ``ck_<table>_<column>_length``."""
    condition = f"char_length({column}) <= {limit}"
    if min_length is not None:
        condition = f"char_length({column}) BETWEEN {min_length} AND {limit}"
    return CheckConstraint(condition, name=f"{column}_length")


def jsonb_array(column: str) -> CheckConstraint:
    return CheckConstraint(f"jsonb_typeof({column}) = 'array'", name=f"{column}_is_array")


def one_of(column: str, values: tuple[str, ...]) -> CheckConstraint:
    allowed = ", ".join(f"'{value}'" for value in values)
    return CheckConstraint(f"{column} IN ({allowed})", name=f"{column}_allowed")


def alt_required_with(media_column: str, alt_column: str) -> CheckConstraint:
    """Alt text must be non-blank whenever the media reference is set (NULL alt counts as blank)."""
    return CheckConstraint(
        f"{media_column} IS NULL OR char_length(btrim(coalesce({alt_column}, ''))) > 0",
        name=f"{alt_column}_required",
    )


def slug_checks() -> tuple[CheckConstraint, CheckConstraint]:
    return (
        CheckConstraint(f"slug ~ '{SLUG_PATTERN}'", name="slug_format"),
        CheckConstraint("char_length(slug) <= 80", name="slug_length"),
    )


JSONB_EMPTY_ARRAY = text("'[]'::jsonb")
FALSE = text("false")
