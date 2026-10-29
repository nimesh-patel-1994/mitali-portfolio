"""BE-012 shared content services, exercised directly (the admin CRUD routes that use them come with BE-013..016).

Service-level parts of BE-T-064 (exact-set reorder), BE-T-065 (scoped reorder), BE-T-056 (slug taken) and
BE-T-067 (change marker: profile/settings advance it, enquiries do not).
"""

from __future__ import annotations

import uuid
from datetime import datetime

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import OrderMismatchError, SlugTakenError, ValidationFailedError
from app.models import CaseStudy, CaseStudyResult, Faq, Service, SiteSettings
from app.services import ordering, publishing, references, slugs
from app.services.ordering import Scope
from tests import factories
from tests.conftest import api_client


async def _positions(session: AsyncSession, model: type[Service] | type[CaseStudyResult] | type[Faq],
                     *where: object) -> list[tuple[uuid.UUID, int]]:  # fmt: skip
    statement = select(model.id, model.position).where(*where).order_by(model.position)  # type: ignore[arg-type]
    return [(row[0], row[1]) for row in (await session.execute(statement.execution_options(populate_existing=True)))]


async def test_next_position_is_zero_when_empty_then_max_plus_one(db_session: AsyncSession) -> None:
    assert await ordering.next_position(db_session, Scope(Service)) == 0
    await factories.service(db_session, position=0)
    await factories.service(db_session, position=2)
    assert await ordering.next_position(db_session, Scope(Service)) == 3


@pytest.mark.be_t("BE-T-064")
async def test_reorder_exact_set_rewrites_positions(db_session: AsyncSession) -> None:
    a = await factories.service(db_session, position=0)
    b = await factories.service(db_session, position=5)
    c = await factories.service(db_session, position=9)
    await ordering.reorder(db_session, Scope(Service), [c.id, a.id, b.id])
    assert await _positions(db_session, Service) == [(c.id, 0), (a.id, 1), (b.id, 2)]


@pytest.mark.be_t("BE-T-064")
@pytest.mark.parametrize("variant", ["missing", "unknown", "duplicate"])
async def test_reorder_mismatch_raises_and_changes_nothing(db_session: AsyncSession, variant: str) -> None:
    a = await factories.service(db_session, position=0)
    b = await factories.service(db_session, position=1)
    before = await _positions(db_session, Service)
    ids = {"missing": [b.id], "unknown": [b.id, a.id, uuid.uuid4()], "duplicate": [b.id, a.id, a.id]}[variant]
    with pytest.raises(OrderMismatchError) as caught:
        await ordering.reorder(db_session, Scope(Service), ids)
    assert caught.value.code == "order_mismatch"
    assert caught.value.status_code == 422
    assert await _positions(db_session, Service) == before


@pytest.mark.be_t("BE-T-065")
async def test_reorder_nested_scope_rejects_ids_of_other_parent(db_session: AsyncSession) -> None:
    study_a = await factories.case_study(db_session)
    study_b = await factories.case_study(db_session)
    a1 = await factories.case_study_result(db_session, study_a.id, position=0)
    a2 = await factories.case_study_result(db_session, study_a.id, position=1)
    b1 = await factories.case_study_result(db_session, study_b.id, position=0)
    scope_a = Scope(CaseStudyResult, (CaseStudyResult.case_study_id == study_a.id,))
    with pytest.raises(OrderMismatchError):
        await ordering.reorder(db_session, scope_a, [a2.id, b1.id])
    await ordering.reorder(db_session, scope_a, [a2.id, a1.id])
    assert await _positions(db_session, CaseStudyResult, CaseStudyResult.case_study_id == study_a.id) == [
        (a2.id, 0),
        (a1.id, 1),
    ]
    assert await _positions(db_session, CaseStudyResult, CaseStudyResult.case_study_id == study_b.id) == [(b1.id, 0)]


@pytest.mark.be_t("BE-T-056")
async def test_slug_taken_check_and_violation_translation(db_session: AsyncSession) -> None:
    existing = await factories.case_study(db_session, slug="taken-slug")
    with pytest.raises(SlugTakenError) as caught:
        await slugs.ensure_slug_available(db_session, CaseStudy, "taken-slug")
    assert caught.value.status_code == 409
    assert caught.value.fields == {"slug": slugs.SLUG_TAKEN_MESSAGE}
    await slugs.ensure_slug_available(db_session, CaseStudy, "taken-slug", exclude_id=existing.id)
    await slugs.ensure_slug_available(db_session, CaseStudy, "free-slug")

    nested = await db_session.begin_nested()
    with pytest.raises(IntegrityError) as violation:
        await factories.case_study(db_session, slug="taken-slug")
    await nested.rollback()
    assert slugs.is_slug_violation(violation.value, "case_studies")
    assert not slugs.is_slug_violation(violation.value, "writing_samples")
    with pytest.raises(SlugTakenError):
        slugs.raise_if_slug_violation(violation.value, "case_studies")
    slugs.raise_if_slug_violation(violation.value, "writing_samples")  # not a slug violation there: no raise


async def test_reference_checks_raise_422_with_field_path(db_session: AsyncSession) -> None:
    media = await factories.media_asset(db_session)
    study = await factories.case_study(db_session)
    await references.ensure_media_exists(db_session, media.id, "cover_media_id")
    await references.ensure_media_exists(db_session, None, "cover_media_id")
    await references.ensure_case_study_exists(db_session, study.id, "case_study_id")
    with pytest.raises(ValidationFailedError) as media_error:
        await references.ensure_media_exists(db_session, uuid.uuid4(), "images.0.media_id")
    assert media_error.value.fields == {"images.0.media_id": references.MEDIA_NOT_FOUND}
    with pytest.raises(ValidationFailedError) as study_error:
        await references.ensure_case_study_exists(db_session, uuid.uuid4(), "case_study_id")
    assert set(study_error.value.fields or {}) == {"case_study_id"}


async def _changed_at(session: AsyncSession) -> datetime:
    statement = select(SiteSettings.content_changed_at).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


async def test_touch_requires_a_transaction_and_advances_marker(db_session: AsyncSession) -> None:
    await db_session.commit()  # end the autobegun savepoint so the session has no transaction
    with pytest.raises(RuntimeError):
        await publishing.touch(db_session)
    before = await _changed_at(db_session)
    async with db_session.begin_nested():
        stamped = await publishing.touch(db_session)
    assert stamped > before
    assert await _changed_at(db_session) == stamped


@pytest.mark.be_t("BE-T-067")
async def test_enquiry_submission_does_not_touch_marker(db_app: FastAPI, db_session: AsyncSession) -> None:
    before = await _changed_at(db_session)
    async with api_client(db_app, ip="198.51.100.90") as client:
        response = await client.post(
            "/api/public/enquiries",
            json={"name": "A", "email": "a@example.com", "enquiry_type": "other", "message": "Hi"},
        )
    assert response.status_code == 201
    assert await _changed_at(db_session) == before


@pytest.mark.be_t("BE-T-067")
async def test_profile_and_settings_updates_touch_marker(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    before = await _changed_at(db_session)
    settings = (await admin_client.get("/api/admin/settings")).json()
    body = {key: settings[key] for key in ("contact_email", "booking_url", "social_links", "footer_signoff",
                                           "notification_email")}  # fmt: skip
    assert (await admin_client.put("/api/admin/settings", json=body)).status_code == 200
    middle = await _changed_at(db_session)
    assert middle > before
    profile = (await admin_client.get("/api/admin/profile")).json()
    profile_body = {key: profile[key] for key in (
        "name", "headline", "bio", "skills", "tools", "years_experience", "origin_statement", "vision_blocks",
        "portrait_media_id", "portrait_alt")}  # fmt: skip
    assert (await admin_client.put("/api/admin/profile", json=profile_body)).status_code == 200
    assert await _changed_at(db_session) > middle
