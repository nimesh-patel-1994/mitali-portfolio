"""Markdown rendering and HTML sanitisation: the single producer of stored ``*_html`` (BE-018, TS-012, SEC-BE-013).

``render_markdown`` is used on save (case studies, writing samples), by the preview endpoint and by the seed. It is
pure CPU work; async callers run it through ``run_in_threadpool``.

Pipeline: ``markdown-it-py`` CommonMark (``html=False`` so raw HTML is escaped, ``linkify`` off, tables and
strikethrough on) → token adjustments (headings shifted one level and capped at ``h4``, ``<s>`` → ``<del>``, table
alignment ``style`` → ``align``) → ``nh3`` with exactly the TS-012 allow-list; link targets limited to http(s),
mailto and site-relative ``/path`` (``is_allowed_href``).
"""

from __future__ import annotations

import html
import math
import re
from dataclasses import dataclass
from typing import Final
from urllib.parse import urlsplit

import nh3
from markdown_it import MarkdownIt
from markdown_it.token import Token

WORDS_PER_MINUTE: Final = 200
MAX_HEADING_LEVEL: Final = 4

ALLOWED_TAGS: Final = frozenset(
    {
        "p",
        "h2",
        "h3",
        "h4",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "del",
        "a",
        "blockquote",
        "code",
        "pre",
        "hr",
        "br",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
    }
)
ALLOWED_ATTRIBUTES: Final[dict[str, set[str]]] = {"a": {"href", "title"}, "th": {"align"}, "td": {"align"}}
ALLOWED_URL_SCHEMES: Final = frozenset({"http", "https", "mailto"})
LINK_REL: Final = "noopener noreferrer nofollow"

_ALIGN_STYLE: Final = re.compile(r"^text-align:(left|right|center)$")
_TAG: Final = re.compile(r"<[^>]*>")
_URL_TAB_OR_NEWLINE: Final = re.compile(r"[\t\n\r]")
_C0_AND_SPACE: Final = "".join(chr(code) for code in range(0x21))

_md: Final = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": False}).enable(
    ["table", "strikethrough"]
)


@dataclass(frozen=True, slots=True)
class RenderedMarkdown:
    html: str
    word_count: int
    reading_time_min: int


def _adjust(tokens: list[Token]) -> None:
    for token in tokens:
        tag = token.tag
        if token.type in {"heading_open", "heading_close"} and len(tag) == 2 and tag[0] == "h":
            level = min(int(tag[1]) + 1, MAX_HEADING_LEVEL)
            token.tag = f"h{level}"
        elif tag == "s":
            token.tag = "del"
        elif tag in {"th", "td"} and token.attrs:
            style = str(token.attrs.pop("style", ""))
            match = _ALIGN_STYLE.match(style.replace(" ", ""))
            if match:
                token.attrs["align"] = match.group(1)
        if token.children:
            _adjust(token.children)


def normalise_href(value: str) -> str:
    """What a browser's URL parser sees: ASCII tab/LF/CR removed anywhere, C0 controls and spaces trimmed."""
    return _URL_TAB_OR_NEWLINE.sub("", value).strip(_C0_AND_SPACE)


def is_allowed_href(value: str) -> bool:
    """``http``/``https`` URLs with a host, ``mailto:`` and site-relative paths starting with a single ``/``.

    Protocol-relative ``//host`` (and ``/\\host``, which browsers treat the same) and every other relative form
    (``page``, ``../x``, ``#frag``, ``?q``) are refused. The check runs on ``normalise_href(value)``, so
    ``"/\\t/evil.example"`` counts as ``//evil.example`` (review B-3).
    """
    value = normalise_href(value)
    if value.startswith("/"):
        return not value.startswith("//") and "\\" not in value
    try:
        parts = urlsplit(value)
    except ValueError:
        return False
    scheme = parts.scheme.lower()
    if scheme == "mailto":
        return True
    return scheme in {"http", "https"} and bool(parts.netloc)


def _filter_attribute(tag: str, attribute: str, value: str) -> str | None:
    if tag == "a" and attribute == "href":
        # The link text stays when the href goes; kept hrefs are written in their normalised form.
        return normalise_href(value) if is_allowed_href(value) else None
    return value


def sanitize_html(raw_html: str) -> str:
    return nh3.clean(
        raw_html,
        tags=set(ALLOWED_TAGS),
        attributes={tag: set(attrs) for tag, attrs in ALLOWED_ATTRIBUTES.items()},
        url_schemes=set(ALLOWED_URL_SCHEMES),
        attribute_filter=_filter_attribute,
        link_rel=LINK_REL,
        strip_comments=True,
    )


def count_words(sanitized_html: str) -> int:
    text = html.unescape(_TAG.sub(" ", sanitized_html))
    return len(text.split())


def reading_time(words: int) -> int:
    return max(1, math.ceil(words / WORDS_PER_MINUTE))


def render_markdown(markdown: str) -> RenderedMarkdown:
    env: dict[str, object] = {}
    tokens = _md.parse(markdown, env)
    _adjust(tokens)
    sanitized = sanitize_html(_md.renderer.render(tokens, _md.options, env))
    words = count_words(sanitized)
    return RenderedMarkdown(html=sanitized, word_count=words, reading_time_min=reading_time(words))
