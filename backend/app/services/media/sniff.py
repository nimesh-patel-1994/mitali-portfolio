"""Type detection from content only (TS-011 step 2, SEC-BE-010): the filename and the client ``Content-Type`` are
never consulted. JPEG ``FF D8 FF``, PNG ``89 50 4E 47 0D 0A 1A 0A``, WebP ``RIFF....WEBP``; SVG = UTF-8 text whose
root element, parsed with ``defusedxml``, is ``svg``. Anything else is ``None`` (→ 415). Blocking file reads: run in
the threadpool."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final, Literal

from app.services.media.svg import SvgRejectedError, parse_svg

Kind = Literal["jpeg", "png", "webp", "svg"]

JPEG_MAGIC: Final = b"\xff\xd8\xff"
PNG_MAGIC: Final = b"\x89PNG\r\n\x1a\n"
UTF8_BOM: Final = b"\xef\xbb\xbf"


@dataclass(frozen=True, slots=True)
class Sniffed:
    kind: Kind
    svg_root: Any = None  # parsed tree for SVG (parsed once, sanitised later)


def raster_kind(head: bytes) -> Kind | None:
    if head.startswith(JPEG_MAGIC):
        return "jpeg"
    if head.startswith(PNG_MAGIC):
        return "png"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def _looks_like_xml(data: bytes) -> bool:
    text = data[len(UTF8_BOM) :] if data.startswith(UTF8_BOM) else data
    try:
        decoded = text.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return decoded.lstrip().startswith("<")


def sniff_bytes(data: bytes) -> Sniffed | None:
    kind = raster_kind(data[:16])
    if kind is not None:
        return Sniffed(kind)
    if not _looks_like_xml(data):
        return None
    try:
        return Sniffed("svg", parse_svg(data))
    except SvgRejectedError:
        return None


def sniff_file(path: Path) -> Sniffed | None:
    with path.open("rb") as handle:
        head = handle.read(16)
        kind = raster_kind(head)
        if kind is not None:
            return Sniffed(kind)
        return sniff_bytes(head + handle.read())
