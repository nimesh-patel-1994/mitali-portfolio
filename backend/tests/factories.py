"""Row factories for integration tests (BE-025). Fictional data only; every value can be overridden.

Factories add rows through the given ``AsyncSession`` and flush (no commit): the per-test transaction is rolled back.
"""

from __future__ import annotations

import hashlib
import itertools
import secrets
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AdminUser,
    CaseStudy,
    CaseStudyImage,
    CaseStudyResult,
    CoreValue,
    EngagementModel,
    Faq,
    FaqCategory,
    MediaAsset,
    ProcessStep,
    Service,
    Session,
    Testimonial,
    WritingSample,
)

# Fictional test credentials (never used outside the test database).
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "correct-horse-battery-staple-42"

_counter = itertools.count(1)


def _n() -> int:
    return next(_counter)


async def _add[T](session: AsyncSession, row: T) -> T:
    session.add(row)
    await session.flush()
    return row


async def media_asset(session: AsyncSession, **overrides: Any) -> MediaAsset:
    n = _n()
    values: dict[str, Any] = {
        "path": f"uploads/2026/10/{uuid.uuid4()}.webp",
        "variants": [],
        "mime": "image/webp",
        "width": 960,
        "height": 640,
        "bytes": 12_345,
        "original_filename": f"photo-{n}.jpg",
        "alt": None,
        "source": "upload",
    }
    values.update(overrides)
    return await _add(session, MediaAsset(**values))


async def case_study(session: AsyncSession, **overrides: Any) -> CaseStudy:
    n = _n()
    values: dict[str, Any] = {
        "slug": f"sample-case-study-{n}",
        "title": f"Sample case study {n}",
        "client_name": "Fictional Client Co",
        "client_industry": "Retail",
        "campaign_type": "Email",
        "channels": ["Email"],
        "goals": ["Grow sign-ups"],
        "summary": "A fictional summary.",
        "problem_md": "Problem.",
        "solution_md": "Solution.",
        "problem_html": "<p>Problem.</p>",
        "solution_html": "<p>Solution.</p>",
        "year": 2025,
        "timeline": "8 weeks",
        "position": n,
    }
    values.update(overrides)
    return await _add(session, CaseStudy(**values))


async def case_study_result(session: AsyncSession, case_study_id: uuid.UUID, **overrides: Any) -> CaseStudyResult:
    values: dict[str, Any] = {
        "case_study_id": case_study_id,
        "metric_label": "Open rate",
        "value": "38 %",
        "position": _n(),
    }
    values.update(overrides)
    return await _add(session, CaseStudyResult(**values))


async def case_study_image(
    session: AsyncSession, case_study_id: uuid.UUID, media_id: uuid.UUID, **overrides: Any
) -> CaseStudyImage:
    values: dict[str, Any] = {
        "case_study_id": case_study_id,
        "media_id": media_id,
        "alt": "A fictional campaign visual",
        "layout": "full",
        "position": _n(),
    }
    values.update(overrides)
    return await _add(session, CaseStudyImage(**values))


async def writing_sample(session: AsyncSession, **overrides: Any) -> WritingSample:
    n = _n()
    values: dict[str, Any] = {
        "slug": f"sample-writing-{n}",
        "title": f"Sample writing {n}",
        "format": "blog",
        "excerpt": "A fictional excerpt.",
        "body_md": "Body.",
        "body_html": "<p>Body.</p>",
        "word_count": 1,
        "reading_time_min": 1,
        "published_on": date(2026, 1, 15),
        "position": n,
    }
    values.update(overrides)
    return await _add(session, WritingSample(**values))


async def testimonial(session: AsyncSession, **overrides: Any) -> Testimonial:
    values: dict[str, Any] = {
        "quote": "A fictional quote.",
        "author_name": "Alex Example",
        "author_role": "Marketing lead",
        "company": "Example Ltd",
        "position": _n(),
    }
    values.update(overrides)
    return await _add(session, Testimonial(**values))


async def faq_category(session: AsyncSession, **overrides: Any) -> FaqCategory:
    n = _n()
    values: dict[str, Any] = {"name": f"Category {n}", "position": n}
    values.update(overrides)
    return await _add(session, FaqCategory(**values))


async def faq(session: AsyncSession, category_id: uuid.UUID, **overrides: Any) -> Faq:
    values: dict[str, Any] = {
        "category_id": category_id,
        "question": "A fictional question?",
        "answer": "A fictional answer.",
        "position": _n(),
    }
    values.update(overrides)
    return await _add(session, Faq(**values))


async def admin_user(session: AsyncSession, **overrides: Any) -> AdminUser:
    values: dict[str, Any] = {
        "email": "admin@example.com",
        # Not a usable password hash: tests that log in create a real Argon2 hash (BE-008).
        "password_hash": "$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder",
        "password_changed_at": datetime.now(UTC),
    }
    values.update(overrides)
    return await _add(session, AdminUser(**values))


async def admin_with_password(session: AsyncSession, password: str = ADMIN_PASSWORD, **overrides: Any) -> AdminUser:
    """Admin row with a real Argon2id hash of ``password`` (current parameters unless a hash is given)."""
    overrides.setdefault("password_hash", hash_password(password))
    return await admin_user(session, **overrides)


async def service(session: AsyncSession, **overrides: Any) -> Service:
    n = _n()
    values: dict[str, Any] = {"name": f"Service {n}", "description": "A fictional service.", "position": n}
    values.update(overrides)
    return await _add(session, Service(**values))


async def engagement_model(session: AsyncSession, **overrides: Any) -> EngagementModel:
    n = _n()
    values: dict[str, Any] = {"name": f"Model {n}", "description": "A fictional model.", "position": n}
    values.update(overrides)
    return await _add(session, EngagementModel(**values))


async def core_value(session: AsyncSession, **overrides: Any) -> CoreValue:
    n = _n()
    values: dict[str, Any] = {"title": f"Value {n}", "body": "A fictional value.", "position": n}
    values.update(overrides)
    return await _add(session, CoreValue(**values))


async def process_step(session: AsyncSession, **overrides: Any) -> ProcessStep:
    n = _n()
    values: dict[str, Any] = {"title": f"Step {n}", "body": "A fictional step.", "position": n}
    values.update(overrides)
    return await _add(session, ProcessStep(**values))


def sha256(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


async def admin_session(session: AsyncSession, admin_user_id: uuid.UUID, **overrides: Any) -> tuple[Session, str, str]:
    """Create a session row; returns ``(row, session_token, csrf_token)`` (only hashes are stored, SD-007)."""
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    values: dict[str, Any] = {
        "admin_user_id": admin_user_id,
        "token_hash": sha256(token),
        "csrf_token_hash": sha256(csrf),
        "last_seen_at": now,
        "absolute_expires_at": now + timedelta(days=7),
    }
    values.update(overrides)
    row = await _add(session, Session(**values))
    return row, token, csrf
