"""SVG parsing and allow-list sanitising (TS-011 step 4, SEC-BE-011, SD-008).

Parsing uses ``defusedxml`` with DTDs, entities and external references forbidden (→ the caller answers 415).
Sanitising is an **allow-list**: only the elements and attributes listed below survive; everything else (``script``,
``foreignObject``, ``a``, ``image``, ``animate``, ``set``, ``style`` elements, ``iframe``, ``embed``, ``object``, all
``on*`` handlers, unknown namespaces) is dropped. ``href``/``xlink:href`` survive only on ``use`` and only as a local
``#fragment`` reference (written out as plain ``href``). Any attribute value containing ``javascript:``,
``expression(``, ``@import``, ``image-set(``/``image(``/``src(`` or a ``url(`` that is not ``url(#id)`` is removed.

Documents nested deeper than ``MAX_DEPTH`` elements and documents whose size (``width``/``height``/``viewBox``) is
not a finite number are rejected (``SvgRejectedError`` → 415) when parsed, so sanitising never recurses without
bound or fails on ``nan``/``inf``.

The output is re-serialised by this module (no prefixes other than the default SVG namespace), with every text and
attribute value escaped. Pure CPU work: callers run it in the threadpool.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Final
from xml.sax.saxutils import escape, quoteattr

import defusedxml.ElementTree as SafeET
from defusedxml import DefusedXmlException

SVG_NS: Final = "http://www.w3.org/2000/svg"
XLINK_NS: Final = "http://www.w3.org/1999/xlink"

ALLOWED_ELEMENTS: Final = frozenset(
    {
        "svg",
        "g",
        "defs",
        "symbol",
        "use",
        "title",
        "desc",
        "path",
        "rect",
        "circle",
        "ellipse",
        "line",
        "polyline",
        "polygon",
        "text",
        "tspan",
        "linearGradient",
        "radialGradient",
        "stop",
        "clipPath",
        "mask",
        "pattern",
    }
)

ALLOWED_ATTRIBUTES: Final = frozenset(
    {
        "id",
        "class",
        "viewBox",
        "width",
        "height",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "d",
        "points",
        "transform",
        "fill",
        "fill-opacity",
        "fill-rule",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-dasharray",
        "stroke-opacity",
        "opacity",
        "offset",
        "stop-color",
        "stop-opacity",
        "gradientUnits",
        "gradientTransform",
        "patternUnits",
        "clip-path",
        "clip-rule",
        "mask",
        "font-family",
        "font-size",
        "font-weight",
        "text-anchor",
        "dominant-baseline",
        "preserveAspectRatio",
        "style",
    }
)

DEFAULT_WIDTH: Final = 300  # browser default size of an SVG without dimensions
DEFAULT_HEIGHT: Final = 150
MAX_DIMENSION: Final = 100_000
MAX_DEPTH: Final = 256  # element nesting levels below the root

_FORBIDDEN_FRAGMENTS: Final = (
    "javascript:",
    "vbscript:",
    "data:",
    "expression(",
    "@import",
    "behavior:",
    # CSS image functions that load external resources like url() does (also covers -webkit-image-set()).
    "image-set(",
    "image(",
    "src(",
)
_URL_CALL: Final = re.compile(r"url\s*\(", re.IGNORECASE)
_LOCAL_URL: Final = re.compile(r"url\s*\(\s*(['\"]?)#[A-Za-z0-9_.:-]+\1\s*\)", re.IGNORECASE)
_LENGTH: Final = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*(px)?\s*$")
_CONTROL: Final = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class SvgRejectedError(ValueError):
    """The document is not an acceptable SVG (parse error, DTD/entity, wrong root, too deep, non-finite size)."""


@dataclass(frozen=True, slots=True)
class SanitizedSvg:
    markup: bytes
    width: int
    height: int


def _split(tag: Any) -> tuple[str, str]:
    """``{ns}local`` → ``(ns, local)``; comments/PIs (non-str tags) give ``("", "")``."""
    if not isinstance(tag, str):
        return "", ""
    if tag.startswith("{"):
        namespace, _, local = tag[1:].partition("}")
        return namespace, local
    return "", tag


def parse_svg(data: bytes) -> Any:
    """Parse with defusedxml (no DTD, no entities, no external references) and require an ``svg`` root."""
    try:
        root = SafeET.fromstring(data, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except (DefusedXmlException, SafeET.ParseError, ValueError) as exc:
        raise SvgRejectedError(type(exc).__name__) from None
    namespace, local = _split(root.tag)
    if local != "svg" or namespace not in {SVG_NS, ""}:
        raise SvgRejectedError("root element is not svg")
    _check_depth(root)
    _dimensions(root)  # raises for non-finite sizes
    return root


def _check_depth(root: Any) -> None:
    """Iterative depth check (no recursion), so a deeply nested document cannot exhaust the stack."""
    stack: list[tuple[Any, int]] = [(root, 0)]
    while stack:
        element, depth = stack.pop()
        if depth > MAX_DEPTH:
            raise SvgRejectedError("nesting too deep")
        stack.extend((child, depth + 1) for child in element)


def _value_is_safe(value: str) -> bool:
    lowered = re.sub(r"\s+", "", value).lower()
    if any(fragment in lowered for fragment in _FORBIDDEN_FRAGMENTS):
        return False
    if _URL_CALL.search(value):
        remainder = _LOCAL_URL.sub("", value)
        if _URL_CALL.search(remainder):
            return False
    return _CONTROL.search(value) is None


def _clean_attributes(element_name: str, attributes: dict[str, str]) -> list[tuple[str, str]]:
    kept: list[tuple[str, str]] = []
    for raw_name, value in attributes.items():
        namespace, name = _split(raw_name)
        if name in {"href"} and namespace in {"", XLINK_NS}:
            if element_name == "use" and value.strip().startswith("#") and _value_is_safe(value):
                kept.append(("href", value.strip()))
            continue
        if namespace or name not in ALLOWED_ATTRIBUTES:
            continue
        if _value_is_safe(value):
            kept.append((name, value))
    return kept


def _serialize(element: Any, root_namespace: str, out: list[str], *, is_root: bool, depth: int, max_depth: int) -> None:
    if depth > max_depth:  # parse_svg already refuses these; guards direct callers too
        raise SvgRejectedError("nesting too deep")
    _namespace, name = _split(element.tag)
    attributes = _clean_attributes(name, dict(element.attrib))
    if is_root:
        attributes = [("xmlns", SVG_NS), *attributes]
    rendered = "".join(f" {key}={quoteattr(value)}" for key, value in attributes)
    out.append(f"<{name}{rendered}>")
    if element.text:
        out.append(escape(element.text))
    for child in element:
        child_namespace, child_name = _split(child.tag)
        if child_name in ALLOWED_ELEMENTS and child_namespace == root_namespace and child_name != "svg":
            _serialize(child, root_namespace, out, is_root=False, depth=depth + 1, max_depth=max_depth)
        if child.tail:
            out.append(escape(child.tail))
    out.append(f"</{name}>")


def _length(value: str | None) -> float | None:
    if value is None:
        return None
    match = _LENGTH.match(value)
    return float(match.group(1)) if match else None


def _dimensions(root: Any) -> tuple[int, int]:
    """Pixel size from ``width``/``height``, else the ``viewBox``, else 300 x 150; non-finite numbers are rejected."""
    width = _length(root.attrib.get("width"))
    height = _length(root.attrib.get("height"))
    if width is None or height is None:
        parts = re.split(r"[\s,]+", str(root.attrib.get("viewBox", "")).strip())
        if len(parts) == 4:
            try:
                width = width if width is not None else float(parts[2])
                height = height if height is not None else float(parts[3])
            except ValueError:
                pass
    if any(value is not None and not math.isfinite(value) for value in (width, height)):
        raise SvgRejectedError("size is not a finite number")
    final_width = round(width) if width else DEFAULT_WIDTH
    final_height = round(height) if height else DEFAULT_HEIGHT
    return (
        min(max(final_width, 1), MAX_DIMENSION),
        min(max(final_height, 1), MAX_DIMENSION),
    )


def sanitize_svg(root: Any, *, max_depth: int = MAX_DEPTH) -> SanitizedSvg:
    """Serialise ``root`` keeping only allow-listed elements and attributes."""
    namespace, _local = _split(root.tag)
    out: list[str] = []
    _serialize(root, namespace, out, is_root=True, depth=0, max_depth=max_depth)
    width, height = _dimensions(root)
    return SanitizedSvg(markup="".join(out).encode("utf-8"), width=width, height=height)


def sanitize_svg_bytes(data: bytes) -> SanitizedSvg:
    return sanitize_svg(parse_svg(data))
