"""``/media`` serving (BE-T-018, SEC-BE-012), health with the database down (BE-T-017 part), startup failure
(BE-T-003) and docs exposure (SEC-006). No database needed: unreachable databases are simulated with a closed port.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import MutableMapping
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
import pytest
from fastapi import FastAPI

from app.core.config import Settings
from app.db import DatabaseUnreachableError
from app.main import create_app
from tests.conftest import BASE_URL
from tests.fixtures.images import svg_bytes, webp_bytes
from tests.harness import closed_port, unit_settings


async def raw_get(app: FastAPI, path: str) -> tuple[int, dict[str, str], bytes]:
    """Send a GET with an exact, un-normalised path (as a server would after percent-decoding)."""
    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": quote(path, safe="/:$").encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [(b"host", b"127.0.0.1:8000")],
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", 8000),
    }
    messages: list[dict[str, Any]] = []

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: MutableMapping[str, Any]) -> None:
        messages.append(dict(message))

    await app(scope, receive, send)
    start = next(message for message in messages if message["type"] == "http.response.start")
    headers = {key.decode().lower(): value.decode() for key, value in start["headers"]}
    body = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
    return int(start["status"]), headers, body


@pytest.fixture
def media_files(media_root: Path) -> dict[str, str]:
    upload_name = f"{uuid.uuid4()}-960.webp"
    (media_root / "uploads" / "2026" / "10").mkdir(parents=True)
    (media_root / "uploads" / "2026" / "10" / upload_name).write_bytes(webp_bytes())
    (media_root / "seed" / "case-studies").mkdir(parents=True)
    (media_root / "seed" / "case-studies" / "cover-01.svg").write_bytes(svg_bytes())
    (media_root / "tmp" / "x").write_bytes(b"partial upload")
    (media_root / "uploads" / ".hidden").write_bytes(b"dot file")
    (media_root.parent / ".env").write_text("DATABASE_URL=not-for-the-web\n", encoding="utf-8")
    return {
        "upload": f"/media/uploads/2026/10/{upload_name}",
        "seed_svg": "/media/seed/case-studies/cover-01.svg",
    }


@pytest.mark.be_t("BE-T-018")
async def test_media_upload_variant_served_immutable_with_nosniff(
    client: httpx.AsyncClient, media_files: dict[str, str]
) -> None:
    response = await client.get(media_files["upload"])
    assert response.status_code == 200
    assert response.content == webp_bytes()
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "public, max-age=31536000, immutable"
    assert response.headers["Cross-Origin-Resource-Policy"] == "same-origin"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"


@pytest.mark.be_t("BE-T-018")
async def test_media_seed_svg_served_with_sandbox_csp_and_short_cache(
    client: httpx.AsyncClient, media_files: dict[str, str]
) -> None:
    response = await client.get(media_files["seed_svg"])
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "image/svg+xml"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    assert response.headers["Cache-Control"] == "public, max-age=3600"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


@pytest.mark.be_t("BE-T-018")
@pytest.mark.sec("SEC-BE-012")
@pytest.mark.parametrize(
    "path",
    [
        "/media/../.env",
        "/media/uploads/../../.env",
        "/media/../app/main.py",  # what "/media/%2e%2e/app/main.py" decodes to
        "/media/tmp/x",
        "/media/uploads/.hidden",
        "/media/uploads\\..\\..\\.env",  # "%5C" decoded
        "/media/C:/Windows/win.ini",
        "/media/uploads/x.svg::$DATA",
        "/media/uploads/CON",
        "/media/.env",
        "/media/",
    ],
)
async def test_media_traversal_tmp_and_windows_forms_return_404(
    app: FastAPI, media_files: dict[str, str], path: str
) -> None:
    status, headers, body = await raw_get(app, path)
    assert status == 404, path
    assert b"not-for-the-web" not in body
    assert b"partial upload" not in body
    assert headers["content-type"].startswith("application/json")


@pytest.mark.be_t("BE-T-018")
async def test_media_percent_encoded_traversal_via_client_returns_404(
    client: httpx.AsyncClient, media_files: dict[str, str]
) -> None:
    for path in ("/media/%2e%2e/app/main.py", "/media/uploads%5C..%5C..%5C.env", "/media/tmp/x"):
        response = await client.get(path)
        assert response.status_code == 404, path
        assert response.json()["error"]["code"] == "not_found"


@pytest.mark.be_t("BE-T-017")
async def test_health_returns_503_when_database_unreachable(media_root: Path) -> None:
    port = closed_port()
    settings = unit_settings(
        media_root=media_root, database_url=f"postgresql+asyncpg://u:health-pw@127.0.0.1:{port}/x_test"
    )
    app = create_app(settings)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.get("/api/health")
    await app.state.engine.dispose()
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "service_unavailable"
    assert "health-pw" not in response.text


@pytest.mark.be_t("BE-T-003")
async def test_startup_fails_fast_when_database_unreachable(media_root: Path, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO)
    port = closed_port()
    settings = unit_settings(
        media_root=media_root,
        database_url=f"postgresql+asyncpg://startup:startup-pw@127.0.0.1:{port}/mp_test",
    )
    app = create_app(settings)
    with pytest.raises(DatabaseUnreachableError) as caught:
        async with app.router.lifespan_context(app):
            pytest.fail("startup must not succeed")
    message = str(caught.value)
    assert message.startswith(f"database unreachable on 127.0.0.1:{port}")
    assert caught.value.__cause__ is None
    assert caught.value.__suppress_context__
    assert "startup-pw" not in message
    assert "startup" not in message.replace("startup.", "")
    assert "startup-pw" not in caplog.text
    assert any(record.getMessage() == "startup.failed" for record in caplog.records)


@pytest.mark.sec("SEC-006")
async def test_docs_and_openapi_disabled_outside_development(client: httpx.AsyncClient, settings: Settings) -> None:
    assert settings.app_env.value == "test"
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert (await client.get(path)).status_code == 404, path


@pytest.mark.sec("SEC-006")
async def test_openapi_available_in_development(media_root: Path) -> None:
    app = create_app(unit_settings(app_env="development", media_root=media_root))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.get("/openapi.json")
    assert response.status_code == 200
    assert response.json()["paths"]["/api/health"]["get"]["operationId"] == "getHealth"
