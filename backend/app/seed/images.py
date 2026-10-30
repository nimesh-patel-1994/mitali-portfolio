"""Deterministic placeholder SVGs for the seed (BE-023, TS-017 step 4, REQ-071, SEC-BE-019).

Python standard library only: string templates, every text value escaped with ``xml.sax.saxutils.escape`` (attribute
values with ``quoteattr``). No external references: no ``href``, no ``url()`` other than local ``url(#id)``
gradients, no ``@import``, no web fonts (only generic font-family stacks). The single ``xmlns`` declaration is the
SVG namespace identifier required by browsers, not a link. Output is byte-identical for identical input.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final
from xml.sax.saxutils import escape, quoteattr

SVG_NAMESPACE: Final = "http://www.w3.org/2000/svg"
DISPLAY_FONT: Final = "Antonio, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
BODY_FONT: Final = "'Public Sans', 'Segoe UI', Arial, sans-serif"

CREAM: Final = "#FFFDE9"
DARK_OLIVE: Final = "#0F1C00"
GREEN: Final = "#70FF00"
MUTED: Final = "#63635A"
WIRE: Final = "#D1D4CE"
WIRE_DARK: Final = "#939A8E"

COVER_SIZE: Final = (1920, 1080)
HALF_SIZE: Final = (1200, 900)
THUMBNAIL_SIZE: Final = (1200, 800)
PORTRAIT_SIZE: Final = (1000, 1200)


@dataclass(frozen=True, slots=True)
class GeneratedSvg:
    markup: bytes
    width: int
    height: int


def _attrs(**values: str | int | float) -> str:
    return "".join(f" {key.replace('_', '-')}={quoteattr(str(value))}" for key, value in values.items())


def _text(x: float, y: float, content: str, *, size: int, fill: str, font: str = BODY_FONT, **extra: str) -> str:
    attributes = _attrs(x=x, y=y, font_family=font, font_size=size, fill=fill, **extra)
    return f"<text{attributes}>{escape(content)}</text>"


def _document(width: int, height: int, title: str, body: Sequence[str]) -> GeneratedSvg:
    parts = [
        f'<svg xmlns="{SVG_NAMESPACE}" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
        f"<title>{escape(title)}</title>",
        *body,
        "</svg>",
    ]
    return GeneratedSvg(markup="\n".join(parts).encode("utf-8") + b"\n", width=width, height=height)


def _gradient(gradient_id: str, start: str, end: str) -> str:
    return (
        f"<defs><linearGradient{_attrs(id=gradient_id, x1='0', y1='0', x2='1', y2='1')}>"
        f"<stop{_attrs(offset='0', stop_color=start)}/><stop{_attrs(offset='1', stop_color=end)}/>"
        "</linearGradient></defs>"
    )


def _sample_label(width: int, height: int, fill: str, text: str = "Sample illustration") -> str:
    return _text(width - 40, height - 36, text, size=26, fill=fill, text_anchor="end")


def _wrap(text: str, max_chars: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > max_chars and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    if len(lines) > max_lines:
        lines = [*lines[: max_lines - 1], lines[max_lines - 1].rstrip(".,;:") + "..."]
    return lines


# ---------------------------------------------------------------------------------------------- case studies


def cover(client_name: str, tagline: str, palette: tuple[str, str]) -> GeneratedSvg:
    """1920x1080 key visual: two-colour gradient, geometric shapes and the fictional client name."""
    width, height = COVER_SIZE
    start, end = palette
    body = [
        _gradient("bg", start, end),
        f"<rect{_attrs(width=width, height=height, fill='url(#bg)')}/>",
        f"<circle{_attrs(cx=1540, cy=260, r=300, fill=CREAM, fill_opacity='0.12')}/>",
        f"<rect{_attrs(x=1180, y=560, width=520, height=320, rx=36, fill=DARK_OLIVE, fill_opacity='0.25')}/>",
        f"<polygon{_attrs(points='120,980 520,620 920,980', fill=CREAM, fill_opacity='0.10')}/>",
        _text(120, 470, client_name.upper(), size=128, fill=CREAM, font=DISPLAY_FONT, font_weight="700"),
        _text(124, 560, tagline, size=48, fill=CREAM),
        _sample_label(width, height, CREAM),
    ]
    return _document(width, height, f"{client_name}: campaign key visual (placeholder)", body)


def _frame(width: int, height: int, title: str, palette: tuple[str, str], inner: Sequence[str]) -> GeneratedSvg:
    start, _end = palette
    body = [
        f"<rect{_attrs(width=width, height=height, fill=CREAM)}/>",
        f"<rect{_attrs(x=0, y=0, width=width, height=18, fill=start)}/>",
        *inner,
        _sample_label(width, height, MUTED),
    ]
    return _document(width, height, title, body)


def _bars(x: int, y: int, widths: Sequence[int], gap: int = 34, height: int = 18) -> list[str]:
    return [
        f"<rect{_attrs(x=x, y=y + index * gap, width=w, height=height, rx=9, fill=WIRE)}/>"
        for index, w in enumerate(widths)
    ]


def email_mockup(client_name: str, palette: tuple[str, str]) -> GeneratedSvg:
    width, height = HALF_SIZE
    start, end = palette
    inner = [
        f"<rect{_attrs(x=250, y=70, width=700, height=760, rx=20, fill='#FFFFFF', stroke=WIRE_DARK)}/>",
        f"<rect{_attrs(x=250, y=70, width=700, height=90, rx=20, fill=start)}/>",
        _text(290, 128, client_name, size=34, fill=CREAM, font=DISPLAY_FONT),
        f"<rect{_attrs(x=290, y=190, width=620, height=220, rx=12, fill=end, fill_opacity='0.5')}/>",
        *_bars(290, 440, [560, 600, 480, 590, 420]),
        f"<rect{_attrs(x=290, y=640, width=240, height=64, rx=32, fill=start)}/>",
        _text(410, 682, "Read more", size=26, fill=CREAM, text_anchor="middle"),
        *_bars(290, 740, [380, 300], gap=30, height=12),
    ]
    return _frame(width, height, f"{client_name}: email layout mock-up (placeholder)", palette, inner)


def social_grid(client_name: str, palette: tuple[str, str], variant: int = 0) -> GeneratedSvg:
    width, height = HALF_SIZE
    start, end = palette
    tiles: list[str] = []
    for row in range(3):
        for column in range(3):
            fill = start if (row + column + variant) % 2 == 0 else end
            x = 210 + column * 265
            y = 90 + row * 250
            tiles.append(f"<rect{_attrs(x=x, y=y, width=245, height=230, rx=16, fill=fill)}/>")
            if (row * 3 + column + variant) % 3 == 0:
                tiles.append(f"<circle{_attrs(cx=x + 122, cy=y + 115, r=56, fill=CREAM, fill_opacity='0.6')}/>")
    tiles.append(_text(600, 860, f"{client_name}: social post grid", size=30, fill=DARK_OLIVE, text_anchor="middle"))
    return _frame(width, height, f"{client_name}: social post grid (placeholder)", palette, tiles)


def blog_wireframe(client_name: str, palette: tuple[str, str]) -> GeneratedSvg:
    width, height = COVER_SIZE
    start, end = palette
    inner = [
        f"<rect{_attrs(x=0, y=18, width=width, height=110, fill='#FFFFFF')}/>",
        _text(120, 92, client_name, size=44, fill=start, font=DISPLAY_FONT),
        *_bars(1100, 62, [120, 120, 120], gap=0),
        f"<rect{_attrs(x=420, y=200, width=1080, height=360, rx=20, fill=end, fill_opacity='0.45')}/>",
        f"<rect{_attrs(x=420, y=610, width=780, height=44, rx=12, fill=DARK_OLIVE)}/>",
        *_bars(420, 690, [1080, 1020, 1060, 940, 1000, 720], gap=44, height=20),
    ]
    return _frame(width, height, f"{client_name}: blog article wireframe (placeholder)", palette, inner)


def landing_wireframe(client_name: str, palette: tuple[str, str]) -> GeneratedSvg:
    width, height = HALF_SIZE
    start, end = palette
    inner = [
        f"<rect{_attrs(x=80, y=80, width=1040, height=320, rx=20, fill=start)}/>",
        _text(130, 210, client_name.upper(), size=60, fill=CREAM, font=DISPLAY_FONT),
        f"<rect{_attrs(x=130, y=280, width=260, height=64, rx=32, fill=end)}/>",
        *[
            f"<rect{_attrs(x=80 + index * 355, y=450, width=330, height=300, rx=16, fill='#FFFFFF', stroke=WIRE)}/>"
            for index in range(3)
        ],
        *[line for index in range(3) for line in _bars(110 + index * 355, 600, [260, 230, 190], gap=36)],
    ]
    return _frame(width, height, f"{client_name}: landing page wireframe (placeholder)", palette, inner)


def results_chart(
    client_name: str, palette: tuple[str, str], results: Sequence[tuple[str, str, float]]
) -> GeneratedSvg:
    """Bar chart drawn from the seeded results; values are normalised per bar and labelled "Sample data"."""
    width, height = COVER_SIZE
    start, end = palette
    inner = [
        _text(140, 160, f"{client_name}: results", size=64, fill=DARK_OLIVE, font=DISPLAY_FONT),
        _text(140, 220, "Sample data (illustrative figures)", size=34, fill=MUTED),
        f"<line{_attrs(x1=140, y1=900, x2=1780, y2=900, stroke=WIRE_DARK, stroke_width=4)}/>",
    ]
    for index, (label, value, magnitude) in enumerate(results):
        bar_height = 260 + (index * 97 + int(magnitude * 7)) % 320
        x = 260 + index * 520
        fill = start if index % 2 == 0 else end
        inner += [
            f"<rect{_attrs(x=x, y=900 - bar_height, width=300, height=bar_height, rx=12, fill=fill)}/>",
            _text(x + 150, 880 - bar_height, value, size=44, fill=DARK_OLIVE, text_anchor="middle", font_weight="700"),
            *[
                _text(x + 150, 960 + line_index * 40, line, size=30, fill=MUTED, text_anchor="middle")
                for line_index, line in enumerate(_wrap(label, 24, 2))
            ],
        ]
    return _frame(width, height, f"{client_name}: results chart, sample data", palette, inner)


def pillars_board(client_name: str, palette: tuple[str, str], pillars: Sequence[str]) -> GeneratedSvg:
    width, height = COVER_SIZE
    start, end = palette
    inner = [_text(140, 180, f"{client_name}: messaging pillars", size=64, fill=DARK_OLIVE, font=DISPLAY_FONT)]
    for index, pillar in enumerate(pillars):
        x = 140 + index * 560
        inner += [
            f"<rect{_attrs(x=x, y=300, width=500, height=560, rx=24, fill=start if index != 1 else end)}/>",
            _text(x + 40, 390, f"0{index + 1}", size=56, fill=CREAM, font=DISPLAY_FONT),
            *[
                _text(x + 40, 520 + line_index * 64, line, size=52, fill=CREAM, font=DISPLAY_FONT)
                for line_index, line in enumerate(_wrap(pillar, 14, 3))
            ],
        ]
    return _frame(width, height, f"{client_name}: messaging pillars board (placeholder)", palette, inner)


# ---------------------------------------------------------------------------------------------- writing


def _format_icon(writing_format: str, colour: str) -> list[str]:
    """Simple geometric icons: pen (blog), browser frame (web copy, landing page), envelope (email, newsletter),
    speech bubble (social)."""
    if writing_format in {"email", "newsletter"}:
        return [
            f"<rect{_attrs(x=100, y=110, width=200, height=140, rx=12, fill='none', stroke=colour, stroke_width=10)}/>",
            f"<polyline{_attrs(points='100,120 200,200 300,120', fill='none', stroke=colour, stroke_width=10)}/>",
        ]
    if writing_format == "social":
        return [
            f"<rect{_attrs(x=100, y=100, width=210, height=140, rx=40, fill='none', stroke=colour, stroke_width=10)}/>",
            f"<polygon{_attrs(points='140,236 140,290 190,236', fill=colour)}/>",
        ]
    if writing_format in {"web_copy", "landing_page"}:
        return [
            f"<rect{_attrs(x=100, y=100, width=220, height=160, rx=12, fill='none', stroke=colour, stroke_width=10)}/>",
            f"<line{_attrs(x1=100, y1=140, x2=320, y2=140, stroke=colour, stroke_width=10)}/>",
            f"<circle{_attrs(cx=125, cy=120, r=6, fill=colour)}/>",
        ]
    return [  # blog: pen
        f"<polygon{_attrs(points=PEN_POINTS, fill='none', stroke=colour, stroke_width=10)}/>",
        f"<line{_attrs(x1=250, y1=110, x2=290, y2=150, stroke=colour, stroke_width=10)}/>",
    ]


PEN_POINTS: Final = "120,280 140,220 280,80 320,120 180,260"

FORMAT_LABELS: Final[dict[str, str]] = {
    "blog": "Blog post",
    "web_copy": "Web copy",
    "email": "Email",
    "social": "Social",
    "landing_page": "Landing page",
    "newsletter": "Newsletter",
}


def writing_thumbnail(title: str, writing_format: str, *, dark: bool) -> GeneratedSvg:
    """1200x800 thumbnail: format icon on cream or dark olive with the sample title."""
    width, height = THUMBNAIL_SIZE
    background = DARK_OLIVE if dark else CREAM
    foreground = CREAM if dark else DARK_OLIVE
    accent = GREEN if dark else "#367A00"
    body = [
        f"<rect{_attrs(width=width, height=height, fill=background)}/>",
        *_format_icon(writing_format, accent),
        _text(100, 380, FORMAT_LABELS.get(writing_format, writing_format).upper(), size=40, fill=accent),
        *[
            _text(100, 470 + index * 72, line, size=60, fill=foreground, font=DISPLAY_FONT)
            for index, line in enumerate(_wrap(title, 32, 3))
        ],
        _sample_label(width, height, CREAM if dark else MUTED, "Sample thumbnail"),
    ]
    return _document(width, height, f"{title} (placeholder thumbnail)", body)


def portrait() -> GeneratedSvg:
    """1000x1200 neutral monochrome head-and-shoulders silhouette."""
    width, height = PORTRAIT_SIZE
    body = [
        _gradient("portrait-bg", "#E8E9E7", "#B2B7AE"),
        f"<rect{_attrs(width=width, height=height, fill='url(#portrait-bg)')}/>",
        f"<circle{_attrs(cx=500, cy=470, r=190, fill='#51564D')}/>",
        f"<path{_attrs(d='M150 1200 C150 900 300 760 500 760 C700 760 850 900 850 1200 Z', fill='#51564D')}/>",
        _sample_label(width, height, DARK_OLIVE, "Placeholder portrait"),
    ]
    return _document(width, height, "Placeholder portrait silhouette", body)
