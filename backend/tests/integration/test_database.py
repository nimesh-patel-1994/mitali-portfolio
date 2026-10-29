"""Tests that need the ``mitali_portfolio_test`` database (marked ``db`` automatically).

BE-T-007, BE-T-008, BE-T-009 (constraints and FK actions), BE-T-017 (health with the database up) and SEC-BE-018
(``statement_timeout``). Each test runs in a rolled-back transaction.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
import pytest
from sqlalchemy import delete, func, insert, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.models import (
    AdminUser,
    CaseStudy,
    CaseStudyImage,
    CaseStudyResult,
    Faq,
    FaqCategory,
    MediaAsset,
    Profile,
)
from tests import factories


async def expect_integrity_error(session: AsyncSession, action: Callable[[], Awaitable[Any]]) -> IntegrityError:
    """Run ``action`` in a savepoint and return the IntegrityError it must raise (the outer transaction survives)."""
    savepoint = await session.begin_nested()

    async def run() -> None:
        await action()
        await session.flush()

    with pytest.raises(IntegrityError) as caught:
        await run()
    await savepoint.rollback()
    session.expunge_all()
    return caught.value


async def _count(session: AsyncSession, model: Any, *where: Any) -> int:
    statement = select(func.count()).select_from(model)
    if where:
        statement = statement.where(*where)
    return int((await session.execute(statement)).scalar_one())


@pytest.mark.be_t("BE-T-007")
async def test_case_study_constraints_rejected_by_database(db_session: AsyncSession) -> None:
    existing = await factories.case_study(db_session, slug="taken-slug")
    media = await factories.media_asset(db_session)
    assert existing.id is not None

    cases: dict[str, dict[str, Any]] = {
        "duplicate slug": {"slug": "taken-slug"},
        "slug with space and capitals": {"slug": "Bad Slug"},
        "slug of 81 chars": {"slug": "a" * 81},
        "year 1999": {"year": 1999},
        "cover without alt": {"cover_media_id": media.id, "cover_alt": "   "},
        "cover with null alt": {"cover_media_id": media.id, "cover_alt": None},
        "channels not an array": {"channels": {"not": "an array"}},
    }
    for label, overrides in cases.items():

        async def create(overrides: dict[str, Any] = overrides) -> None:
            await factories.case_study(db_session, **overrides)

        error = await expect_integrity_error(db_session, create)
        assert error is not None, label

    # The slug length CHECK accepts exactly 80 characters.
    await factories.case_study(db_session, slug="b" * 80)


@pytest.mark.be_t("BE-T-008")
async def test_single_admin_singleton_and_media_path_constraints(db_session: AsyncSession) -> None:
    await factories.admin_user(db_session, email="first@example.com")

    async def second_admin() -> None:
        await factories.admin_user(db_session, email="second@example.com")

    await expect_integrity_error(db_session, second_admin)

    async def second_profile() -> None:
        await db_session.execute(
            insert(Profile).values(
                id=2,
                name="x",
                headline="x",
                origin_statement="x",
                vision_blocks=[{"heading": "a", "body": "b"}, {"heading": "c", "body": "d"}],
            )
        )

    await expect_integrity_error(db_session, second_profile)

    for bad_path in (
        "../escape.webp",
        "uploads/../../escape.webp",
        "/uploads/x.webp",
        "\\uploads\\x.webp",
        "C:/x.webp",
        "uploads/x.svg::$DATA",
    ):

        async def media(path: str = bad_path) -> None:
            await factories.media_asset(db_session, path=path)

        await expect_integrity_error(db_session, media)

    assert await _count(db_session, AdminUser) == 1
    assert await _count(db_session, Profile) == 1


async def test_admin_email_unique_case_insensitive(db_session: AsyncSession) -> None:
    await factories.admin_user(db_session, email="Admin@Example.com")
    await db_session.execute(delete(AdminUser))  # single-admin index would hide the email index otherwise
    await factories.admin_user(db_session, email="admin@example.com")
    assert await _count(db_session, AdminUser, func.lower(AdminUser.email) == "admin@example.com") == 1


@pytest.mark.be_t("BE-T-009")
async def test_foreign_key_actions(db_session: AsyncSession) -> None:
    media = await factories.media_asset(db_session)
    case = await factories.case_study(db_session)
    await factories.case_study_result(db_session, case.id)
    await factories.case_study_result(db_session, case.id)
    await factories.case_study_image(db_session, case.id, media.id)
    linked = await factories.testimonial(db_session, case_study_id=case.id)
    category = await factories.faq_category(db_session)
    await factories.faq(db_session, category.id)

    # Referenced media cannot be deleted (RESTRICT).
    async def delete_media() -> None:
        await db_session.execute(delete(MediaAsset).where(MediaAsset.id == media.id))

    await expect_integrity_error(db_session, delete_media)

    # A category with FAQs cannot be deleted (RESTRICT).
    async def delete_category() -> None:
        await db_session.execute(delete(FaqCategory).where(FaqCategory.id == category.id))

    await expect_integrity_error(db_session, delete_category)

    # Deleting the case study cascades to results and images and unlinks the testimonial.
    await db_session.execute(delete(CaseStudy).where(CaseStudy.id == case.id))
    assert await _count(db_session, CaseStudyResult, CaseStudyResult.case_study_id == case.id) == 0
    assert await _count(db_session, CaseStudyImage, CaseStudyImage.case_study_id == case.id) == 0
    testimonial_link = await db_session.execute(
        select(models.Testimonial.case_study_id).where(models.Testimonial.id == linked.id)
    )
    assert testimonial_link.scalar_one() is None
    assert await _count(db_session, MediaAsset, MediaAsset.id == media.id) == 1
    assert await _count(db_session, Faq, Faq.category_id == category.id) == 1

    # Once nothing references the media any more it can be deleted.
    await db_session.execute(delete(MediaAsset).where(MediaAsset.id == media.id))
    assert await _count(db_session, MediaAsset, MediaAsset.id == media.id) == 0


async def test_singleton_rows_exist_with_placeholders(db_session: AsyncSession) -> None:
    profile = (await db_session.execute(text("SELECT id, name, vision_blocks FROM profile"))).all()
    settings = (await db_session.execute(text("SELECT id, contact_email FROM site_settings"))).all()
    assert [row.id for row in profile] == [1]
    assert len(profile[0].vision_blocks) == 2
    assert [row.id for row in settings] == [1]
    assert settings[0].contact_email.endswith("@example.com")


async def test_uuid_and_timestamps_generated_by_database(db_session: AsyncSession) -> None:
    category = await factories.faq_category(db_session)
    await db_session.refresh(category)
    assert isinstance(category.id, uuid.UUID)
    assert category.created_at.tzinfo is not None
    assert category.updated_at.tzinfo is not None


@pytest.mark.be_t("BE-T-017")
async def test_health_ok_when_database_reachable(db_client: httpx.AsyncClient) -> None:
    response = await db_client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.sec("SEC-BE-018")
async def test_app_sessions_have_statement_timeout_10s(db_session: AsyncSession) -> None:
    result = await db_session.execute(text("SHOW statement_timeout"))
    assert result.scalar_one() == "10s"
