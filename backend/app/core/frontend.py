"""Production-like serving of the pre-rendered frontend (BE-022, TS-003 point 8, SEC-BE-012, SEC-BE-014).

Registered last and only when ``SERVE_FRONTEND=true``, so API routes and the ``/media`` mount always win.

* ``/<path>`` → the file ``dist/<path>``, or ``dist/<path>/index.html`` for a directory;
* ``/admin`` and ``/admin/*`` → ``dist/admin/index.html`` (``X-Robots-Tag: noindex, nofollow`` and ``no-store`` are
  added by the security-header middleware);
* anything else → ``dist/404.html`` with status 404 (REQ-001);
* a trailing slash → 308 to the slash-less path, built from the request path only and always same-origin
  (``//evil.example/`` → ``/evil.example``);
* never served: ``build-info.json``, dot-files, ``.br``/``.gz`` siblings requested directly, anything resolving
  outside ``dist``, Windows path forms (``\\``, ``:``, device names) → the 404 page;
* ``/api`` and ``/media`` paths that reach this handler get the JSON 404 envelope.

Cache headers: HTML ``no-cache``; ``/assets/*`` (content-hashed names) and ``/fonts/*.woff2``
``public, max-age=31536000, immutable``; other files (``data/*.json``, ``sitemap.xml``...) ``no-cache``.

Compression (REQ-NFR-004), this route only and only for text types (html, js, css, json, svg, xml, txt): a fresh
precompressed sibling (``<file>.br`` / ``<file>.gz``) is preferred when the client accepts it, otherwise the file is
gzipped on the fly (cached in memory by path, mtime and size). ``Vary: Accept-Encoding`` is sent on every compressible
response. ``/api/*`` and ``/media`` are never compressed here (BREACH: admin JSON carries the CSRF token; raster
images gain nothing).
"""

from __future__ import annotations

import gzip
import hashlib
import mimetypes
import re
from dataclasses import dataclass
from email.utils import formatdate
from functools import lru_cache
from pathlib import Path
from typing import Final

from fastapi import FastAPI, Request
from starlette.concurrency import run_in_threadpool
from starlette.responses import FileResponse, RedirectResponse, Response

from app.core.errors import NotFoundError

NOT_FOUND_PAGE: Final = "404.html"
ADMIN_SHELL: Final = "admin/index.html"
INDEX: Final = "index.html"
HIDDEN_FILES: Final = frozenset({"build-info.json"})
CACHE_HTML: Final = "no-cache"
CACHE_ASSETS: Final = "public, max-age=31536000, immutable"
JSON_ONLY_PREFIXES: Final = ("api", "media")
IMMUTABLE_FONT_SUFFIXES: Final = frozenset({".woff2", ".woff"})
COMPRESSIBLE_SUFFIXES: Final = frozenset({".html", ".js", ".mjs", ".css", ".json", ".svg", ".xml", ".txt"})
# Precompressed siblings in preference order: (Content-Encoding, file suffix).
PRECOMPRESSED: Final = (("br", ".br"), ("gzip", ".gz"))
PRECOMPRESSED_SUFFIXES: Final = frozenset(suffix for _, suffix in PRECOMPRESSED)
GZIP_MIN_BYTES: Final = 256
GZIP_LEVEL: Final = 6
GZIP_CACHE_ENTRIES: Final = 128
VARY: Final = "Accept-Encoding"

_RESERVED_NAME: Final = re.compile(r"^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$", re.IGNORECASE)
_SAFE_SEGMENT: Final = re.compile(r"^[A-Za-z0-9_~@+%,()=-][A-Za-z0-9_~@+%,()=.-]*$")


@dataclass(frozen=True, slots=True)
class Resolved:
    path: Path | None
    status: int
    is_html: bool
    immutable: bool


def safe_segments(url_path: str) -> list[str] | None:
    """Path segments when every one is servable; ``None`` for traversal, dot-files and Windows path forms."""
    if "\\" in url_path or ":" in url_path or "\x00" in url_path:
        return None
    segments = [segment for segment in url_path.split("/") if segment]
    for segment in segments:
        if segment in {".", ".."} or segment.startswith(".") or not _SAFE_SEGMENT.match(segment):
            return None
        if _RESERVED_NAME.match(segment):
            return None
    if segments and segments[-1] in HIDDEN_FILES:
        return None
    return segments


def _inside(root: Path, candidate: Path) -> Path | None:
    resolved = candidate.resolve()
    return resolved if resolved.is_relative_to(root) and resolved.is_file() else None


def resolve(dist_root: Path, url_path: str) -> Resolved:
    """Map a URL path to a file below ``dist_root`` (blocking: run in the threadpool)."""
    root = dist_root.resolve()
    segments = safe_segments(url_path)
    if segments is not None:
        if segments and segments[0] == "admin":
            shell = _inside(root, root / ADMIN_SHELL)
            if shell is not None:
                return Resolved(shell, 200, is_html=True, immutable=False)
        else:
            target = root.joinpath(*segments) if segments else root
            found = _inside(root, target) if segments else None
            if found is None:
                found = _inside(root, target / INDEX)
            # Precompressed siblings are only served as an encoding of their original file, never directly.
            if found is not None and found.suffix.lower() not in PRECOMPRESSED_SUFFIXES:
                is_html = found.suffix.lower() == ".html"
                immutable = bool(segments) and (
                    segments[0] == "assets"
                    or (segments[0] == "fonts" and found.suffix.lower() in IMMUTABLE_FONT_SUFFIXES)
                )
                return Resolved(found, 200, is_html=is_html, immutable=immutable)
    page = _inside(root, root / NOT_FOUND_PAGE)
    return Resolved(page, 404, is_html=True, immutable=False)


def accepted_encodings(header: str | None) -> frozenset[str]:
    """Supported content codings (``br``, ``gzip``) the client accepts with ``q > 0``; ``*`` covers unnamed ones."""
    if not header:
        return frozenset()
    accepted: set[str] = set()
    refused: set[str] = set()
    wildcard = False
    for part in header.split(","):
        token, _, params = part.partition(";")
        name = token.strip().lower()
        if name == "x-gzip":
            name = "gzip"
        if not name:
            continue
        quality = 1.0
        for param in params.split(";"):
            key, _, value = param.partition("=")
            if key.strip().lower() == "q":
                try:
                    quality = float(value.strip())
                except ValueError:
                    quality = 0.0
        if name == "*":
            wildcard = quality > 0
        elif quality > 0:
            accepted.add(name)
        else:
            refused.add(name)
    if wildcard:
        accepted |= {"br", "gzip"} - refused
    return frozenset(accepted & {"br", "gzip"})


def is_compressible(path: Path) -> bool:
    return path.suffix.lower() in COMPRESSIBLE_SUFFIXES


@dataclass(frozen=True, slots=True)
class Encoded:
    """A compressed representation: a precompressed file on disk, or gzip bytes produced on the fly."""

    encoding: str
    file: Path | None = None
    body: bytes = b""
    etag: str = ""
    last_modified: str = ""


def _etag_base(mtime: float, size: int) -> str:
    # Same derivation as Starlette's FileResponse, so the identity and gzip ETags are related but distinct.
    return hashlib.md5(f"{mtime}-{size}".encode(), usedforsecurity=False).hexdigest()


@lru_cache(maxsize=GZIP_CACHE_ENTRIES)
def _gzip_cached(path: str, _mtime_ns: int, _size: int) -> bytes:
    return gzip.compress(Path(path).read_bytes(), compresslevel=GZIP_LEVEL, mtime=0)


def choose_encoding(dist_root: Path, path: Path, accepted: frozenset[str]) -> Encoded | None:
    """Best compressed representation of ``path`` for ``accepted`` (blocking: run in the threadpool)."""
    if not accepted or not is_compressible(path):
        return None
    root = dist_root.resolve()
    original = path.stat()
    for encoding, suffix in PRECOMPRESSED:
        if encoding not in accepted:
            continue
        sibling = _inside(root, path.with_name(path.name + suffix))
        if sibling is not None and sibling.stat().st_mtime >= original.st_mtime:
            return Encoded(encoding, file=sibling)
    if "gzip" not in accepted or original.st_size < GZIP_MIN_BYTES:
        return None
    body = _gzip_cached(str(path), original.st_mtime_ns, original.st_size)
    return Encoded(
        "gzip",
        body=body,
        etag=f'"{_etag_base(original.st_mtime, original.st_size)}-gzip"',
        last_modified=formatdate(original.st_mtime, usegmt=True),
    )


def canonical_redirect(url_path: str, query: str) -> str | None:
    """308 target for a trailing slash: same-origin, slash-less, never protocol-relative."""
    if url_path == "/" or not url_path.endswith("/"):
        return None
    target = "/" + url_path.strip("/")
    return f"{target}?{query}" if query else target


def install_frontend(app: FastAPI, dist_dir: Path) -> None:
    """Add the catch-all GET/HEAD route; call after every router and mount has been registered."""

    async def serve_frontend(request: Request) -> Response:
        url_path = request.url.path
        first = url_path.lstrip("/").split("/", 1)[0]
        if first in JSON_ONLY_PREFIXES:
            raise NotFoundError()
        redirect = canonical_redirect(url_path, request.url.query)
        if redirect is not None:
            return RedirectResponse(redirect, status_code=308)
        resolved = await run_in_threadpool(resolve, dist_dir, url_path)
        if resolved.path is None:
            raise NotFoundError()
        headers = {"Cache-Control": CACHE_ASSETS if resolved.immutable else CACHE_HTML}
        if not is_compressible(resolved.path):
            return FileResponse(resolved.path, status_code=resolved.status, headers=headers)
        headers["Vary"] = VARY
        accepted = accepted_encodings(request.headers.get("accept-encoding"))
        encoded = await run_in_threadpool(choose_encoding, dist_dir, resolved.path, accepted)
        if encoded is None:
            return FileResponse(resolved.path, status_code=resolved.status, headers=headers)
        media_type = mimetypes.guess_type(resolved.path.name)[0] or "application/octet-stream"
        headers["Content-Encoding"] = encoded.encoding
        if encoded.file is not None:
            return FileResponse(encoded.file, status_code=resolved.status, headers=headers, media_type=media_type)
        headers["Content-Length"] = str(len(encoded.body))
        headers["ETag"] = encoded.etag
        headers["Last-Modified"] = encoded.last_modified
        body = b"" if request.method == "HEAD" else encoded.body
        return Response(body, status_code=resolved.status, headers=headers, media_type=media_type)

    app.add_api_route(
        "/{full_path:path}",
        serve_frontend,
        methods=["GET", "HEAD"],
        include_in_schema=False,
        name="frontend",
    )
