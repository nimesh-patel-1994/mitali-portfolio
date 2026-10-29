"""Tiny generated image samples for upload and media tests (BE-025).

Everything is generated in code at test time (Pillow / plain strings); no third-party files are stored in the repo.
``write_samples(folder)`` writes the full set and returns ``{name: path}``.
"""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image


def _raster(fmt: str, size: tuple[int, int] = (16, 12), mode: str = "RGB", **save_args: object) -> bytes:
    colour = (40, 120, 200, 128) if mode == "RGBA" else (40, 120, 200)
    image = Image.new(mode, size, colour)
    buffer = io.BytesIO()
    image.save(buffer, format=fmt, **save_args)
    return buffer.getvalue()


def jpeg_bytes(size: tuple[int, int] = (16, 12)) -> bytes:
    return _raster("JPEG", size, quality=80)


def png_bytes(size: tuple[int, int] = (16, 12), *, alpha: bool = False) -> bytes:
    return _raster("PNG", size, mode="RGBA" if alpha else "RGB")


def webp_bytes(size: tuple[int, int] = (16, 12)) -> bytes:
    return _raster("WEBP", size, quality=80)


def svg_bytes() -> bytes:
    return (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 12" width="16" height="12">'
        b'<rect width="16" height="12" fill="#2878c8"/></svg>'
    )


def malicious_svg_bytes() -> bytes:
    """SVG with script, event handler, foreignObject, external href and url() style (BE-T-083)."""
    return (
        b'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        b'viewBox="0 0 10 10" onload="alert(1)">'
        b"<script>alert(1)</script>"
        b'<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'
        b'<use xlink:href="https://evil.example/sprite.svg#a"/>'
        b'<rect width="10" height="10" style="background:url(http://evil.example/x)"/>'
        b"</svg>"
    )


def svg_with_entity_bytes() -> bytes:
    return (
        b'<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "boom">]>'
        b'<svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>'
    )


def corrupt_jpeg_bytes() -> bytes:
    """A JPEG cut in half: valid magic bytes, undecodable data."""
    data = jpeg_bytes((64, 64))
    return data[: len(data) // 2]


def text_as_png_bytes() -> bytes:
    """Plain text that a client might upload as ``photo.png``."""
    return b"this is not an image, only text pretending to be photo.png\n"


SAMPLES = {
    "tiny.jpg": jpeg_bytes,
    "tiny.png": png_bytes,
    "tiny.webp": webp_bytes,
    "tiny.svg": svg_bytes,
    "malicious.svg": malicious_svg_bytes,
    "entity.svg": svg_with_entity_bytes,
    "corrupt.jpg": corrupt_jpeg_bytes,
    "text-renamed.png": text_as_png_bytes,
}


def write_samples(folder: Path) -> dict[str, Path]:
    folder.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    for name, factory in SAMPLES.items():
        path = folder / name
        path.write_bytes(factory())
        written[name] = path
    return written
