"""Read ``FRONTEND_DIST_DIR/build-info.json`` written by the pre-renderer (BE-021, TS-005 step 9, TS-015, SEC-BE-017).

The file is untrusted input: read with a 64 KB cap off the event loop, parsed with ``json.loads`` and validated
(``built_at`` / ``content_snapshot_at`` ISO 8601 timestamps with an offset, ``pages`` an integer when present).
Missing → ``None``; malformed → ``None`` plus a warning log (event name only).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Final

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

BUILD_INFO_FILE: Final = "build-info.json"
MAX_BYTES: Final = 64 * 1024


@dataclass(frozen=True, slots=True)
class BuildInfo:
    built_at: datetime
    content_snapshot_at: datetime


class MalformedBuildInfoError(ValueError):
    pass


def _timestamp(document: dict[str, Any], key: str) -> datetime:
    value = document.get(key)
    if not isinstance(value, str):
        raise MalformedBuildInfoError(key)
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise MalformedBuildInfoError(key) from None
    if parsed.tzinfo is None:
        raise MalformedBuildInfoError(key)
    return parsed


def parse_build_info(raw: bytes) -> BuildInfo:
    if len(raw) > MAX_BYTES:
        raise MalformedBuildInfoError("too large")
    try:
        document = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise MalformedBuildInfoError("not json") from None
    if not isinstance(document, dict):
        raise MalformedBuildInfoError("not an object")
    pages = document.get("pages")
    if pages is not None and (not isinstance(pages, int) or isinstance(pages, bool) or pages < 0):
        raise MalformedBuildInfoError("pages")
    return BuildInfo(
        built_at=_timestamp(document, "built_at"),
        content_snapshot_at=_timestamp(document, "content_snapshot_at"),
    )


def _read_capped(path: Path) -> bytes | None:
    try:
        with path.open("rb") as handle:
            return handle.read(MAX_BYTES + 1)
    except FileNotFoundError:
        return None


def read_build_info_sync(dist_dir: Path) -> BuildInfo | None:
    try:
        raw = _read_capped(dist_dir / BUILD_INFO_FILE)
    except OSError:
        logger.warning("build_info.unreadable")
        return None
    if raw is None:
        return None
    try:
        return parse_build_info(raw)
    except MalformedBuildInfoError:
        logger.warning("build_info.malformed")
        return None


async def read_build_info(dist_dir: Path) -> BuildInfo | None:
    return await run_in_threadpool(read_build_info_sync, dist_dir)
