"""BE-023 seed command: BE-T-099..BE-T-103 (run through ``app.cli`` on the test transaction, temporary MEDIA_ROOT)."""

from __future__ import annotations

import io
import re
from collections import Counter
from collections.abc import Callable
from pathlib import Path
from typing import Any

import defusedxml.ElementTree as SafeET
import httpx
import pytest
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.cli import main_async
from app.core.config import AppEnv, Settings
from app.models import (
    AdminUser,
    CaseStudy,
    CaseStudyImage,
    CaseStudyResult,
    CoreValue,
    EngagementModel,
    Enquiry,
    Faq,
    FaqCategory,
    MediaAsset,
    ProcessStep,
    Profile,
    Service,
    SiteSettings,
    WritingSample,
)
from app.models.singletons import CONTACT_PROMISE_DEFAULT
from app.repositories import seed as seed_repository

EXPECTED = {
    CaseStudy: 6,
    CaseStudyResult: 18,
    WritingSample: 12,
    Service: 5,
    EngagementModel: 3,
    models.Testimonial: 5,
    FaqCategory: 4,
    Faq: 16,
    CoreValue: 4,
    ProcessStep: 4,
}


def seed_settings(db_settings: Settings, media_root: Path, app_env: AppEnv) -> Settings:
    return db_settings.model_copy(
        update={"media_root": media_root, "app_env": app_env, "session_cookie_secure": app_env is AppEnv.PRODUCTION}
    )


async def run(settings: Settings, factory: Callable[[], AsyncSession], *args: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    code = await main_async(["seed", *args], settings=settings, session_factory=factory, stdout=out, stderr=err)
    return code, out.getvalue(), err.getvalue()


async def counts(session: AsyncSession) -> dict[Any, int]:
    models = [*EXPECTED, CaseStudyImage, Enquiry, MediaAsset]
    return {
        model: int((await session.execute(select(func.count()).select_from(model))).scalar_one()) for model in models
    }


@pytest.mark.be_t("BE-T-099")
async def test_seed_development_counts_and_flags(
    db_settings: Settings,
    db_session_factory: Callable[[], AsyncSession],
    db_session: AsyncSession,
    db_client: httpx.AsyncClient,
    media_root: Path,
) -> None:
    code, out, err = await run(seed_settings(db_settings, media_root, AppEnv.DEVELOPMENT), db_session_factory)
    assert code == 0, err
    assert "Seed complete" in out
    found = await counts(db_session)
    for model, expected in EXPECTED.items():
        assert found[model] == expected, model
    assert found[Enquiry] == 4
    assert await db_session.scalar(select(func.count()).select_from(AdminUser)) == 0  # never creates an admin

    case_studies = (await db_session.execute(select(CaseStudy))).scalars().all()
    assert sum(cs.is_featured for cs in case_studies) == 4
    assert all(cs.is_sample and cs.is_published for cs in case_studies)
    per_case_study = Counter((await db_session.execute(select(CaseStudyImage.case_study_id))).scalars().all())
    assert all(6 <= n <= 8 for n in per_case_study.values())
    assert len(per_case_study) == 6
    results = (await db_session.execute(select(CaseStudyResult.is_sample))).scalars().all()
    assert all(results)
    samples = (await db_session.execute(select(WritingSample))).scalars().all()
    assert all(sample.is_sample and sample.is_published for sample in samples)
    assert set(Counter(sample.format for sample in samples).values()) == {2}
    assert len(Counter(sample.format for sample in samples)) == 6
    preview = await db_session.scalar(select(func.count()).select_from(Faq).where(Faq.show_in_preview.is_(True)))
    assert preview == 6

    site = (await db_client.get("/api/public/site")).json()
    assert site["profile"]["portrait"]["mime"] == "image/svg+xml"
    assert site["settings"]["booking_url"] == "#"
    assert site["settings"]["contact_promise"] == CONTACT_PROMISE_DEFAULT
    listed = (await db_client.get("/api/public/case-studies")).json()
    assert len(listed) == 6
    detail = (await db_client.get(f"/api/public/case-studies/{listed[0]['slug']}")).json()
    assert len(detail["results"]) == 3
    assert detail["images"]
    assert len(detail["more_work"]) == 2
    assert "<h2>" in detail["solution_html"] or "<p>" in detail["solution_html"]
    writing = (await db_client.get("/api/public/writing-samples")).json()
    assert len(writing) == 12
    assert (await db_client.get(f"/api/public/writing-samples/{writing[0]['slug']}")).status_code == 200
    assert len((await db_client.get("/api/public/faqs/preview")).json()) == 6
    testimonials = (await db_client.get("/api/public/testimonials")).json()
    assert sum(1 for t in testimonials if t["case_study_slug"]) == 4


@pytest.mark.be_t("BE-T-100")
async def test_seed_is_idempotent_keeps_edits_and_reset_restores(
    db_settings: Settings,
    db_session_factory: Callable[[], AsyncSession],
    db_session: AsyncSession,
    media_root: Path,
) -> None:
    settings = seed_settings(db_settings, media_root, AppEnv.DEVELOPMENT)
    assert (await run(settings, db_session_factory))[0] == 0
    first = await counts(db_session)
    assert (await run(settings, db_session_factory))[0] == 0
    assert await counts(db_session) == first

    original = await db_session.scalar(select(CaseStudy.title).where(CaseStudy.seed_key == "cs:verdant-loop"))
    await db_session.execute(
        update(CaseStudy).where(CaseStudy.seed_key == "cs:verdant-loop").values(title="Edited by the admin")
    )
    await db_session.execute(update(SiteSettings).values(footer_signoff="Admin sign-off"))
    await db_session.commit()

    assert (await run(settings, db_session_factory))[0] == 0
    kept = await db_session.scalar(
        select(CaseStudy.title).where(CaseStudy.seed_key == "cs:verdant-loop").execution_options(populate_existing=True)
    )
    assert kept == "Edited by the admin"
    assert await db_session.scalar(select(SiteSettings.footer_signoff)) == "Admin sign-off"
    assert await counts(db_session) == first

    code, out, _err = await run(settings, db_session_factory, "--reset")
    assert code == 0
    assert "reset to seed values" in out
    restored = await db_session.scalar(
        select(CaseStudy.title).where(CaseStudy.seed_key == "cs:verdant-loop").execution_options(populate_existing=True)
    )
    assert restored == original
    signoff = await db_session.scalar(select(SiteSettings.footer_signoff).execution_options(populate_existing=True))
    assert signoff != "Admin sign-off"
    assert await counts(db_session) == first


@pytest.mark.be_t("BE-T-101")
@pytest.mark.parametrize("app_env", [AppEnv.TEST, AppEnv.PRODUCTION])
async def test_seed_outside_development_has_no_enquiries(
    db_settings: Settings,
    db_session_factory: Callable[[], AsyncSession],
    db_session: AsyncSession,
    media_root: Path,
    app_env: AppEnv,
) -> None:
    code, out, err = await run(seed_settings(db_settings, media_root, app_env), db_session_factory)
    assert code == 0, err
    assert "no sample enquiries" in out
    found = await counts(db_session)
    assert found[Enquiry] == 0
    for model, expected in EXPECTED.items():
        assert found[model] == expected


@pytest.mark.be_t("BE-T-102")
@pytest.mark.sec("SEC-007")
async def test_seed_images_exist_are_local_and_deterministic(
    db_settings: Settings,
    db_session_factory: Callable[[], AsyncSession],
    db_session: AsyncSession,
    media_root: Path,
) -> None:
    settings = seed_settings(db_settings, media_root, AppEnv.TEST)
    assert (await run(settings, db_session_factory))[0] == 0
    rows = (await db_session.execute(select(MediaAsset))).scalars().all()
    assert rows
    assert all(row.source == "seed" and row.mime == "image/svg+xml" for row in rows)
    referenced: set[Any] = set()
    referenced |= set((await db_session.execute(select(CaseStudy.cover_media_id))).scalars().all())
    referenced |= set((await db_session.execute(select(CaseStudyImage.media_id))).scalars().all())
    referenced |= set((await db_session.execute(select(WritingSample.thumbnail_media_id))).scalars().all())
    referenced |= set((await db_session.execute(select(Profile.portrait_media_id))).scalars().all())
    assert referenced <= {row.id for row in rows}

    snapshot: dict[str, bytes] = {}
    for row in rows:
        path = media_root / row.path
        assert path.is_file(), row.path
        assert path.resolve().is_relative_to((media_root / "seed").resolve())
        data = path.read_bytes()
        assert len(data) == row.bytes
        SafeET.fromstring(data, forbid_dtd=True)
        without_namespace = data.replace(b'xmlns="http://www.w3.org/2000/svg"', b"").lower()
        for forbidden in (b"http", b"https", b"@import", b"href", b"<image", b"<script", b"@font-face"):
            assert forbidden not in without_namespace, (row.path, forbidden)
        assert re.findall(rb"url\((?!#)", data) == []
        snapshot[row.path] = data

    assert (await run(settings, db_session_factory, "--reset"))[0] == 0
    for relative, data in snapshot.items():
        assert (media_root / relative).read_bytes() == data


@pytest.mark.be_t("BE-T-103")
async def test_seed_failure_rolls_back_everything(
    db_settings: Settings,
    db_session_factory: Callable[[], AsyncSession],
    db_session: AsyncSession,
    media_root: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    before = await counts(db_session)
    marker = await db_session.scalar(select(SiteSettings.content_changed_at))
    original = seed_repository.upsert_by_seed_key
    calls = {"n": 0}

    async def failing(*args: Any, **kwargs: Any) -> Any:
        calls["n"] += 1
        if calls["n"] == 30:
            raise RuntimeError("simulated failure mid-seed")
        return await original(*args, **kwargs)

    monkeypatch.setattr(seed_repository, "upsert_by_seed_key", failing)
    code, out, err = await run(seed_settings(db_settings, media_root, AppEnv.DEVELOPMENT), db_session_factory)
    assert code == 1
    assert out == ""
    assert "seeding failed (RuntimeError)" in err
    assert "Nothing was changed" in err
    assert await counts(db_session) == before
    after_marker = await db_session.scalar(
        select(SiteSettings.content_changed_at).execution_options(populate_existing=True)
    )
    assert after_marker == marker
