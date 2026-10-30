"""BE-018 ``render_markdown``: BE-T-086, BE-T-087 and the SEC-BE-013 scheme cases."""

from __future__ import annotations

import pytest

from app.services import markdown
from app.services.markdown import is_allowed_href, normalise_href, render_markdown, sanitize_html


@pytest.mark.be_t("BE-T-086")
def test_render_markdown_shifts_headings_and_keeps_tables_and_del() -> None:
    html = render_markdown("# Title\n\n## Sub\n\n#### Deep\n\n| a | b |\n|:--|--:|\n| 1 | 2 |\n\n~~gone~~").html
    assert "<h2>Title</h2>" in html
    assert "<h3>Sub</h3>" in html
    assert "<h4>Deep</h4>" in html  # capped at h4 (allow-list)
    assert "<h1" not in html
    assert '<th align="left">a</th>' in html
    assert '<td align="right">2</td>' in html
    assert "<table>" in html
    assert "<del>gone</del>" in html
    assert "style=" not in html


@pytest.mark.be_t("BE-T-086")
def test_render_markdown_removes_javascript_links_images_and_escapes_raw_html() -> None:
    html = render_markdown("[x](javascript:alert(1)) ![img](http://x/a.png) <iframe src=x></iframe>").html
    assert "href" not in html
    assert "<img" not in html
    assert "<iframe" not in html
    assert "&lt;iframe" in html


@pytest.mark.sec("SEC-BE-013")
@pytest.mark.parametrize(
    "source",
    [
        "[x](JaVaScRiPt:alert(1))",
        "[x](data:text/html,<script>alert(1)</script>)",
        '<a href="vbscript:msgbox(1)">x</a>',
        "[x](vbscript:msgbox(1))",
        "<script>alert(1)</script>",
        '<img src=x onerror="alert(1)">',
    ],
)
def test_render_markdown_scheme_variants_produce_no_active_content(source: str) -> None:
    html = render_markdown(source).html.lower()
    assert "<a " not in html
    assert "<script" not in html
    assert "<img" not in html
    assert "<iframe" not in html


def test_render_markdown_safe_links_get_forced_rel() -> None:
    html = render_markdown('[a](https://example.com "T") [m](mailto:hi@example.com) [r](/work/x)').html
    assert html.count('rel="noopener noreferrer nofollow"') == 3
    assert 'href="https://example.com"' in html
    assert 'title="T"' in html


@pytest.mark.sec("SEC-BE-013")
@pytest.mark.parametrize(
    ("markdown", "href"),
    [
        ("[a](https://example.com/x)", "https://example.com/x"),
        ("[a](http://example.com)", "http://example.com"),
        ("[a](mailto:hi@example.com)", "mailto:hi@example.com"),
        ("[a](/work/sample-case)", "/work/sample-case"),
        ("[a](/)", "/"),
        ("[a](//evil.example/x)", None),
        # markdown-it percent-encodes the backslash, so this stays an inert same-site path.
        ("[a](/\\evil.example/x)", "/%5Cevil.example/x"),
        ("[a](relative/page)", None),
        ("[a](../up)", None),
        ("[a](#section)", None),
        ("[a](?q=1)", None),
        ("[a](http:no-host)", None),
        ("[a](ftp://example.com/f)", None),
    ],
)
def test_render_markdown_link_targets(markdown: str, href: str | None) -> None:
    """Review n3: http(s), mailto and site-relative ``/path`` only; ``//host`` and other relative forms lose href."""
    html = render_markdown(markdown).html
    if href is None:
        assert "href" not in html
        assert ">a</a>" in html  # link text kept
    else:
        assert f'href="{href}"' in html
    assert not is_allowed_href("/\\evil.example")
    assert not is_allowed_href("http://[bad")


@pytest.mark.sec("SEC-BE-013")
@pytest.mark.parametrize(
    "href",
    [
        "/\t/evil.example",
        "/\n/evil.example",
        "/\r\n/evil.example",
        " //evil.example",
        "\x00//evil.example",
        "\x1f/\t/evil.example \x01",
        "java\tscript:alert(1)",
        "\x08javascript:alert(1)",
        " relative/page",
    ],
)
def test_href_check_normalises_like_a_browser(href: str) -> None:
    """Review B-3: tab/LF/CR anywhere and surrounding C0 controls/spaces are ignored by browsers, so by us too."""
    assert not is_allowed_href(href)
    assert "href" not in sanitize_html(f'<a href="{href}">x</a>')


@pytest.mark.sec("SEC-BE-013")
def test_allowed_href_is_written_normalised() -> None:
    assert normalise_href(" \t/work/\nsample \x00") == "/work/sample"
    assert is_allowed_href(" /work/sample\t")
    assert 'href="/work/sample"' in sanitize_html('<a href=" /work/sam&#9;ple ">x</a>')
    assert 'href="https://example.com/a"' in sanitize_html('<a href="https://exa&#10;mple.com/a">x</a>')


def test_render_markdown_allow_list_equals_ts_012() -> None:
    expected_tags = {
        "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "del", "a", "blockquote",
        "code", "pre", "hr", "br", "table", "thead", "tbody", "tr", "th", "td",
    }  # fmt: skip
    expected_attributes = {"a": {"href", "title"}, "th": {"align"}, "td": {"align"}}
    assert expected_tags == markdown.ALLOWED_TAGS
    assert expected_attributes == markdown.ALLOWED_ATTRIBUTES
    assert frozenset({"http", "https", "mailto"}) == markdown.ALLOWED_URL_SCHEMES
    assert markdown.LINK_REL == "noopener noreferrer nofollow"


@pytest.mark.be_t("BE-T-087")
@pytest.mark.parametrize(("source", "words", "minutes"), [("", 0, 1), ("one", 1, 1), (" ".join(["w"] * 201), 201, 2)])
def test_render_markdown_word_count_and_reading_time(source: str, words: int, minutes: int) -> None:
    rendered = render_markdown(source)
    assert rendered.word_count == words
    assert rendered.reading_time_min == minutes


def test_render_markdown_counts_words_of_rendered_text_not_markup() -> None:
    rendered = render_markdown("## Big *news* today\n\n- one\n- two & three\n\n| a | b |\n|---|---|\n| c | d |")
    assert rendered.word_count == 11  # Big news today | one | two & three | a b c d ("&" counts as a word)
    assert rendered.reading_time_min == 1
