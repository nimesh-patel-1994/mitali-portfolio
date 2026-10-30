"""Media pipeline units without a database: BE-T-083 (SVG sanitiser), SEC-BE-011 allow-list cases, magic-byte
sniffing, variant widths, storage confinement and the display file name (SEC-BE-010, SEC-BE-012)."""

from __future__ import annotations

import io
from pathlib import Path

import pytest

from app.core.errors import FileTooLargeError
from app.services.media import storage
from app.services.media.raster import variant_widths
from app.services.media.sniff import sniff_bytes, sniff_file
from app.services.media.svg import MAX_DEPTH, SvgRejectedError, parse_svg, sanitize_svg, sanitize_svg_bytes
from app.services.media.upload import display_filename
from tests.fixtures.images import (
    jpeg_bytes,
    malicious_svg_bytes,
    png_bytes,
    svg_bytes,
    svg_with_entity_bytes,
    text_as_png_bytes,
    webp_bytes,
)


def _clean(data: bytes) -> str:
    return sanitize_svg_bytes(data).markup.decode("utf-8")


@pytest.mark.be_t("BE-T-083")
def test_svg_sanitizer_removes_active_content() -> None:
    output = _clean(malicious_svg_bytes())
    lowered = output.lower()
    for forbidden in ("<script", "onload", "foreignobject", "evil.example", "url(", "<div"):
        assert forbidden not in lowered, forbidden
    assert output.startswith('<svg xmlns="http://www.w3.org/2000/svg"')
    assert "<rect" in output  # harmless shapes survive
    parse_svg(output.encode("utf-8"))  # the output is well-formed SVG


@pytest.mark.be_t("BE-T-083")
def test_svg_with_dtd_or_entity_is_rejected() -> None:
    with pytest.raises(SvgRejectedError):
        sanitize_svg_bytes(svg_with_entity_bytes())
    with pytest.raises(SvgRejectedError):
        parse_svg(
            b'<?xml version="1.0"?><!DOCTYPE svg SYSTEM "http://x/y.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>'
        )
    assert sniff_bytes(svg_with_entity_bytes()) is None  # → 415 at the API


@pytest.mark.sec("SEC-BE-011")
@pytest.mark.parametrize(
    ("fragment", "forbidden"),
    [
        ('<a href="javascript:alert(1)"><rect width="1" height="1"/></a>', "javascript"),
        ('<animate attributeName="href" values="javascript:alert(1)"/>', "animate"),
        ('<set attributeName="fill" to="red"/>', "<set"),
        ('<image href="https://evil.example/x.png" width="5" height="5"/>', "evil.example"),
        ('<use href="data:image/svg+xml;base64,AAAA"/>', "data:"),
        ("<style>@import url(https://evil.example/a.css);</style>", "@import"),
        ('<rect width="5" height="5" fill="url(https://evil.example/#g)"/>', "evil.example"),
        ('<rect width="5" height="5" style="fill:red;behavior:url(x.htc)"/>', "behavior"),
        ('<iframe src="https://evil.example"/>', "iframe"),
        ('<embed src="x.swf"/>', "embed"),
        ('<object data="x"/>', "object"),
        ('<rect width="5" height="5" onclick="alert(1)"/>', "onclick"),
        ('<use xlink:href="https://evil.example/s.svg#a"/>', "evil.example"),
        # Review n2: CSS image functions that fetch like url() does.
        ("<rect width='5' height='5' style=\"fill:image-set('https://evil.example/a.png' 1x)\"/>", "evil.example"),
        ("<rect width='5' height='5' style=\"fill:-webkit-image-set('x.png' 1x)\"/>", "image-set"),
        ("<rect width='5' height='5' style=\"fill:image('https://evil.example/b.png')\"/>", "evil.example"),
        ("<rect width='5' height='5' style=\"fill:SRC ('https://evil.example/c.png')\"/>", "evil.example"),
    ],
)
def test_svg_allow_list_drops_dangerous_constructs(fragment: str, forbidden: str) -> None:
    document = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">'
        f'{fragment}<circle cx="5" cy="5" r="2"/></svg>'
    ).encode()
    output = _clean(document)
    assert forbidden.lower() not in output.lower()
    assert "<circle" in output


@pytest.mark.sec("SEC-BE-011")
def test_svg_allow_list_keeps_local_references_and_gradients() -> None:
    document = (
        b'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40px" height="20">'
        b'<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient>'
        b'<symbol id="s"><rect width="2" height="2"/></symbol></defs>'
        b'<rect width="40" height="20" fill="url(#g)" style="fill:url(#g)"/>'
        b'<use xlink:href="#s"/><text x="1" y="9">A &amp; B</text></svg>'
    )
    sanitized = sanitize_svg_bytes(document)
    output = sanitized.markup.decode()
    assert 'fill="url(#g)"' in output
    assert 'style="fill:url(#g)"' in output
    assert '<use href="#s">' in output
    assert "A &amp; B" in output
    assert (sanitized.width, sanitized.height) == (40, 20)


def test_svg_dimensions_from_viewbox_or_default_and_root_checks() -> None:
    from_viewbox = sanitize_svg_bytes(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120.4 60"/>')
    assert (from_viewbox.width, from_viewbox.height) == (120, 60)
    default = sanitize_svg_bytes(b'<svg xmlns="http://www.w3.org/2000/svg" width="50%"/>')
    assert (default.width, default.height) == (300, 150)
    with pytest.raises(SvgRejectedError):
        parse_svg(b'<html xmlns="http://www.w3.org/1999/xhtml"/>')
    with pytest.raises(SvgRejectedError):
        parse_svg(b"<svg><unclosed></svg>")


@pytest.mark.sec("SEC-BE-011")
@pytest.mark.parametrize(
    "attributes",
    [
        'viewBox="0 0 nan 10"',
        'viewBox="0 0 10 inf"',
        'viewBox="0 0 1e400 10"',
        'viewBox="0 0 -inf 10"',
        f'width="{"9" * 400}" height="10"',
    ],
)
def test_svg_with_non_finite_size_is_rejected(attributes: str) -> None:
    """Review m1: nan/inf sizes raised ValueError/OverflowError (500); now refused like any bad SVG (415)."""
    document = f'<svg xmlns="http://www.w3.org/2000/svg" {attributes}><rect width="1" height="1"/></svg>'.encode()
    with pytest.raises(SvgRejectedError):
        sanitize_svg_bytes(document)
    assert sniff_bytes(document) is None  # → 415 at the API


@pytest.mark.sec("SEC-BE-011")
def test_svg_nesting_is_capped_without_recursion_errors() -> None:
    """Review m1: 5000 nested ``<g>`` raised RecursionError (500); anything deeper than MAX_DEPTH is refused."""
    deep = b'<svg xmlns="http://www.w3.org/2000/svg">' + b"<g>" * 5000 + b"</g>" * 5000 + b"</svg>"
    with pytest.raises(SvgRejectedError):
        sanitize_svg_bytes(deep)
    assert sniff_bytes(deep) is None
    at_limit = b'<svg xmlns="http://www.w3.org/2000/svg">' + b"<g>" * MAX_DEPTH + b"</g>" * MAX_DEPTH + b"</svg>"
    assert _clean(at_limit).count("<g>") == MAX_DEPTH
    with pytest.raises(SvgRejectedError):
        sanitize_svg(parse_svg(b'<svg xmlns="http://www.w3.org/2000/svg"/>'), max_depth=-1)


@pytest.mark.be_t("BE-T-081")
def test_sniff_uses_magic_bytes_only(tmp_path: Path) -> None:
    assert sniff_bytes(jpeg_bytes()).kind == "jpeg"  # type: ignore[union-attr]
    assert sniff_bytes(png_bytes()).kind == "png"  # type: ignore[union-attr]
    assert sniff_bytes(webp_bytes()).kind == "webp"  # type: ignore[union-attr]
    assert sniff_bytes(svg_bytes()).kind == "svg"  # type: ignore[union-attr]
    assert sniff_bytes(b"\xef\xbb\xbf" + svg_bytes()).kind == "svg"  # type: ignore[union-attr]
    assert sniff_bytes(text_as_png_bytes()) is None
    assert sniff_bytes(b"GIF89a\x01\x00\x01\x00") is None
    assert sniff_bytes(b"%PDF-1.7\n") is None
    assert sniff_bytes(b"\xff\xfe<\x00s\x00") is None  # not UTF-8
    path = tmp_path / "upload.part"
    path.write_bytes(png_bytes())
    assert sniff_file(path).kind == "png"  # type: ignore[union-attr]
    path.write_bytes(svg_bytes())
    assert sniff_file(path).kind == "svg"  # type: ignore[union-attr]


@pytest.mark.be_t("BE-T-079")
@pytest.mark.parametrize(
    ("width", "expected"),
    [(2000, [480, 960, 1600]), (1600, [480, 960, 1600]), (1000, [480, 960, 1000]), (300, [300]), (480, [480])],
)
def test_variant_widths_never_upscale(width: int, expected: list[int]) -> None:
    assert variant_widths(width) == expected


@pytest.mark.sec("SEC-BE-012")
@pytest.mark.parametrize(
    "relative",
    ["../x.webp", "uploads/../../x", "/etc/passwd", "C:/Windows/win.ini", "uploads\\x.svg", "uploads//x", ".env", ""],
)
def test_storage_refuses_unsafe_relative_paths(tmp_path: Path, relative: str) -> None:
    with pytest.raises(storage.UnsafePathError):
        storage.resolve_inside(tmp_path, relative)


def test_storage_resolves_inside_root_and_copies_with_limit(tmp_path: Path) -> None:
    assert storage.resolve_inside(tmp_path, "uploads/2026/10/a.webp") == (tmp_path / "uploads/2026/10/a.webp").resolve()
    target = tmp_path / "copy.part"
    assert storage.copy_limited(io.BytesIO(b"x" * 10), target, 10) == 10
    with pytest.raises(FileTooLargeError):
        storage.copy_limited(io.BytesIO(b"x" * 11), target, 10)
    storage.remove_quietly(target)
    assert not target.exists()
    storage.remove_relative(tmp_path, ["../outside.txt", "uploads/missing.webp"])  # never raises


@pytest.mark.sec("SEC-BE-010")
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("photo.jpg", "photo.jpg"),
        ("C:\\Users\\someone\\photo.jpg", "photo.jpg"),
        ("../../etc/passwd", "passwd"),
        ("name\x00with\x1fcontrol.png", "namewithcontrol.png"),
        ("x" * 300 + ".png", "x" * 200),
        ("", None),
        (None, None),
        ("   ", None),
    ],
)
def test_display_filename_is_sanitised(raw: str | None, expected: str | None) -> None:
    assert display_filename(raw) == expected
