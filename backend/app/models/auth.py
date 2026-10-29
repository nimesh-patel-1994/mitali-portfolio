"""Admin user, sessions and rate-limit counters (tech-spec section 3.4, SD-007, SD-010)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, LargeBinary, PrimaryKeyConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, EntityMixin, UUIDPrimaryKeyMixin, one_of

RATE_LIMIT_BUCKETS = ("contact_ip", "login_ip", "login_account")


class AdminUser(EntityMixin, Base):
    __tablename__ = "admin_users"

    email: Mapped[str]
    password_hash: Mapped[str]
    password_changed_at: Mapped[datetime]
    last_login_at: Mapped[datetime | None]

    def __repr__(self) -> str:  # no email or hash in reprs
        return f"AdminUser(id={self.id!s})"


# At most one admin (unique index on a constant expression) and case-insensitive unique email.
Index("uq_admin_users_single_admin", text("(true)"), unique=True, _table=AdminUser.__table__)  # type: ignore[arg-type]
Index("uq_admin_users_lower_email", func.lower(AdminUser.email), unique=True)


class Session(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "sessions"

    admin_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"))
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    csrf_token_hash: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    last_seen_at: Mapped[datetime]
    absolute_expires_at: Mapped[datetime]

    __table_args__ = (
        Index("ix_sessions_admin_user_id", "admin_user_id"),
        Index("ix_sessions_absolute_expires_at", "absolute_expires_at"),
    )

    def __repr__(self) -> str:  # never include token hashes
        return f"Session(id={self.id!s})"


class RateLimitCounter(Base):
    __tablename__ = "rate_limit_counters"

    bucket: Mapped[str]
    key_hash: Mapped[str]
    window_start: Mapped[datetime]
    count: Mapped[int]
    blocked_until: Mapped[datetime | None]
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("bucket", "key_hash"),
        one_of("bucket", RATE_LIMIT_BUCKETS),
        CheckConstraint("key_hash ~ '^[0-9a-f]{64}$'", name="key_hash_hex"),
        Index("ix_rate_limit_counters_updated_at", "updated_at"),
    )
