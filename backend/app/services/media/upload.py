"""Media upload, list and delete (BE-017, TS-011 steps 1-6, SEC-BE-010..012).

Upload flow: size gate (``Content-Length`` in ``core/limits.py``) → copy the part to ``MEDIA_ROOT/tmp`` counting bytes
(413 above 10 MB) → magic-byte sniff (415) → raster variants or SVG sanitising in the threadpool (422
``invalid_image``) → files under ``uploads/<yyyy>/<mm>/`` → insert ``media_assets`` → commit. The temp file is removed
in ``finally``; files written for an upload whose processing or DB insert fails are removed again. Uploads do not
call ``publishing.touch()`` (TS-010 point 7).
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, BinaryIO, Final

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.errors import (
    MediaInUseError,
    NotFoundError,
    UnsupportedMediaTypeError,
    ValidationFailedError,
)
from app.core.limits import MEDIA_FILE_LIMIT
from app.models import MediaAsset as MediaAssetRow
from app.repositories import media as repository
from app.repositories.integrity import FOREIGN_KEY_VIOLATION, sqlstate
from app.schemas.base import check_single_line
from app.schemas.common import PageParams
from app.schemas.images import ImageSource
from app.schemas.media import MediaAsset, MediaPage
from app.services.image_refs import media_url
from app.services.media import raster, storage
from app.services.media.sniff import Sniffed, sniff_file
from app.services.media.svg import sanitize_svg

logger = logging.getLogger(__name__)

UNSUPPORTED_MESSAGE: Final = "Upload a JPEG, PNG, WebP or SVG image."
NOT_FOUND: Final = "Image not found."
IN_USE_MESSAGE: Final = "This image is still used by content. Remove it there first."
ORIGINAL_FILENAME_MAX: Final = 200
ALT_MAX: Final = 250

_FILENAME_UNSAFE: Final = re.compile(r"[\x00-\x1f\x7f]")


@dataclass(frozen=True, slots=True)
class StoredImage:
    path: str
    variants: list[dict[str, Any]]
    mime: str
    width: int
    height: int
    bytes: int
    files: list[str] = field(default_factory=list)  # every relative path written (for cleanup)


def display_filename(raw: str | None) -> str | None:
    """Client file name for display only: last path segment, control characters removed, at most 200 chars."""
    if not raw:
        return None
    name = raw.replace("\\", "/").rsplit("/", 1)[-1]
    name = _FILENAME_UNSAFE.sub("", name).strip()[:ORIGINAL_FILENAME_MAX].strip()
    return name or None


def _clean_alt(alt: str | None) -> str | None:
    if alt is None:
        return None
    value = alt.strip()
    try:
        check_single_line(value)
    except ValueError as exc:
        raise ValidationFailedError(fields={"alt": str(exc)}) from None
    if len(value) > ALT_MAX:
        raise ValidationFailedError(fields={"alt": f"At most {ALT_MAX} characters."})
    return value or None


def media_out(row: MediaAssetRow) -> MediaAsset:
    variants = sorted(
        (ImageSource(width=int(v["width"]), url=media_url(str(v["path"]))) for v in row.variants or []),
        key=lambda source: source.width,
    )
    return MediaAsset(
        id=row.id,
        url=media_url(row.path),
        mime="image/svg+xml" if row.mime == "image/svg+xml" else "image/webp",
        width=row.width,
        height=row.height,
        bytes=row.bytes,
        variants=variants,
        alt=row.alt,
        original_filename=row.original_filename,
        source="seed" if row.source == "seed" else "upload",
        created_at=row.created_at,
    )


# ---------------------------------------------------------------------------------------------- blocking steps


def _store(sniffed: Sniffed, source: Path, media_root: Path, moment: datetime) -> StoredImage:
    """Process the temp file into its final files (threadpool). Removes its own files when it fails."""
    folder = storage.upload_folder(media_root, moment)
    stem = str(uuid.uuid4())
    if sniffed.kind == "svg":
        sanitized = sanitize_svg(sniffed.svg_root)
        target = folder / f"{stem}.svg"
        try:
            target.write_bytes(sanitized.markup)
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        relative = storage.relative_to_root(media_root, target)
        return StoredImage(
            path=relative,
            variants=[],
            mime="image/svg+xml",
            width=sanitized.width,
            height=sanitized.height,
            bytes=len(sanitized.markup),
            files=[relative],
        )
    image = raster.decode_image(source)
    variants = raster.write_variants(image, folder, stem)
    largest = variants[-1]
    records = [{"width": v.width, "path": storage.relative_to_root(media_root, v.path)} for v in variants]
    return StoredImage(
        path=str(records[-1]["path"]),
        variants=records,
        mime="image/webp",
        width=largest.width,
        height=largest.height,
        bytes=largest.bytes,
        files=[str(record["path"]) for record in records],
    )


def _receive(upload: BinaryIO, media_root: Path) -> tuple[Path, Sniffed | None]:
    temp = storage.new_temp_path(media_root)
    try:
        storage.copy_limited(upload, temp, MEDIA_FILE_LIMIT)
        return temp, sniff_file(temp)
    except BaseException:
        storage.remove_quietly(temp)
        raise


# ---------------------------------------------------------------------------------------------- operations


async def upload_media(
    session: AsyncSession,
    *,
    media_root: Path,
    upload: BinaryIO,
    filename: str | None,
    alt: str | None,
) -> MediaAsset:
    clean_alt = _clean_alt(alt)
    temp, sniffed = await run_in_threadpool(_receive, upload, media_root)
    stored: StoredImage | None = None
    try:
        if sniffed is None:
            raise UnsupportedMediaTypeError(UNSUPPORTED_MESSAGE)
        stored = await run_in_threadpool(_store, sniffed, temp, media_root, datetime.now(UTC))
        async with session.begin():
            row = await repository.insert(
                session,
                {
                    "path": stored.path,
                    "variants": stored.variants,
                    "mime": stored.mime,
                    "width": stored.width,
                    "height": stored.height,
                    "bytes": stored.bytes,
                    "original_filename": display_filename(filename),
                    "alt": clean_alt,
                    "source": "upload",
                },
            )
            return media_out(row)
    except Exception:
        if stored is not None:
            await run_in_threadpool(storage.remove_relative, media_root, stored.files)
        raise
    finally:
        await run_in_threadpool(storage.remove_quietly, temp)


async def list_media(session: AsyncSession, params: PageParams) -> MediaPage:
    async with session.begin():
        rows, total = await repository.list_page(session, offset=params.offset, limit=params.limit)
        return MediaPage(
            items=[media_out(row) for row in rows], total=total, page=params.page, page_size=params.page_size
        )


async def delete_media(session: AsyncSession, *, media_root: Path, media_id: uuid.UUID) -> None:
    """409 ``media_in_use`` while referenced; otherwise the row goes and then its files (after the commit)."""
    try:
        async with session.begin():
            row = await repository.get_for_update(session, media_id)
            if row is None:
                raise NotFoundError(NOT_FOUND)
            if await repository.is_referenced(session, media_id):
                raise MediaInUseError(IN_USE_MESSAGE)
            files = [row.path, *(str(variant["path"]) for variant in row.variants or [])]
            await repository.delete(session, media_id)
    except IntegrityError as exc:  # a reference was added concurrently (FK RESTRICT)
        if sqlstate(exc) == FOREIGN_KEY_VIOLATION:
            raise MediaInUseError(IN_USE_MESSAGE) from None
        raise
    await run_in_threadpool(storage.remove_relative, media_root, sorted(set(files)))
