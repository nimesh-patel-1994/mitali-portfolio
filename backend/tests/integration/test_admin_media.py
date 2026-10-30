"""BE-017 media upload pipeline through the API: BE-T-078..BE-T-082, BE-T-084, BE-T-085 and the SEC-BE-010 /
SEC-BE-011 additions (animated input, metadata-free output, sanitised SVG on disk)."""

from __future__ import annotations

import asyncio
import io
import struct
import uuid
import zlib
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from PIL import Image
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.api.cookies import SESSION_COOKIE
from app.core.errors import MediaInUseError, ValidationFailedError
from app.core.limits import JSON_BODY_LIMIT, MEDIA_FILE_LIMIT, SESSION_COOKIE_NAME
from app.models import CaseStudy, MediaAsset, SiteSettings
from app.repositories import media as media_repository
from app.services.media.upload import delete_media
from app.services.references import MEDIA_NOT_FOUND, ensure_media_exists
from tests import factories
from tests.conftest import ALLOWED_ORIGIN, api_client
from tests.fixtures.images import (
    corrupt_jpeg_bytes,
    malicious_svg_bytes,
    svg_with_entity_bytes,
    text_as_png_bytes,
    webp_bytes,
)

URL = "/api/admin/media"


def files_under(root: Path, folder: str) -> list[Path]:
    base = root / folder
    return sorted(path for path in base.rglob("*") if path.is_file()) if base.exists() else []


async def upload(client: httpx.AsyncClient, data: bytes, name: str, content_type: str, **form: str) -> httpx.Response:
    return await client.post(URL, files={"file": (name, data, content_type)}, data=form or None)


def exif_jpeg(size: tuple[int, int]) -> bytes:
    """JPEG with orientation 6 (rotate 90° clockwise to display) and a GPS IFD (fictional coordinates)."""
    image = Image.new("RGB", size, (200, 80, 40))
    exif = Image.Exif()
    exif[0x0112] = 6
    exif[0x010F] = "Fictional Camera Co"
    gps = exif.get_ifd(0x8825)
    gps[1] = "N"
    gps[2] = (51.0, 30.0, 0.0)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif, quality=70)
    return buffer.getvalue()


def png_declaring(width: int, height: int) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(b"\x00")) + chunk(b"IEND", b"")


def riff_chunks(data: bytes) -> set[bytes]:
    found: set[bytes] = set()
    offset = 12
    while offset + 8 <= len(data):
        kind = data[offset : offset + 4]
        size = struct.unpack("<I", data[offset + 4 : offset + 8])[0]
        found.add(kind)
        offset += 8 + size + (size % 2)
    return found


async def changed_at(session: AsyncSession) -> datetime:
    statement = select(SiteSettings.content_changed_at).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


@pytest.mark.be_t("BE-T-078")
@pytest.mark.sec("SEC-BE-010")
async def test_upload_jpeg_with_exif_produces_clean_rotated_webp_variants(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, media_root: Path
) -> None:
    before = await changed_at(db_session)
    response = await upload(admin_client, exif_jpeg((1200, 2000)), "holiday.jpg", "image/jpeg", alt="Default alt")
    assert response.status_code == 201, response.text
    body = response.json()
    assert [variant["width"] for variant in body["variants"]] == [480, 960, 1600]
    assert (body["width"], body["height"]) == (1600, 960)  # orientation 6 applied: landscape after transpose
    assert body["mime"] == "image/webp"
    assert body["source"] == "upload"
    assert body["alt"] == "Default alt"
    assert body["original_filename"] == "holiday.jpg"
    assert body["url"] == body["variants"][-1]["url"]
    assert body["url"].startswith("/media/uploads/")
    stored = files_under(media_root, "uploads")
    assert len(stored) == 3
    assert all(path.suffix == ".webp" for path in stored)  # original not kept
    assert files_under(media_root, "tmp") == []
    for path in stored:
        raw = path.read_bytes()
        assert riff_chunks(raw).isdisjoint({b"EXIF", b"XMP ", b"ICCP"})
        assert b"Fictional Camera" not in raw
        with Image.open(path) as image:
            assert not image.getexif()
            assert image.width > image.height
    assert await changed_at(db_session) == before  # uploads do not touch the content marker
    served = await admin_client.get(body["url"])
    assert served.status_code == 200
    assert served.headers["cache-control"] == "public, max-age=31536000, immutable"


@pytest.mark.be_t("BE-T-079")
async def test_upload_small_png_with_alpha_and_webp(admin_client: httpx.AsyncClient, media_root: Path) -> None:
    buffer = io.BytesIO()
    Image.new("RGBA", (300, 200), (10, 20, 30, 100)).save(buffer, format="PNG")
    response = await upload(admin_client, buffer.getvalue(), "logo.png", "image/png")
    assert response.status_code == 201, response.text
    assert [variant["width"] for variant in response.json()["variants"]] == [300]
    (path,) = files_under(media_root, "uploads")
    with Image.open(path) as image:
        assert image.mode == "RGBA"
        assert image.size == (300, 200)
    webp = await upload(admin_client, webp_bytes((64, 48)), "x.bin", "application/octet-stream")
    assert webp.status_code == 201
    assert webp.json()["width"] == 64


@pytest.mark.sec("SEC-BE-010")
async def test_upload_animated_webp_becomes_single_frame(admin_client: httpx.AsyncClient, media_root: Path) -> None:
    frames = [Image.new("RGB", (40, 30), colour) for colour in ((255, 0, 0), (0, 0, 255))]
    buffer = io.BytesIO()
    frames[0].save(buffer, format="WEBP", save_all=True, append_images=frames[1:], duration=100, loop=0)
    response = await upload(admin_client, buffer.getvalue(), "anim.webp", "image/webp")
    assert response.status_code == 201, response.text
    (path,) = files_under(media_root, "uploads")
    with Image.open(path) as image:
        assert getattr(image, "n_frames", 1) == 1
    assert b"ANIM" not in riff_chunks(path.read_bytes())


@pytest.mark.be_t("BE-T-080")
async def test_upload_size_limits(admin_client: httpx.AsyncClient, media_root: Path) -> None:
    early = await upload(admin_client, b"\xff\xd8\xff" + b"0" * (11 * 1024 * 1024), "big.jpg", "image/jpeg")
    assert early.status_code == 413
    assert early.json()["error"]["code"] == "file_too_large"

    # Between 10 MB and the 10 MB + 64 KB body cap: the streamed byte count in the service trips.
    svg_head = b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">'
    svg_tail = b"</svg>"
    over = svg_head + b" " * (MEDIA_FILE_LIMIT + 1 - len(svg_head) - len(svg_tail)) + svg_tail
    assert len(over) == MEDIA_FILE_LIMIT + 1
    counted = await upload(admin_client, over, "big.svg", "image/svg+xml")
    assert counted.status_code == 413
    assert counted.json()["error"]["code"] == "file_too_large"
    assert counted.json()["error"]["message"] == "Images must be 10 MB or smaller."

    exact = over[: len(svg_head)] + over[len(svg_head) + 1 :]
    assert len(exact) == MEDIA_FILE_LIMIT
    accepted = await upload(admin_client, exact, "exact.svg", "image/svg+xml")
    assert accepted.status_code == 201, accepted.text
    assert files_under(media_root, "tmp") == []


@pytest.mark.sec("SEC-BE-018")
@pytest.mark.be_t("BE-T-080")
async def test_upload_without_session_cookie_gets_the_small_body_limit(db_app: FastAPI, media_root: Path) -> None:
    """Review m4: the 10 MB limit needs an ``mp_session`` cookie; anonymous bodies are capped at 1 MB."""
    assert SESSION_COOKIE_NAME == SESSION_COOKIE
    two_mb = b"\xff\xd8\xff" + b"0" * (2 * 1024 * 1024)
    async with api_client(db_app, headers={"Origin": ALLOWED_ORIGIN}) as client:
        declared = await upload(client, two_mb, "big.jpg", "image/jpeg")

        async def body() -> AsyncIterator[bytes]:
            yield b'--b\r\nContent-Disposition: form-data; name="file"; filename="big.jpg"\r\n\r\n'
            for _ in range(3):
                yield b"0" * (1024 * 1024)
            yield b"\r\n--b--\r\n"

        streamed = await client.post(URL, content=body(), headers={"Content-Type": "multipart/form-data; boundary=b"})
        small = await upload(client, b"\xff\xd8\xff" + b"0" * (JSON_BODY_LIMIT // 2), "small.jpg", "image/jpeg")
    for response in (declared, streamed):
        assert response.status_code == 413
        assert response.json()["error"]["code"] == "payload_too_large"
    assert small.status_code == 401  # under the small limit: the session check answers
    assert files_under(media_root, "tmp") == []
    assert files_under(media_root, "uploads") == []


@pytest.mark.be_t("BE-T-080")
async def test_upload_chunked_body_over_limit_is_413_without_temp_files(
    admin_client: httpx.AsyncClient, media_root: Path
) -> None:
    boundary = "fictional-boundary"
    head = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.jpg"\r\n'
        "Content-Type: image/jpeg\r\n\r\n"
    ).encode()

    async def body() -> AsyncIterator[bytes]:
        yield head + b"\xff\xd8\xff"
        chunk = b"0" * (1024 * 1024)
        for _ in range(11):
            yield chunk
        yield f"\r\n--{boundary}--\r\n".encode()

    response = await admin_client.post(
        URL, content=body(), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"
    assert files_under(media_root, "tmp") == []
    assert files_under(media_root, "uploads") == []


@pytest.mark.be_t("BE-T-081")
async def test_upload_rejects_unsupported_types(admin_client: httpx.AsyncClient, media_root: Path) -> None:
    gif = io.BytesIO()
    Image.new("RGB", (4, 4)).save(gif, format="GIF")
    cases: list[tuple[bytes, str, str]] = [
        (text_as_png_bytes(), "photo.png", "image/png"),
        (gif.getvalue(), "anim.gif", "image/gif"),
        (b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", "scan.jpg", "image/jpeg"),
        (svg_with_entity_bytes(), "entity.svg", "image/svg+xml"),
    ]
    for data, name, content_type in cases:
        response = await upload(admin_client, data, name, content_type)
        assert response.status_code == 415, name
        assert response.json()["error"]["message"] == "Upload a JPEG, PNG, WebP or SVG image."
    assert files_under(media_root, "tmp") == []
    assert files_under(media_root, "uploads") == []


@pytest.mark.be_t("BE-T-082")
async def test_upload_corrupt_or_too_large_images_are_422(admin_client: httpx.AsyncClient, media_root: Path) -> None:
    truncated = await upload(admin_client, corrupt_jpeg_bytes(), "cut.jpg", "image/jpeg")
    assert truncated.status_code == 422
    assert truncated.json()["error"]["code"] == "invalid_image"
    bomb = await upload(admin_client, png_declaring(10_000, 5_000), "huge.png", "image/png")
    assert bomb.status_code == 422
    assert bomb.json()["error"]["code"] == "invalid_image"
    assert files_under(media_root, "tmp") == []
    assert files_under(media_root, "uploads") == []


@pytest.mark.sec("SEC-BE-011")
async def test_upload_svg_is_sanitised_on_disk_and_served_sandboxed(
    admin_client: httpx.AsyncClient, media_root: Path
) -> None:
    response = await upload(admin_client, malicious_svg_bytes(), "icon.svg", "image/svg+xml")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["mime"] == "image/svg+xml"
    assert body["variants"] == []
    (path,) = files_under(media_root, "uploads")
    stored = path.read_text(encoding="utf-8").lower()
    assert "<script" not in stored
    assert "onload" not in stored
    assert "evil.example" not in stored
    served = await admin_client.get(body["url"])
    assert served.headers["content-security-policy"] == "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    assert served.headers["content-type"].startswith("image/svg+xml")


async def test_upload_alt_validation(admin_client: httpx.AsyncClient) -> None:
    too_long = await upload(admin_client, webp_bytes(), "a.webp", "image/webp", alt="x" * 251)
    assert too_long.status_code == 422
    assert "alt" in too_long.json()["error"]["fields"]
    control = await upload(admin_client, webp_bytes(), "a.webp", "image/webp", alt="line\nbreak")
    assert control.status_code == 422
    assert set(control.json()["error"]["fields"]) == {"alt"}
    missing = await admin_client.post(URL, data={"alt": "x"})
    assert missing.status_code == 422
    assert "file" in missing.json()["error"]["fields"]


@pytest.mark.be_t("BE-T-084")
async def test_upload_db_failure_removes_written_files(
    admin_client: httpx.AsyncClient, media_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def failing_insert(*_args: Any, **_kwargs: Any) -> Any:
        raise RuntimeError("simulated database failure")

    monkeypatch.setattr(media_repository, "insert", failing_insert)
    response = await upload(admin_client, exif_jpeg((600, 400)), "x.jpg", "image/jpeg")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert files_under(media_root, "uploads") == []
    assert files_under(media_root, "tmp") == []


@pytest.mark.be_t("BE-T-084")
async def test_upload_disk_failure_removes_partial_files(
    admin_client: httpx.AsyncClient, media_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original_save = Image.Image.save
    calls = {"count": 0}

    def flaky_save(self: Image.Image, fp: Any, *args: Any, **kwargs: Any) -> None:
        calls["count"] += 1
        if calls["count"] == 2:
            raise OSError("simulated disk full")
        original_save(self, fp, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "save", flaky_save)
    response = await upload(admin_client, exif_jpeg((1200, 2000)), "x.jpg", "image/jpeg")
    assert response.status_code == 500
    assert calls["count"] == 2
    assert files_under(media_root, "uploads") == []
    assert files_under(media_root, "tmp") == []


@pytest.mark.be_t("BE-T-085")
async def test_media_list_paginates_newest_first(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    rows = [await factories.media_asset(db_session, created_at=start + timedelta(minutes=i)) for i in range(25)]
    newest_first = [str(row.id) for row in reversed(rows)]
    first = (await admin_client.get(URL, params={"page_size": 20})).json()
    assert first["total"] == 25
    assert first["page"] == 1
    assert first["page_size"] == 20
    assert [item["id"] for item in first["items"]] == newest_first[:20]
    second = (await admin_client.get(URL, params={"page_size": 20, "page": 2})).json()
    assert [item["id"] for item in second["items"]] == newest_first[20:]
    assert (await admin_client.get(URL, params={"page_size": 101})).status_code == 422


@pytest.mark.be_t("BE-T-085")
async def test_media_delete_in_use_and_unused(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, media_root: Path
) -> None:
    used = await factories.media_asset(db_session)
    await factories.case_study(db_session, cover_media_id=used.id, cover_alt="Cover")
    refused = await admin_client.delete(f"{URL}/{used.id}")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "media_in_use"

    uploaded = (await upload(admin_client, exif_jpeg((1200, 2000)), "x.jpg", "image/jpeg")).json()
    assert len(files_under(media_root, "uploads")) == 3
    before = await changed_at(db_session)
    deleted = await admin_client.delete(f"{URL}/{uploaded['id']}")
    assert deleted.status_code == 204
    assert files_under(media_root, "uploads") == []
    assert await db_session.scalar(select(func.count()).select_from(MediaAsset).where(MediaAsset.id == used.id)) == 1
    assert (await admin_client.delete(f"{URL}/{uploaded['id']}")).status_code == 404
    assert await changed_at(db_session) == before


async def _committed_media(engine: AsyncEngine) -> uuid.UUID:
    async with AsyncSession(engine, expire_on_commit=False) as session, session.begin():
        return (await factories.media_asset(session)).id


async def _remove_committed(engine: AsyncEngine, media_id: uuid.UUID) -> None:
    async with engine.begin() as connection:
        await connection.execute(delete(CaseStudy).where(CaseStudy.cover_media_id == media_id))
        await connection.execute(delete(MediaAsset).where(MediaAsset.id == media_id))


@pytest.mark.be_t("BE-T-085")
async def test_media_delete_waits_for_a_reference_being_saved(db_engine: AsyncEngine, media_root: Path) -> None:
    """Review m6: real commits on two connections. The reference check share-locks the asset, so a concurrent delete
    waits and then answers 409 ``media_in_use`` instead of the reference save failing on the FK (500)."""
    media_id = await _committed_media(db_engine)
    try:
        async with AsyncSession(db_engine, expire_on_commit=False) as saver, AsyncSession(db_engine) as deleter:
            async with saver.begin():
                await ensure_media_exists(saver, media_id, "cover_media_id")
                deleting = asyncio.create_task(delete_media(deleter, media_root=media_root, media_id=media_id))
                await asyncio.sleep(0.3)
                assert not deleting.done()  # blocked on the share lock
                await factories.case_study(
                    saver, slug=f"race-{uuid.uuid4().hex[:12]}", cover_media_id=media_id, cover_alt="Fictional cover"
                )
            with pytest.raises(MediaInUseError):
                await deleting
    finally:
        await _remove_committed(db_engine, media_id)


@pytest.mark.be_t("BE-T-085")
async def test_reference_to_media_deleted_meanwhile_is_422_with_field(db_engine: AsyncEngine) -> None:
    """Review m6: when the delete holds the row first, the reference check waits and then reports the field (422)."""
    media_id = await _committed_media(db_engine)
    try:
        async with AsyncSession(db_engine) as saver, AsyncSession(db_engine) as deleter:

            async def save_reference() -> None:
                async with saver.begin():
                    await ensure_media_exists(saver, media_id, "cover_media_id")

            async with deleter.begin():
                assert await media_repository.get_for_update(deleter, media_id) is not None
                checking = asyncio.create_task(save_reference())
                await asyncio.sleep(0.3)
                assert not checking.done()  # waiting for the delete's row lock
                await media_repository.delete(deleter, media_id)
            with pytest.raises(ValidationFailedError) as caught:
                await checking
            assert caught.value.fields == {"cover_media_id": MEDIA_NOT_FOUND}
    finally:
        await _remove_committed(db_engine, media_id)
