"""BE-021 dashboard: BE-T-095, BE-T-096 (plus build-info parsing rules of SEC-BE-017)."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Enquiry, SiteSettings
from app.services.build_info import MalformedBuildInfoError, parse_build_info
from app.services.dashboard import REBUILD_COMMAND
from tests import factories
from tests.conftest import ALLOWED_ORIGIN, BASE_URL

URL = "/api/admin/dashboard"
CHANGED = datetime(2026, 5, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def dist_dir(tmp_path: Path) -> Path:
    folder = tmp_path / "dist"
    folder.mkdir()
    return folder


@pytest.fixture
async def dashboard_client(
    db_app_factory: Callable[..., FastAPI], db_session: AsyncSession, dist_dir: Path
) -> AsyncIterator[httpx.AsyncClient]:
    app = db_app_factory(frontend_dist_dir=dist_dir)
    admin = await factories.admin_user(db_session)
    _row, token, csrf = await factories.admin_session(db_session, admin.id)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=BASE_URL,
        cookies={"mp_session": token, "mp_csrf": csrf},
        headers={"X-CSRF-Token": csrf, "Origin": ALLOWED_ORIGIN},
    ) as client:
        yield client


async def set_changed_at(session: AsyncSession, moment: datetime) -> None:
    await session.execute(update(SiteSettings).values(content_changed_at=moment))
    await session.flush()


def write_build_info(dist_dir: Path, snapshot: datetime, **extra: Any) -> None:
    document = {"built_at": (snapshot + timedelta(minutes=1)).isoformat(), "content_snapshot_at": snapshot.isoformat()}
    document.update(extra)
    (dist_dir / "build-info.json").write_text(json.dumps(document), encoding="utf-8")


@pytest.mark.be_t("BE-T-095")
async def test_dashboard_rebuild_state(
    dashboard_client: httpx.AsyncClient,
    db_session: AsyncSession,
    dist_dir: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    await set_changed_at(db_session, CHANGED)
    missing = (await dashboard_client.get(URL)).json()
    assert missing["last_build"] is None
    assert missing["needs_rebuild"] is True

    write_build_info(dist_dir, CHANGED - timedelta(minutes=5), pages=20, app_version="0.1.0")
    stale = (await dashboard_client.get(URL)).json()
    assert stale["needs_rebuild"] is True
    assert datetime.fromisoformat(stale["last_build"]["content_snapshot_at"]) == CHANGED - timedelta(minutes=5)

    write_build_info(dist_dir, CHANGED + timedelta(minutes=5))
    fresh = (await dashboard_client.get(URL)).json()
    assert fresh["needs_rebuild"] is False
    assert datetime.fromisoformat(fresh["content_changed_at"]) == CHANGED

    (dist_dir / "build-info.json").write_text("{not json", encoding="utf-8")
    with caplog.at_level(logging.WARNING):
        malformed = (await dashboard_client.get(URL)).json()
    assert malformed["last_build"] is None
    assert malformed["needs_rebuild"] is True
    assert any(record.getMessage() == "build_info.malformed" for record in caplog.records)


@pytest.mark.be_t("BE-T-096")
async def test_dashboard_counts_and_command(
    dashboard_client: httpx.AsyncClient, db_session: AsyncSession, query_counter: Callable[[], Any]
) -> None:
    for status in ("new", "new", "replied"):
        db_session.add(
            Enquiry(
                name="Fictional Sender",
                email="sender@example.com",
                enquiry_type="other",
                message="Hello",
                status=status,
            )
        )
    await factories.case_study(db_session, is_published=True)
    await factories.case_study(db_session, is_published=False)
    await factories.service(db_session, is_published=True)
    category = await factories.faq_category(db_session, is_published=True)
    await factories.faq(db_session, category.id, is_published=False)
    await db_session.flush()
    await dashboard_client.get(URL)  # warm-up: the session's last_seen_at refresh happens at most once a minute
    with query_counter() as counter:
        response = await dashboard_client.get(URL)
    body = response.json()
    assert response.status_code == 200
    assert body["new_enquiries"] == 2
    assert body["rebuild_command"] == REBUILD_COMMAND == "cd frontend; npm run build:site"
    counts = body["content_counts"]
    assert set(counts) == {
        "case_studies",
        "writing_samples",
        "services",
        "engagement_models",
        "testimonials",
        "faq_categories",
        "faqs",
        "values",
        "process_steps",
    }
    assert counts["case_studies"] == {"total": 2, "published": 1}
    assert counts["services"] == {"total": 1, "published": 1}
    assert counts["faq_categories"] == {"total": 1, "published": 1}
    assert counts["faqs"] == {"total": 1, "published": 0}
    assert counts["values"] == {"total": 0, "published": 0}
    for _ in range(5):  # more rows must not mean more statements
        await factories.service(db_session)
        await factories.writing_sample(db_session)
    await db_session.flush()
    with query_counter() as again:
        await dashboard_client.get(URL)
    assert again.count == counter.count
    summary_statements = [sql for sql in counter.statements if "count(" in sql.lower()]
    assert len(summary_statements) == 1


@pytest.mark.sec("SEC-BE-017")
@pytest.mark.parametrize(
    "raw",
    [
        b"[]",
        b'{"built_at": "2026-01-01T00:00:00+00:00"}',
        b'{"built_at": "2026-01-01T00:00:00", "content_snapshot_at": "2026-01-01T00:00:00"}',
        b'{"built_at": 1, "content_snapshot_at": "2026-01-01T00:00:00+00:00"}',
        b'{"built_at": "yesterday", "content_snapshot_at": "2026-01-01T00:00:00+00:00"}',
        b'{"built_at": "2026-01-01T00:00:00Z", "content_snapshot_at": "2026-01-01T00:00:00Z", "pages": "many"}',
        b'{"built_at": "2026-01-01T00:00:00Z", "content_snapshot_at": "2026-01-01T00:00:00Z", "pages": true}',
        b"\xff\xfe",
        b'{"pad": "' + b"x" * (64 * 1024) + b'"}',
    ],
)
def test_build_info_rejects_malformed_documents(raw: bytes) -> None:
    with pytest.raises(MalformedBuildInfoError):
        parse_build_info(raw)


def test_build_info_accepts_valid_document() -> None:
    info = parse_build_info(
        b'{"built_at": "2026-01-01T10:00:00Z", "content_snapshot_at": "2026-01-01T09:59:00+00:00", "pages": 21}'
    )
    assert info.content_snapshot_at == datetime(2026, 1, 1, 9, 59, tzinfo=UTC)
