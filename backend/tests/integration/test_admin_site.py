"""BE-018 preview endpoint (BE-T-088) and BE-019 profile/settings (BE-T-089..BE-T-091, BE-T-111, BE-T-112,
SEC-BE-014 via the API)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Profile, SiteSettings
from app.models.singletons import (
    CONTACT_PROMISE_DEFAULT,
    FOOTER_RIGHTS_LINE_DEFAULT,
    PROFILE_PLACEHOLDER,
    SETTINGS_PLACEHOLDER,
)
from app.services.markdown import render_markdown
from tests import factories
from tests.conftest import ALLOWED_ORIGIN, api_client

PREVIEW = "/api/admin/markdown/preview"


@pytest.mark.be_t("BE-T-088")
async def test_markdown_preview_limits_and_same_html(admin_client: httpx.AsyncClient, db_app: FastAPI) -> None:
    source = "# Title\n\n" + "word " * 19_998
    source = source[:100_000].ljust(100_000, "x")
    assert len(source) == 100_000
    ok = await admin_client.post(PREVIEW, json={"markdown": source})
    assert ok.status_code == 200, ok.text
    rendered = render_markdown(source)
    assert ok.json() == {
        "html": rendered.html,
        "word_count": rendered.word_count,
        "reading_time_min": rendered.reading_time_min,
    }
    too_long = await admin_client.post(PREVIEW, json={"markdown": source + "y"})
    assert too_long.status_code == 422
    assert "markdown" in too_long.json()["error"]["fields"]

    async with api_client(db_app, headers={"Origin": ALLOWED_ORIGIN}) as anonymous:
        assert (await anonymous.post(PREVIEW, json={"markdown": "x"})).status_code == 401


async def test_markdown_preview_keeps_leading_indentation_and_accepts_empty(admin_client: httpx.AsyncClient) -> None:
    code_block = await admin_client.post(PREVIEW, json={"markdown": "    indented code"})
    assert code_block.json()["html"] == "<pre><code>indented code\n</code></pre>\n"
    empty = await admin_client.post(PREVIEW, json={"markdown": ""})
    assert empty.json() == {"html": "", "word_count": 0, "reading_time_min": 1}
    nul = await admin_client.post(PREVIEW, json={"markdown": "a\x00b"})
    assert nul.status_code == 422


def _profile(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": "Mitali Example",
        "headline": "Content strategist for growing brands",
        "bio": ["First paragraph.", "Second paragraph."],
        "skills": ["SEO", "Email"],
        "tools": ["Notion"],
        "years_experience": 9,
        "origin_statement": "Started in a newsroom.",
        "vision_blocks": [{"heading": "Vision", "body": "Clear words."}, {"heading": "Mission", "body": "Help."}],
        "portrait_media_id": None,
        "portrait_alt": None,
    }
    body.update(overrides)
    return body


def _settings(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "contact_email": "hello@example.com",
        "booking_url": "https://booking.example.com/mitali",
        "social_links": [{"label": "LinkedIn", "url": "https://www.example.com/in/mitali"}],
        "footer_signoff": "Write soon",
        "contact_promise": "I answer every message within two working days.",
        "footer_rights_line": "All words fictional, all rights reserved.",
        "notification_email": "alerts@example.com",
    }
    body.update(overrides)
    return body


async def _changed_at(session: AsyncSession) -> datetime:
    statement = select(SiteSettings.content_changed_at).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


@pytest.mark.be_t("BE-T-089")
async def test_profile_and_settings_get_placeholders_and_put_updates(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    profile = (await admin_client.get("/api/admin/profile")).json()
    assert profile["name"] == PROFILE_PLACEHOLDER["name"]
    assert profile["vision_blocks"] == PROFILE_PLACEHOLDER["vision_blocks"]
    assert profile["portrait"] is None
    settings = (await admin_client.get("/api/admin/settings")).json()
    assert settings["contact_email"] == SETTINGS_PLACEHOLDER["contact_email"]
    assert "content_changed_at" in settings

    before = await _changed_at(db_session)
    media = await factories.media_asset(db_session, variants=[{"width": 480, "path": "uploads/2026/10/p-480.webp"}])
    updated = await admin_client.put(
        "/api/admin/profile", json=_profile(portrait_media_id=str(media.id), portrait_alt="Portrait of Mitali")
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["name"] == "Mitali Example"
    assert body["portrait"]["alt"] == "Portrait of Mitali"
    assert body["portrait"]["srcset"][0]["url"] == "/media/uploads/2026/10/p-480.webp"
    after_profile = await _changed_at(db_session)
    assert after_profile > before

    saved = await admin_client.put("/api/admin/settings", json=_settings())
    assert saved.status_code == 200, saved.text
    assert saved.json()["booking_url"] == "https://booking.example.com/mitali"
    assert datetime.fromisoformat(saved.json()["content_changed_at"]) > after_profile
    assert await _changed_at(db_session) > after_profile

    public = (await admin_client.get("/api/public/site")).json()
    assert public["profile"]["portrait"]["alt"] == "Portrait of Mitali"
    assert public["settings"]["footer_signoff"] == "Write soon"


@pytest.mark.be_t("BE-T-089")
async def test_settings_content_changed_at_is_not_writable(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    before = await _changed_at(db_session)
    response = await admin_client.put("/api/admin/settings", json=_settings(content_changed_at="2000-01-01T00:00:00Z"))
    assert response.status_code == 422
    assert "content_changed_at" in response.json()["error"]["fields"]
    assert await _changed_at(db_session) == before


async def _settings_row(session: AsyncSession) -> SiteSettings:
    statement = select(SiteSettings).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


@pytest.mark.be_t("BE-T-090")
@pytest.mark.sec("SEC-BE-014")
@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"contact_email": "not-an-email"}, "contact_email"),
        ({"booking_url": "ftp://x"}, "booking_url"),
        ({"booking_url": "javascript:alert(1)"}, "booking_url"),
        ({"booking_url": "https://user:pw@example.com"}, "booking_url"),
        ({"booking_url": "//evil.example"}, "booking_url"),
        ({"booking_url": "https://exa mple.com"}, "booking_url"),
        ({"social_links": [{"label": "Mail", "url": "mailto:a@example.com"}]}, "social_links.0.url"),
        ({"social_links": [{"label": "", "url": "https://example.com"}]}, "social_links.0.label"),
        ({"notification_email": "nope"}, "notification_email"),
        ({"footer_signoff": "x" * 121}, "footer_signoff"),
    ],
)
async def test_settings_invalid_values_are_422_and_nothing_saved(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, overrides: dict[str, Any], field: str
) -> None:
    before = await _settings_row(db_session)
    snapshot = (before.contact_email, before.booking_url, before.footer_signoff, before.updated_at)
    response = await admin_client.put("/api/admin/settings", json=_settings(**overrides))
    assert response.status_code == 422
    assert field in response.json()["error"]["fields"]
    after = await _settings_row(db_session)
    assert (after.contact_email, after.booking_url, after.footer_signoff, after.updated_at) == snapshot


@pytest.mark.be_t("BE-T-090")
@pytest.mark.parametrize(
    ("value", "stored"),
    [("#", "#"), (None, None), ("", None), ("HTTPS://Booking.EXAMPLE.com/Path", "https://booking.example.com/Path")],
)
async def test_settings_booking_url_accepted_forms(
    admin_client: httpx.AsyncClient, value: str | None, stored: str | None
) -> None:
    response = await admin_client.put(
        "/api/admin/settings",
        json=_settings(booking_url=value, social_links=[{"label": "Site", "url": "http://example.com"}]),
    )
    assert response.status_code == 200, response.text
    assert response.json()["booking_url"] == stored


@pytest.mark.be_t("BE-T-091")
@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"bio": [f"P{i}" for i in range(7)]}, "bio"),
        ({"bio": []}, "bio"),
        ({"vision_blocks": [{"heading": "a", "body": "b"}] * 3}, "vision_blocks"),
        ({"skills": [f"s{i}" for i in range(31)]}, "skills"),
        ({"portrait_media_id": str(uuid.uuid4()), "portrait_alt": None}, "portrait_alt"),
        ({"years_experience": 61}, "years_experience"),
        ({"name": "Name\x00"}, "name"),
        ({"tools": ["x" * 61]}, "tools.0"),
    ],
)
async def test_profile_invalid_values_are_422_and_nothing_saved(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, overrides: dict[str, Any], field: str
) -> None:
    response = await admin_client.put("/api/admin/profile", json=_profile(**overrides))
    assert response.status_code == 422
    assert field in response.json()["error"]["fields"]
    name = (await db_session.execute(select(Profile.name).execution_options(populate_existing=True))).scalar_one()
    assert name == PROFILE_PLACEHOLDER["name"]


@pytest.mark.be_t("BE-T-091")
async def test_profile_unknown_portrait_media_is_422_field(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    before = await _changed_at(db_session)
    response = await admin_client.put(
        "/api/admin/profile", json=_profile(portrait_media_id=str(uuid.uuid4()), portrait_alt="Alt")
    )
    assert response.status_code == 422
    assert set(response.json()["error"]["fields"]) == {"portrait_media_id"}
    assert await _changed_at(db_session) == before


# ---------------------------------------------------------------------------------------------- CHG-005


async def _copy_fields(session: AsyncSession) -> tuple[str, str, datetime]:
    row = await _settings_row(session)
    return row.contact_promise, row.footer_rights_line, row.content_changed_at


@pytest.mark.be_t("BE-T-111")
@pytest.mark.parametrize("field", ["contact_promise", "footer_rights_line"])
@pytest.mark.parametrize("value", [None, "", "   ", "x" * 201, "two\nlines"])
async def test_settings_copy_fields_invalid_values_are_422_and_nothing_saved(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, field: str, value: str | None
) -> None:
    body = _settings()
    if value is None:
        del body[field]
    else:
        body[field] = value
    before = await _copy_fields(db_session)
    response = await admin_client.put("/api/admin/settings", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert set(response.json()["error"]["fields"]) == {field}
    assert await _copy_fields(db_session) == before


@pytest.mark.be_t("BE-T-111")
@pytest.mark.parametrize("field", ["contact_promise", "footer_rights_line"])
async def test_settings_copy_fields_accept_200_chars_and_store_trimmed(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, field: str
) -> None:
    before = await _changed_at(db_session)
    exactly = "y" * 200
    response = await admin_client.put("/api/admin/settings", json=_settings(**{field: exactly}))
    assert response.status_code == 200, response.text
    assert response.json()[field] == exactly
    assert getattr(await _settings_row(db_session), field) == exactly
    assert await _changed_at(db_session) > before

    padded = await admin_client.put("/api/admin/settings", json=_settings(**{field: "  Text  "}))
    assert padded.status_code == 200
    assert padded.json()[field] == "Text"
    assert getattr(await _settings_row(db_session), field) == "Text"


@pytest.mark.be_t("BE-T-112")
async def test_settings_copy_fields_in_admin_and_public_responses(admin_client: httpx.AsyncClient) -> None:
    admin = (await admin_client.get("/api/admin/settings")).json()
    public = (await admin_client.get("/api/public/site")).json()["settings"]
    for body in (admin, public):
        assert body["contact_promise"] == CONTACT_PROMISE_DEFAULT
        assert body["footer_rights_line"] == FOOTER_RIGHTS_LINE_DEFAULT
    assert "you're" in CONTACT_PROMISE_DEFAULT  # apostrophe intact end to end

    saved = await admin_client.put(
        "/api/admin/settings",
        json=_settings(contact_promise="Replies within one day.", footer_rights_line="Rights line, updated."),
    )
    assert saved.status_code == 200, saved.text
    admin = (await admin_client.get("/api/admin/settings")).json()
    public = (await admin_client.get("/api/public/site")).json()["settings"]
    for body in (admin, public):
        assert body["contact_promise"] == "Replies within one day."
        assert body["footer_rights_line"] == "Rights line, updated."
    assert "notification_email" not in public
    assert admin["notification_email"] == "alerts@example.com"
