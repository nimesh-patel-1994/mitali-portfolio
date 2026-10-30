"""BE-008/BE-009 admin auth: BE-T-016 (logging), BE-T-037..BE-T-044, SEC-BE-003 (fixation, Secure flag),
SEC-BE-004 (text/plain bodies), SEC-008 (audit event names)."""

from __future__ import annotations

import logging
import re
import threading
import uuid
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

import httpx
import pytest
from argon2 import PasswordHasher
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.logging import JsonFormatter
from app.models import AdminUser, Session
from tests import factories
from tests.conftest import ALLOWED_ORIGIN, api_client
from tests.harness import effective_api_routes

LOGIN = "/api/admin/auth/login"
ME = "/api/admin/auth/me"
LOGOUT = "/api/admin/auth/logout"
ORIGIN = {"Origin": ALLOWED_ORIGIN}


def _profile_body() -> dict[str, Any]:
    return {
        "name": "Mitali Example",
        "headline": "Content strategist",
        "bio": ["Paragraph one."],
        "skills": ["SEO"],
        "tools": [],
        "years_experience": 8,
        "origin_statement": "Origin.",
        "vision_blocks": [{"heading": "Vision", "body": "V"}, {"heading": "Mission", "body": "M"}],
        "portrait_media_id": None,
        "portrait_alt": None,
    }


def _set_cookies(response: httpx.Response) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for header in response.headers.get_list("set-cookie"):
        name = header.split("=", 1)[0]
        cookies[name] = header
    return cookies


def _cookie_value(header: str) -> str:
    return header.split(";", 1)[0].split("=", 1)[1].strip('"')


async def _login(app: FastAPI, *, email: str = factories.ADMIN_EMAIL, password: str = factories.ADMIN_PASSWORD,
                 ip: str = "127.0.0.1") -> httpx.Response:  # fmt: skip
    async with api_client(app, ip=ip, headers=ORIGIN) as client:
        return await client.post(LOGIN, json={"email": email, "password": password})


@pytest.mark.be_t("BE-T-037")
async def test_admin_login_sets_cookies_stores_hashes_and_last_login(db_app: FastAPI, db_session: AsyncSession) -> None:
    admin = await factories.admin_with_password(db_session)
    response = await _login(db_app, email="  ADMIN@Example.com ")
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"email", "csrf_token", "idle_expires_at", "absolute_expires_at"}
    assert body["email"] == "admin@example.com"

    cookies = _set_cookies(response)
    session_cookie = cookies["mp_session"]
    lowered = session_cookie.lower()
    assert "httponly" in lowered
    assert "samesite=strict" in lowered
    assert "path=/" in lowered
    assert "max-age=604800" in lowered
    assert "secure" not in lowered
    assert "domain=" not in lowered
    csrf_cookie = cookies["mp_csrf"].lower()
    assert "httponly" not in csrf_cookie
    assert "samesite=strict" in csrf_cookie
    assert _cookie_value(cookies["mp_csrf"]) == body["csrf_token"]

    token = _cookie_value(session_cookie)
    row = (await db_session.execute(select(Session).where(Session.admin_user_id == admin.id))).scalar_one()
    assert row.token_hash == security.token_hash(token)
    assert row.csrf_token_hash == security.token_hash(body["csrf_token"])
    assert token.encode() not in row.token_hash
    refreshed = (await db_session.execute(select(AdminUser).execution_options(populate_existing=True))).scalar_one()
    assert refreshed.last_login_at is not None


@pytest.mark.be_t("BE-T-037")
@pytest.mark.sec("SEC-BE-003")
async def test_admin_login_cookies_secure_when_configured(
    db_app_factory: Callable[..., FastAPI], db_session: AsyncSession
) -> None:
    await factories.admin_with_password(db_session)
    response = await _login(db_app_factory(session_cookie_secure=True))
    assert response.status_code == 200
    cookies = _set_cookies(response)
    assert "secure" in cookies["mp_session"].lower()
    assert "secure" in cookies["mp_csrf"].lower()


@pytest.mark.be_t("BE-T-038")
async def test_admin_login_wrong_password_and_unknown_email_identical(
    db_app: FastAPI, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await factories.admin_with_password(db_session)
    calls: list[str] = []
    real_verify = security.verify_password

    def spy(password_hash: str, password: str) -> bool:
        calls.append(password_hash)
        return real_verify(password_hash, password)

    monkeypatch.setattr(security, "verify_password", spy)
    wrong = await _login(db_app, password="definitely-not-it", ip="10.1.0.1")
    unknown = await _login(db_app, email="nobody@example.com", ip="10.1.0.2")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"] == {"code": "invalid_credentials", "message": "Email or password is incorrect."}
    assert len(calls) == 2
    assert calls[1] == security.dummy_hash()
    assert "set-cookie" not in wrong.headers


@pytest.mark.be_t("BE-T-038")
async def test_admin_login_argon2_work_runs_off_the_event_loop_on_both_failure_paths(
    db_app: FastAPI, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review m2: the dummy hash is created and verified in the threadpool, never on the event-loop thread."""
    await factories.admin_with_password(db_session)
    loop_thread = threading.get_ident()
    threads: list[tuple[str, int]] = []
    real_verify, real_dummy = security.verify_password, security.dummy_hash

    def verify_spy(password_hash: str, password: str) -> bool:
        threads.append(("verify", threading.get_ident()))
        return real_verify(password_hash, password)

    def dummy_spy() -> str:
        threads.append(("dummy", threading.get_ident()))
        return real_dummy()

    monkeypatch.setattr(security, "verify_password", verify_spy)
    monkeypatch.setattr(security, "dummy_hash", dummy_spy)
    assert (await _login(db_app, password="definitely-not-it", ip="10.1.0.3")).status_code == 401
    assert (await _login(db_app, email="nobody@example.com", ip="10.1.0.4")).status_code == 401
    assert [name for name, _ in threads] == ["verify", "dummy", "verify"]
    assert all(ident != loop_thread for _, ident in threads)


@pytest.mark.be_t("BE-T-038")
async def test_admin_login_invalid_body_is_422(db_app: FastAPI) -> None:
    async with api_client(db_app, headers=ORIGIN) as client:
        response = await client.post(LOGIN, json={"email": "not-an-email", "password": ""})
    assert response.status_code == 422
    assert set(response.json()["error"]["fields"]) == {"email", "password"}


@pytest.mark.be_t("BE-T-039")
async def test_admin_me_with_cookie_without_and_random(admin_client: httpx.AsyncClient, db_app: FastAPI) -> None:
    response = await admin_client.get(ME)
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == factories.ADMIN_EMAIL
    assert body["csrf_token"] == admin_client.headers["X-CSRF-Token"]
    assert "set-cookie" not in response.headers

    async with api_client(db_app) as anonymous:
        missing = await anonymous.get(ME)
    async with api_client(db_app, cookies={"mp_session": security.generate_token()}) as random_client:
        random = await random_client.get(ME)
    for result in (missing, random):
        assert result.status_code == 401
        assert result.json()["error"]["code"] == "unauthenticated"


async def test_admin_me_issues_new_csrf_token_when_cookie_missing(db_app: FastAPI, db_session: AsyncSession) -> None:
    admin = await factories.admin_user(db_session)
    _row, token, old_csrf = await factories.admin_session(db_session, admin.id)
    async with api_client(db_app, cookies={"mp_session": token}, headers=ORIGIN) as client:
        me = await client.get(ME)
        assert me.status_code == 200
        new_csrf = me.json()["csrf_token"]
        assert new_csrf != old_csrf
        assert _cookie_value(_set_cookies(me)["mp_csrf"]) == new_csrf
        put = await client.put("/api/admin/profile", json=_profile_body(), headers={"X-CSRF-Token": new_csrf})
        assert put.status_code == 200
        stale = await client.put("/api/admin/profile", json=_profile_body(), headers={"X-CSRF-Token": old_csrf})
        assert stale.status_code == 403


@pytest.mark.be_t("BE-T-040")
async def test_admin_logout_deletes_session_and_expires_cookies(
    admin_client: httpx.AsyncClient, db_app: FastAPI, db_session: AsyncSession
) -> None:
    token = admin_client.cookies["mp_session"]
    csrf = admin_client.cookies["mp_csrf"]
    response = await admin_client.post(LOGOUT)
    assert response.status_code == 204
    assert response.content == b""
    cookies = _set_cookies(response)
    for name in ("mp_session", "mp_csrf"):
        assert re.search(r"max-age=0", cookies[name].lower()), cookies[name]
    assert (await db_session.execute(select(func.count()).select_from(Session))).scalar_one() == 0

    async with api_client(db_app, cookies={"mp_session": token, "mp_csrf": csrf}, headers=ORIGIN) as old:
        assert (await old.get(ME)).status_code == 401
        put = await old.put("/api/admin/profile", json=_profile_body(), headers={"X-CSRF-Token": csrf})
        assert put.status_code == 401


@pytest.mark.be_t("BE-T-041")
async def test_session_idle_and_absolute_expiry_and_last_seen_refresh(
    db_app: FastAPI, db_session: AsyncSession, shift_time: Callable[..., Awaitable[None]]
) -> None:
    admin = await factories.admin_user(db_session)

    async def me_with(token: str) -> int:
        async with api_client(db_app, cookies={"mp_session": token}) as client:
            return (await client.get(ME)).status_code

    async def exists(row_id: uuid.UUID) -> bool:
        statement = select(func.count()).select_from(Session).where(Session.id == row_id)
        return bool((await db_session.execute(statement)).scalar_one())

    idle, idle_token, _ = await factories.admin_session(db_session, admin.id)
    await shift_time(Session.last_seen_at, -timedelta(hours=8, minutes=1), Session.id == idle.id)
    assert await me_with(idle_token) == 401
    assert not await exists(idle.id)

    absolute, absolute_token, _ = await factories.admin_session(db_session, admin.id)
    await shift_time(Session.absolute_expires_at, -timedelta(days=8), Session.id == absolute.id)
    assert await me_with(absolute_token) == 401
    assert not await exists(absolute.id)

    async def last_seen(row_id: uuid.UUID) -> Any:
        statement = select(Session.last_seen_at).where(Session.id == row_id)
        return (await db_session.execute(statement)).scalar_one()

    recent, recent_token, _ = await factories.admin_session(db_session, admin.id)
    await shift_time(Session.last_seen_at, -timedelta(seconds=30), Session.id == recent.id)
    before = await last_seen(recent.id)
    assert await me_with(recent_token) == 200
    assert await last_seen(recent.id) == before

    older, older_token, _ = await factories.admin_session(db_session, admin.id)
    await shift_time(Session.last_seen_at, -timedelta(minutes=2), Session.id == older.id)
    before = await last_seen(older.id)
    assert await me_with(older_token) == 200
    assert await last_seen(older.id) > before


@pytest.mark.be_t("BE-T-042")
async def test_admin_login_rehashes_weak_hash(db_app: FastAPI, db_session: AsyncSession) -> None:
    weak = PasswordHasher(time_cost=1, memory_cost=8192, parallelism=1).hash(factories.ADMIN_PASSWORD)
    admin = await factories.admin_with_password(db_session, password_hash=weak)
    assert (await _login(db_app)).status_code == 200
    stored = (
        await db_session.execute(
            select(AdminUser.password_hash).where(AdminUser.id == admin.id).execution_options(populate_existing=True)
        )
    ).scalar_one()
    assert stored != weak
    assert stored.startswith("$argon2id$v=19$m=65536,t=3,p=4$")
    assert not security.needs_rehash(stored)
    assert security.verify_password(stored, factories.ADMIN_PASSWORD)


@pytest.mark.be_t("BE-T-043")
async def test_csrf_header_rules_on_admin_put(
    admin_client: httpx.AsyncClient, db_app: FastAPI, db_session: AsyncSession
) -> None:
    other_admin_id = (await db_session.execute(select(AdminUser.id))).scalar_one()
    _other_row, _other_token, other_csrf = await factories.admin_session(db_session, other_admin_id)
    token = admin_client.cookies["mp_session"]
    csrf = admin_client.cookies["mp_csrf"]

    async def put(cookies: dict[str, str], header: str | None) -> httpx.Response:
        headers = dict(ORIGIN)
        if header is not None:
            headers["X-CSRF-Token"] = header
        async with api_client(db_app, cookies=cookies, headers=headers) as client:
            return await client.put("/api/admin/profile", json=_profile_body())

    without = await put({"mp_session": token, "mp_csrf": csrf}, None)
    mismatch = await put({"mp_session": token, "mp_csrf": csrf}, csrf + "x")
    foreign = await put({"mp_session": token, "mp_csrf": other_csrf}, other_csrf)
    for response in (without, mismatch, foreign):
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "csrf_failed"
    valid = await put({"mp_session": token, "mp_csrf": csrf}, csrf)
    assert valid.status_code == 200


def _concrete(path: str) -> str:
    return re.sub(r"\{[^}]+\}", str(uuid.uuid4()), path)


@pytest.mark.be_t("BE-T-044")
async def test_every_admin_route_needs_session_and_csrf(admin_client: httpx.AsyncClient, db_app: FastAPI) -> None:
    routes = [
        route
        for route in effective_api_routes(db_app)
        if route.path.startswith("/api/admin") and route.operation_id != "adminLogin"
    ]
    assert {route.operation_id for route in routes} >= {"adminLogout", "getAdminMe", "previewAdminMarkdown"}
    cookies = {"mp_session": admin_client.cookies["mp_session"], "mp_csrf": admin_client.cookies["mp_csrf"]}
    async with (
        api_client(db_app, headers=ORIGIN) as anonymous,
        api_client(db_app, cookies=cookies, headers=ORIGIN) as no_header,
    ):
        for route in routes:
            for method in sorted(route.methods):
                url = _concrete(route.path)
                kwargs: dict[str, Any] = {} if method in {"GET", "DELETE"} else {"json": {}}
                response = await anonymous.request(method, url, **kwargs)
                assert response.status_code == 401, (method, url)
                assert response.json()["error"]["code"] == "unauthenticated"
                if method != "GET":
                    rejected = await no_header.request(method, url, **kwargs)
                    assert rejected.status_code == 403, (method, url)
                    assert rejected.json()["error"]["code"] == "csrf_failed"


@pytest.mark.sec("SEC-BE-003")
async def test_login_with_existing_session_cookie_issues_a_new_token(db_app: FastAPI, db_session: AsyncSession) -> None:
    admin = await factories.admin_with_password(db_session)
    _row, presented, _csrf = await factories.admin_session(db_session, admin.id)
    async with api_client(db_app, cookies={"mp_session": presented}, headers=ORIGIN) as client:
        response = await client.post(LOGIN, json={"email": factories.ADMIN_EMAIL, "password": factories.ADMIN_PASSWORD})
    assert response.status_code == 200
    issued = _cookie_value(_set_cookies(response)["mp_session"])
    assert issued != presented


@pytest.mark.sec("SEC-BE-004")
async def test_admin_json_routes_refuse_text_plain_bodies(admin_client: httpx.AsyncClient) -> None:
    before = (await admin_client.get("/api/admin/profile")).json()
    response = await admin_client.put(
        "/api/admin/profile",
        content=httpx.Response(200, json={**_profile_body(), "name": "Changed"}).content,
        headers={"Content-Type": "text/plain"},
    )
    assert 400 <= response.status_code < 500
    assert (await admin_client.get("/api/admin/profile")).json() == before


@pytest.mark.be_t("BE-T-016")
@pytest.mark.sec("SEC-008")
async def test_logs_hold_no_secrets_or_personal_data(
    db_app: FastAPI, db_session: AsyncSession, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    await factories.admin_with_password(db_session)
    ip = "203.0.113.77"
    wrong = await _login(db_app, password="wrong-password-value", ip=ip)
    good = await _login(db_app, ip=ip)
    assert (wrong.status_code, good.status_code) == (401, 200)
    token = _cookie_value(_set_cookies(good)["mp_session"])
    csrf = good.json()["csrf_token"]
    async with api_client(db_app, ip=ip) as client:
        contact = await client.post(
            "/api/public/enquiries",
            json={
                "name": "Quinn Private",
                "email": "quinn.private@example.com",
                "enquiry_type": "other",
                "message": "Confidential brief about Project Lumen",
            },
        )
    assert contact.status_code == 201
    async with api_client(
        db_app, ip=ip, cookies={"mp_session": token, "mp_csrf": csrf}, headers={**ORIGIN, "X-CSRF-Token": "forged"}
    ) as client:
        assert (await client.put("/api/admin/profile", json=_profile_body())).status_code == 403

    written = "\n".join(JsonFormatter().format(record) for record in caplog.records)
    for secret in (
        factories.ADMIN_PASSWORD,
        "wrong-password-value",
        factories.ADMIN_EMAIL,
        "quinn.private@example.com",
        "Quinn Private",
        "Project Lumen",
        ip,
        token,
        csrf,
        "forged",
    ):
        assert secret not in written, secret
    events = [record.getMessage() for record in caplog.records if record.name == "app.audit"]
    assert events == ["auth.login_failed", "auth.login_succeeded", "auth.csrf_failed"]
    access = [record for record in caplog.records if record.getMessage() == "http.request"]
    assert len(access) == 4


@pytest.mark.be_t("BE-T-038")
async def test_password_reset_between_verification_and_session_start_refuses_login(
    db_app: FastAPI, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review round 3: a reset that lands after verification must not let the old password start a session."""
    from app.repositories import admin_users

    admin = await factories.admin_with_password(db_session)
    real_lookup = admin_users.get_by_id_for_update
    new_hash = security.hash_password("a-completely-new-password-123")

    async def reset_then_lookup(session: AsyncSession, admin_id: uuid.UUID) -> AdminUser | None:
        await admin_users.set_password_hash(session, admin_id, new_hash, now=security_now(), changed=True)
        return await real_lookup(session, admin_id)

    monkeypatch.setattr(admin_users, "get_by_id_for_update", reset_then_lookup)
    response = await _login(db_app, ip="10.1.0.9")
    assert response.status_code == 401
    assert "mp_session" not in _set_cookies(response)
    count = (await db_session.execute(select(func.count()).select_from(Session))).scalar_one()
    assert count == 0
    stored = (
        await db_session.execute(
            select(AdminUser.password_hash).where(AdminUser.id == admin.id).execution_options(populate_existing=True)
        )
    ).scalar_one()
    assert stored != new_hash  # the simulated reset ran inside the refused (rolled back) transaction


def security_now() -> Any:
    from app.services.auth import utcnow

    return utcnow()
