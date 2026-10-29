"""Middleware (BE-004): Origin check BE-T-014, headers BE-T-015, logging BE-T-016 (part), Host allow-list
(SEC-BE-016) and strict JSON content type (SEC-BE-004). No database needed."""

from __future__ import annotations

import json
import logging

import httpx
import pytest

from app.core.logging import JsonFormatter

PROBE_BODY = {
    "name": "Probe",
    "email": "person@example.com",
    "password": "pw-Secret-123!",
    "message": "hello there",
}


@pytest.mark.be_t("BE-T-014")
async def test_admin_post_without_origin_or_referer_is_rejected(probe_client: httpx.AsyncClient) -> None:
    response = await probe_client.post("/api/admin/_probe", json=PROBE_BODY)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "origin_rejected"


@pytest.mark.be_t("BE-T-014")
@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://evil.example"},
        {"Origin": "null"},
        {"Origin": "http://localhost:5174"},
        {"Origin": "http://localhost:5173.evil.example"},
        {"Referer": "https://evil.example/admin"},
        # A present but foreign Origin is not rescued by an allowed Referer.
        {"Origin": "https://evil.example", "Referer": "http://localhost:5173/admin"},
    ],
)
async def test_admin_post_with_foreign_origin_is_rejected(
    probe_client: httpx.AsyncClient, headers: dict[str, str]
) -> None:
    for method in ("POST", "PUT", "PATCH", "DELETE"):
        response = await probe_client.request(method, "/api/admin/_probe", json=PROBE_BODY, headers=headers)
        assert response.status_code == 403, method
        assert response.json()["error"]["code"] == "origin_rejected"


@pytest.mark.be_t("BE-T-014")
async def test_admin_post_with_allowed_referer_or_origin_passes(probe_client: httpx.AsyncClient) -> None:
    by_referer = await probe_client.post(
        "/api/admin/_probe",
        json=PROBE_BODY,
        headers={"Referer": "http://localhost:5173/admin/case-studies?x=1"},
    )
    assert by_referer.status_code == 200
    by_origin = await probe_client.post(
        "/api/admin/_probe", json=PROBE_BODY, headers={"Origin": "http://127.0.0.1:8000"}
    )
    assert by_origin.status_code == 200


@pytest.mark.be_t("BE-T-014")
async def test_get_requests_need_no_origin(probe_client: httpx.AsyncClient) -> None:
    assert (await probe_client.get("/api/admin/_probe")).status_code == 200
    # Public non-GET routes are outside the admin Origin check.
    assert (await probe_client.post("/api/public/_probe", json=PROBE_BODY)).status_code == 200


@pytest.mark.be_t("BE-T-015")
async def test_security_headers_on_public_and_admin_api(probe_client: httpx.AsyncClient) -> None:
    public = await probe_client.get("/api/public/_probe")
    admin = await probe_client.get("/api/admin/_probe")
    for response in (public, admin):
        assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Cross-Origin-Resource-Policy"] == "same-origin"
        assert len(response.headers["X-Request-ID"]) == 32
        assert "server" not in {key.lower() for key in response.headers}
    assert "X-Robots-Tag" not in public.headers
    assert admin.headers["X-Robots-Tag"] == "noindex, nofollow"
    assert admin.headers["Cache-Control"] == "no-store"
    assert public.headers["X-Request-ID"] != admin.headers["X-Request-ID"]


@pytest.mark.be_t("BE-T-015")
async def test_security_headers_also_on_error_responses(probe_client: httpx.AsyncClient) -> None:
    for response in (
        await probe_client.get("/api/admin/missing"),
        await probe_client.post("/api/admin/_probe", json=PROBE_BODY),  # 403 from the Origin check
        await probe_client.get("/api/public/_boom"),
    ):
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
        assert "X-Request-ID" in response.headers
    admin_error = await probe_client.get("/api/admin/missing")
    assert admin_error.headers["Cache-Control"] == "no-store"


@pytest.mark.sec("SEC-BE-016")
async def test_unknown_host_header_is_rejected(probe_client: httpx.AsyncClient) -> None:
    rejected = await probe_client.get("/api/public/_probe", headers={"Host": "evil.example"})
    assert rejected.status_code == 400
    assert rejected.headers["X-Content-Type-Options"] == "nosniff"
    ok = await probe_client.get("/api/public/_probe", headers={"Host": "127.0.0.1:8000"})
    assert ok.status_code == 200
    ok_localhost = await probe_client.get("/api/public/_probe", headers={"Host": "localhost:5173"})
    assert ok_localhost.status_code == 200


@pytest.mark.sec("SEC-BE-004")
async def test_admin_json_route_rejects_text_plain_body(probe_client: httpx.AsyncClient, allowed_origin: str) -> None:
    response = await probe_client.post(
        "/api/admin/_probe",
        content=json.dumps(PROBE_BODY).encode(),
        headers={"Content-Type": "text/plain", "Origin": allowed_origin},
    )
    assert 400 <= response.status_code < 500
    assert response.json()["error"]["code"] == "validation_error"


def _formatted(records: list[logging.LogRecord]) -> list[str]:
    formatter = JsonFormatter()
    return [formatter.format(record) for record in records]


@pytest.mark.be_t("BE-T-016")
@pytest.mark.sec("SEC-008")
async def test_access_log_has_one_line_per_request_and_no_sensitive_values(
    probe_client: httpx.AsyncClient, allowed_origin: str, caplog: pytest.LogCaptureFixture
) -> None:
    """Part of BE-T-016 available in this batch; login, contact and CSRF cases are added with BE-007..BE-009."""
    caplog.set_level(logging.INFO)
    cookies = {"mp_session": "session-token-SECRET", "mp_csrf": "csrf-token-SECRET"}
    headers = {"X-CSRF-Token": "csrf-token-SECRET", "Origin": allowed_origin}
    probe_client.cookies.update(cookies)
    await probe_client.put("/api/admin/_probe", json=PROBE_BODY, headers=headers)
    await probe_client.put("/api/admin/_probe", json={**PROBE_BODY, "name": ""}, headers=headers)  # 422
    await probe_client.post("/api/admin/_probe", json=PROBE_BODY)  # 403 origin_rejected
    await probe_client.get("/api/public/_boom")  # 500

    access = [record for record in caplog.records if record.getMessage() == "http.request"]
    assert len(access) == 4
    first = json.loads(JsonFormatter().format(access[0]))
    assert first["method"] == "PUT"
    assert first["route"] == "/api/admin/_probe"
    assert first["status"] == 200
    assert isinstance(first["duration_ms"], int | float)
    assert len(first["request_id"]) == 32
    assert [json.loads(JsonFormatter().format(record))["status"] for record in access] == [200, 422, 403, 500]

    events = {record.getMessage() for record in caplog.records}
    assert "auth.origin_rejected" in events
    assert "unhandled_error" in events

    # Only the application's records (httpx, the test client, logs its own request lines; caplog.text uses the
    # standard formatter with exception messages, which the app's JSON formatter never emits).
    app_records = [record for record in caplog.records if record.name.startswith(("app", "uvicorn"))]
    everything = "\n".join(_formatted(app_records))
    for secret in (
        "person@example.com",
        "pw-Secret-123!",
        "hello there",
        "session-token-SECRET",
        "csrf-token-SECRET",
        "127.0.0.1",
        "s3cr3t-value",
    ):
        assert secret not in everything, secret


async def test_unmatched_route_logged_without_concrete_path(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    await client.get("/api/public/no-such-resource/some-private-slug")
    access = [record for record in caplog.records if record.getMessage() == "http.request"]
    payload = json.loads(JsonFormatter().format(access[-1]))
    assert payload["route"] is None
    app_records = [record for record in caplog.records if record.name.startswith("app")]
    assert "some-private-slug" not in "\n".join(_formatted(app_records))
