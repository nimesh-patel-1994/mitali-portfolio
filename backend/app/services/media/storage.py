"""Files below ``MEDIA_ROOT`` (TS-011, SEC-BE-012): temp files, upload folders, root confinement, removal.

Stored paths are relative to ``MEDIA_ROOT`` (``uploads/<yyyy>/<mm>/<uuid>...``) and validated before every read,
write or delete: safe characters only, no ``..``, no leading ``/`` or ``\\``, no drive letter or ``:``, and the
resolved path must stay inside the resolved root. Client file names are never used as paths. All functions block:
run them in the threadpool.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import BinaryIO, Final

from app.core.errors import FileTooLargeError

logger = logging.getLogger(__name__)

TMP_FOLDER: Final = "tmp"
UPLOADS_FOLDER: Final = "uploads"
CHUNK_SIZE: Final = 64 * 1024
FILE_TOO_LARGE_MESSAGE: Final = "Images must be 10 MB or smaller."

_RELATIVE_PATH: Final = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./-]*$")


class UnsafePathError(ValueError):
    """A stored relative path failed validation (never used to touch the file system)."""


def resolve_inside(root: Path, relative: str) -> Path:
    """Absolute path of ``relative`` below ``root``; ``UnsafePathError`` when it could escape the root."""
    if not _RELATIVE_PATH.match(relative) or ".." in relative.split("/") or "//" in relative:
        raise UnsafePathError("unsafe media path")
    resolved_root = root.resolve()
    candidate = (resolved_root / relative).resolve()
    if not candidate.is_relative_to(resolved_root) or candidate == resolved_root:
        raise UnsafePathError("media path escapes the media root")
    return candidate


def relative_to_root(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def new_temp_path(root: Path) -> Path:
    folder = root / TMP_FOLDER
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{uuid.uuid4().hex}.part"


def upload_folder(root: Path, moment: datetime) -> Path:
    folder = root / UPLOADS_FOLDER / f"{moment:%Y}" / f"{moment:%m}"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def copy_limited(source: BinaryIO, target: Path, limit: int) -> int:
    """Copy ``source`` to ``target`` counting bytes; ``FileTooLargeError`` (413) as soon as ``limit`` is exceeded."""
    source.seek(0)
    total = 0
    with target.open("wb") as handle:
        while chunk := source.read(CHUNK_SIZE):
            total += len(chunk)
            if total > limit:
                raise FileTooLargeError(FILE_TOO_LARGE_MESSAGE)
            handle.write(chunk)
    return total


def remove_quietly(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("media.temp_cleanup_failed")


def remove_relative(root: Path, relatives: list[str]) -> None:
    """Delete stored files; unsafe or missing paths are skipped (never raises for a single file)."""
    for relative in relatives:
        try:
            resolve_inside(root, relative).unlink(missing_ok=True)
        except (OSError, UnsafePathError):
            logger.warning("media.file_cleanup_failed")
