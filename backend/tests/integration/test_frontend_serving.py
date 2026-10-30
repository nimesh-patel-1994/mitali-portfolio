"""BE-022 production-like serving of ``frontend/dist``: BE-T-097, BE-T-098, SEC-BE-012 (Windows path forms),
SEC-BE-014 (same-origin 308) and the SEC-010 header table for HTML responses."""

from __future__ import annotations

import gzip
import os
from collections.abc import AsyncIterator, Callable
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.headers import CSP_HTML
from app.main import create_app
from tests import factories
from tests.conftest import BASE_URL
from tests.harness import unit_settings

PAGES = {
    "index.html": "<!doctype html><title>Home</title>",
    "work/x/index.html": "<!doctype html><title>Work X</title>",
    "work/index.html": "<!doctype html><title>Work</title>",
    "assets/a.js": "console.log('fictional bundle');",
    "404.html": "<!doctype html><title>Not found</title>",
    "admin/index.html": "<!doctype html><title>Admin</title>",
    "build-info.json": '{"built_at": "2026-01-01T00:00:00Z", "content_snapshot_at": "2026-01-01T00:00:00Z"}',
    "sitemap.xml": "<urlset/>",
    ".hidden": "secret-looking dot file",
    "data/home.json": "{}",
}


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    root = tmp_path / "frontend" / "dist"
    for relative, content in PAGES.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    (tmp_path / "frontend" / "secret.txt").write_text("outside dist", encoding="utf-8")
    return root


@pytest.fixture
async def site(dist: Path, media_root: Path) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(unit_settings(serve_frontend=True, frontend_dist_dir=dist, media_root=media_root))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE_URL) as client:
        yield client


@pytest.mark.be_t("BE-T-097")
@pytest.mark.sec("SEC-010")
async def test_frontend_files_directories_and_404_page(site: httpx.AsyncClient) -> None:
    home = await site.get("/")
    assert home.status_code == 200
    assert "<title>Home</title>" in home.text
    assert home.headers["cache-control"] == "no-cache"
    assert home.headers["content-security-policy"] == CSP_HTML
    assert home.headers["permissions-policy"].startswith("camera=()")
    assert home.headers["cross-origin-opener-policy"] == "same-origin"
    assert home.headers["x-frame-options"] == "DENY"
    assert "x-robots-tag" not in home.headers

    detail = await site.get("/work/x")
    assert detail.status_code == 200
    assert "Work X" in detail.text

    redirect = await site.get("/work/x/", follow_redirects=False)
    assert redirect.status_code == 308
    assert redirect.headers["location"] == "/work/x"

    unknown = await site.get("/work/unknown")
    assert unknown.status_code == 404
    assert "<title>Not found</title>" in unknown.text
    assert unknown.headers["content-security-policy"] == CSP_HTML

    admin = await site.get("/admin/case-studies")
    assert admin.status_code == 200
    assert "<title>Admin</title>" in admin.text
    assert admin.headers["x-robots-tag"] == "noindex, nofollow"
    assert admin.headers["cache-control"] == "no-store"
    assert (await site.get("/admin")).status_code == 200

    asset = await site.get("/assets/a.js")
    assert asset.status_code == 200
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert (await site.get("/sitemap.xml")).status_code == 200
    assert (await site.head("/")).status_code == 200


@pytest.mark.be_t("BE-T-097")
@pytest.mark.sec("SEC-BE-012")
@pytest.mark.parametrize(
    "path",
    [
        "/build-info.json",
        "/.hidden",
        "/../secret.txt",
        "/%2e%2e/secret.txt",
        "/work/%2e%2e/%2e%2e/secret.txt",
        "/work/CON",
        "/nul.txt",
        "/work\\x",
        "/work/x%5C..%5C..%5Csecret.txt",
        "/C:/Windows/win.ini",
        "/index.html::$DATA",
    ],
)
async def test_frontend_never_serves_hidden_or_escaping_paths(site: httpx.AsyncClient, path: str) -> None:
    response = await site.get(path)
    assert response.status_code == 404
    assert "outside dist" not in response.text
    assert "content_snapshot_at" not in response.text
    assert "secret-looking" not in response.text


@pytest.mark.sec("SEC-BE-014")
@pytest.mark.parametrize(
    ("path", "location"),
    [("//evil.example/", "/evil.example"), ("/about/", "/about"), ("/work/x/?q=1", "/work/x?q=1")],
)
async def test_trailing_slash_redirect_stays_same_origin(site: httpx.AsyncClient, path: str, location: str) -> None:
    response = await site.get(httpx.URL(BASE_URL + path), follow_redirects=False)  # keep "//" in the path
    assert response.status_code == 308
    assert response.headers["location"] == location
    assert not response.headers["location"].startswith("//")


@pytest.mark.be_t("BE-T-098")
async def test_frontend_disabled_keeps_json_404(client: httpx.AsyncClient) -> None:
    response = await client.get("/work")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.be_t("BE-T-098")
async def test_api_and_media_take_precedence_over_frontend(
    db_app_factory: Callable[..., FastAPI], dist: Path, media_root: Path
) -> None:
    app = db_app_factory(serve_frontend=True, frontend_dist_dir=dist)
    (media_root / "seed" / "covers").mkdir(parents=True)
    (media_root / "seed" / "covers" / "a.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>', encoding="utf-8")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE_URL) as client:
        services = await client.get("/api/public/services")
        assert services.status_code == 200
        assert services.json() == []
        media = await client.get("/media/seed/covers/a.svg")
        assert media.status_code == 200
        assert media.headers["cache-control"] == "public, max-age=3600"
        api_unknown = await client.get("/api/public/nothing-here")
        assert api_unknown.status_code == 404
        assert api_unknown.json()["error"]["code"] == "not_found"
        media_unknown = await client.get("/media")
        assert media_unknown.json()["error"]["code"] == "not_found"
        assert (await client.post("/work")).status_code == 405


async def test_frontend_without_404_page_falls_back_to_json(tmp_path: Path, media_root: Path) -> None:
    empty = tmp_path / "empty-dist"
    empty.mkdir()
    app = create_app(unit_settings(serve_frontend=True, frontend_dist_dir=empty, media_root=media_root))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE_URL) as client:
        response = await client.get("/anything")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# --- Compression of the frontend static route (REQ-NFR-004, tester F1) ---------------------------------------------

BUNDLE = "export const fictionalBundle = '" + "lorem ipsum dolor sit amet " * 200 + "';\n"
JS_TYPES = ("application/javascript", "text/javascript")


def _write(root: Path, relative: str, data: bytes) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


@pytest.mark.be_t("BE-T-097")
@pytest.mark.sec("SEC-010")
async def test_js_asset_gzipped_when_requested(site: httpx.AsyncClient, dist: Path) -> None:
    _write(dist, "assets/big-abc123.js", BUNDLE.encode())
    response = await site.get("/assets/big-abc123.js", headers={"Accept-Encoding": "gzip"})
    assert response.status_code == 200
    assert response.headers["content-encoding"] == "gzip"
    assert response.headers["vary"] == "Accept-Encoding"
    assert response.headers["content-type"].startswith(JS_TYPES)
    assert int(response.headers["content-length"]) < len(BUNDLE) // 4
    assert response.text == BUNDLE  # httpx decodes the gzip body
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert response.headers["etag"].endswith('-gzip"')
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "content-security-policy" in response.headers
    head = await site.head("/assets/big-abc123.js", headers={"Accept-Encoding": "gzip"})
    assert head.status_code == 200
    assert head.headers["content-encoding"] == "gzip"
    assert head.headers["content-length"] == response.headers["content-length"]


@pytest.mark.be_t("BE-T-097")
@pytest.mark.parametrize("accept", [None, "identity", "gzip;q=0", "br;q=0, gzip;q=0", "*;q=0"])
async def test_no_compression_without_acceptable_encoding(
    site: httpx.AsyncClient, dist: Path, accept: str | None
) -> None:
    _write(dist, "assets/big-abc123.js", BUNDLE.encode())
    request = site.build_request("GET", "/assets/big-abc123.js")
    if accept is None:
        del request.headers["accept-encoding"]
    else:
        request.headers["accept-encoding"] = accept
    response = await site.send(request)
    assert response.status_code == 200
    assert "content-encoding" not in response.headers
    assert response.headers["vary"] == "Accept-Encoding"
    assert response.headers["content-length"] == str(len(BUNDLE))
    assert response.text == BUNDLE


@pytest.mark.be_t("BE-T-097")
@pytest.mark.sec("SEC-010")
async def test_html_and_data_json_compressed_with_no_cache(site: httpx.AsyncClient, dist: Path) -> None:
    _write(dist, "about/index.html", ("<!doctype html><title>About</title>" + "<p>text</p>" * 100).encode())
    _write(dist, "data/work.json", ('{"items": [' + ",".join(['{"slug": "x"}'] * 100) + "]}").encode())
    page = await site.get("/about", headers={"Accept-Encoding": "gzip"})
    assert page.headers["content-encoding"] == "gzip"
    assert page.headers["cache-control"] == "no-cache"
    assert page.headers["content-type"].startswith("text/html")
    assert page.headers["content-security-policy"] == CSP_HTML
    assert "<title>About</title>" in page.text
    data = await site.get("/data/work.json", headers={"Accept-Encoding": "gzip"})
    assert data.headers["content-encoding"] == "gzip"
    assert data.headers["cache-control"] == "no-cache"
    assert data.json()["items"][0]["slug"] == "x"
    missing = await site.get("/work/unknown", headers={"Accept-Encoding": "gzip"})
    assert missing.status_code == 404
    assert "<title>Not found</title>" in missing.text


@pytest.mark.be_t("BE-T-097")
async def test_binary_files_never_compressed_and_fonts_immutable(site: httpx.AsyncClient, dist: Path) -> None:
    _write(dist, "fonts/public-sans-latin-400-normal.woff2", b"wOF2" + bytes(range(256)) * 8)
    _write(dist, "og-default.png", b"\x89PNG\r\n\x1a\n" + bytes(2048))
    font = await site.get("/fonts/public-sans-latin-400-normal.woff2", headers={"Accept-Encoding": "gzip, br"})
    assert font.status_code == 200
    assert "content-encoding" not in font.headers
    assert "vary" not in font.headers
    assert font.headers["cache-control"] == "public, max-age=31536000, immutable"
    image = await site.get("/og-default.png", headers={"Accept-Encoding": "gzip"})
    assert "content-encoding" not in image.headers
    assert image.headers["cache-control"] == "no-cache"


@pytest.mark.be_t("BE-T-097")
async def test_precompressed_sibling_preferred(site: httpx.AsyncClient, dist: Path) -> None:
    _write(dist, "assets/big-abc123.js", BUNDLE.encode())
    marker = BUNDLE.replace("lorem", "PRECOMPRESSED", 1)
    _write(dist, "assets/big-abc123.js.gz", gzip.compress(marker.encode()))
    brotli_bytes = b"opaque-precompressed-brotli-bytes"
    _write(dist, "assets/big-abc123.js.br", brotli_bytes)

    gz = await site.get("/assets/big-abc123.js", headers={"Accept-Encoding": "gzip"})
    assert gz.headers["content-encoding"] == "gzip"
    assert gz.text == marker  # the file on disk, not on-the-fly output
    assert gz.headers["content-type"].startswith(JS_TYPES)
    assert gz.headers["vary"] == "Accept-Encoding"
    assert gz.headers["cache-control"] == "public, max-age=31536000, immutable"

    request = site.build_request("GET", "/assets/big-abc123.js", headers={"Accept-Encoding": "gzip, br"})
    br = await site.send(request, stream=True)
    raw = b"".join([chunk async for chunk in br.aiter_raw()])
    await br.aclose()
    assert br.headers["content-encoding"] == "br"
    assert br.headers["content-type"].startswith(JS_TYPES)
    assert raw == brotli_bytes

    for sibling in ("/assets/big-abc123.js.gz", "/assets/big-abc123.js.br"):
        assert (await site.get(sibling)).status_code == 404


@pytest.mark.be_t("BE-T-097")
async def test_stale_precompressed_sibling_ignored(site: httpx.AsyncClient, dist: Path) -> None:
    js = _write(dist, "assets/big-abc123.js", BUNDLE.encode())
    stale = _write(dist, "assets/big-abc123.js.gz", gzip.compress(b"old build"))
    os.utime(stale, (js.stat().st_atime, js.stat().st_mtime - 60))
    response = await site.get("/assets/big-abc123.js", headers={"Accept-Encoding": "gzip"})
    assert response.headers["content-encoding"] == "gzip"
    assert response.text == BUNDLE


@pytest.mark.be_t("BE-T-097")
@pytest.mark.sec("SEC-BE-012")
@pytest.mark.parametrize("path", ["/../secret.txt", "/%2e%2e/secret.txt", "/work/x%5C..%5C..%5Csecret.txt"])
async def test_traversal_refused_with_compression(site: httpx.AsyncClient, dist: Path, path: str) -> None:
    _write(dist.parent, "secret.txt.gz", gzip.compress(b"outside dist compressed"))
    response = await site.get(path, headers={"Accept-Encoding": "gzip, br"})
    assert response.status_code == 404
    assert "outside dist" not in response.text


@pytest.mark.be_t("BE-T-098")
@pytest.mark.sec("SEC-010")
async def test_api_and_media_responses_never_compressed(
    db_app_factory: Callable[..., FastAPI], db_session: AsyncSession, dist: Path, media_root: Path
) -> None:
    app = db_app_factory(serve_frontend=True, frontend_dist_dir=dist)
    admin = await factories.admin_user(db_session)
    _row, token, csrf = await factories.admin_session(db_session, admin.id)
    (media_root / "seed" / "covers").mkdir(parents=True)
    (media_root / "seed" / "covers" / "a.png").write_bytes(b"\x89PNG\r\n\x1a\n" + bytes(4096))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=BASE_URL,
        cookies={"mp_session": token, "mp_csrf": csrf},
        headers={"Accept-Encoding": "gzip, br"},
    ) as client:
        me = await client.get("/api/admin/auth/me")
        assert me.status_code == 200
        assert "content-encoding" not in me.headers  # BREACH: this body carries the CSRF token
        for path in ("/api/public/services", "/api/public/site", "/api/public/nothing-here"):
            assert "content-encoding" not in (await client.get(path)).headers, path
        media = await client.get("/media/seed/covers/a.png")
        assert media.status_code == 200
        assert "content-encoding" not in media.headers
