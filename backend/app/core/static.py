"""``/media`` static serving (TS-003 point 7, SD-008, SEC-BE-012).

Only ``uploads/`` and ``seed/`` below ``MEDIA_ROOT`` are served. ``tmp/``, dot-files, traversal, Windows path forms
(backslashes, drive letters, alternate data streams) and reserved device names are refused with 404 before
Starlette's own (already traversal-safe) lookup runs.
"""

from __future__ import annotations

import re
from typing import Final

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.core.headers import CSP_SVG

SERVED_FOLDERS: Final = frozenset({"uploads", "seed"})
CACHE_UPLOADS: Final = "public, max-age=31536000, immutable"
CACHE_SEED: Final = "public, max-age=3600"

# CON, PRN, AUX, NUL, COM1-9, LPT1-9 (with or without extension) are device names on Windows.
_RESERVED_NAME = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$", re.IGNORECASE)
_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]*$")


def is_safe_media_path(path: str) -> bool:
    """True when ``path`` (relative to ``MEDIA_ROOT``) may be served."""
    if not path or "\\" in path or ":" in path or "\x00" in path or path.startswith("/"):
        return False
    segments = path.split("/")
    if segments[0] not in SERVED_FOLDERS or len(segments) < 2:
        return False
    for segment in segments:
        if segment in {"", ".", ".."} or not _SAFE_SEGMENT.match(segment) or _RESERVED_NAME.match(segment):
            return False
    return True


class MediaFiles(StaticFiles):
    def __init__(self, *, directory: str) -> None:
        super().__init__(directory=directory, check_dir=False, follow_symlink=False)

    def get_path(self, scope: Scope) -> str:
        # Keep the raw relative path: StaticFiles normalises it with os.path.normpath, which would turn
        # "uploads/../x" into "x" (and "/" into "\\" on Windows) before it could be refused.
        path = str(scope["path"])
        root_path = str(scope.get("root_path", ""))
        if root_path and path.startswith(root_path):
            path = path[len(root_path) :]
        return path[1:] if path.startswith("/") else path

    async def get_response(self, path: str, scope: Scope) -> Response:
        if not is_safe_media_path(path):
            raise HTTPException(status_code=404)
        response = await super().get_response(path, scope)
        if response.status_code in {200, 304}:
            headers = response.headers
            headers["X-Content-Type-Options"] = "nosniff"
            headers["Cache-Control"] = CACHE_UPLOADS if path.startswith("uploads/") else CACHE_SEED
            if path.lower().endswith(".svg"):
                headers["Content-Security-Policy"] = CSP_SVG
                headers["Content-Type"] = "image/svg+xml"
        return response
