"""BE-T-104 seed content scan (no database) plus the generated SVG templates (SEC-007, SEC-BE-019)."""

from __future__ import annotations

import ast
import re
from collections import Counter
from pathlib import Path

import defusedxml.ElementTree as SafeET
import pytest

from app.schemas.base import SLUG_PATTERN
from app.seed import data, images
from app.services.markdown import render_markdown
from app.services.seed import plan_images

DATA_FILE = Path(data.__file__)
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL = re.compile(r"(?i)\b(?:https?|ftp)://[^\s'\"<>)]+|\bwww\.[^\s'\"<>)]+")


def _strings() -> list[str]:
    tree = ast.parse(DATA_FILE.read_text(encoding="utf-8"))
    return [node.value for node in ast.walk(tree) if isinstance(node, ast.Constant) and isinstance(node.value, str)]


def _seed_keys() -> list[str]:
    keys = [cs.seed_key for cs in data.CASE_STUDIES]
    for cs in data.CASE_STUDIES:
        keys += [f"{cs.seed_key}:result:{i}" for i in range(1, len(cs.results) + 1)]
        keys += [f"{cs.seed_key}:image:{i}" for i in range(1, len(cs.gallery) + 1)]
    keys += [sample.seed_key for sample in data.WRITING_SAMPLES]
    keys += [
        item.key for group in (data.SERVICES, data.ENGAGEMENT_MODELS, data.VALUES, data.PROCESS_STEPS) for item in group
    ]
    keys += [testimonial.key for testimonial in data.TESTIMONIALS]
    keys += [f"faq-category:{category.key}" for category in data.FAQ_CATEGORIES]
    keys += [f"faq:{category.key}:{i}" for category in data.FAQ_CATEGORIES for i in range(1, len(category.faqs) + 1)]
    keys += [enquiry.key for enquiry in data.ENQUIRIES]
    return keys


@pytest.mark.be_t("BE-T-104")
@pytest.mark.sec("SEC-007")
def test_seed_emails_and_urls_are_example_com_only() -> None:
    strings = _strings()
    emails = [email for text in strings for email in EMAIL.findall(text)]
    assert emails, "the seed should contain example addresses"
    assert all(email.lower().endswith("@example.com") for email in emails), emails
    urls = [url for text in strings for url in URL.findall(text)]
    assert urls
    for url in urls:
        assert re.match(r"(?i)^https://example\.com(/|$)", url), url
    assert data.SETTINGS.booking_url == "#"


@pytest.mark.be_t("BE-T-104")
def test_seed_slugs_valid_and_keys_unique() -> None:
    slugs = [cs.slug for cs in data.CASE_STUDIES] + [sample.slug for sample in data.WRITING_SAMPLES]
    assert all(SLUG_PATTERN.fullmatch(slug) and len(slug) <= 80 for slug in slugs)
    assert len(set(slugs)) == len(slugs)
    keys = _seed_keys()
    assert len(keys) == len(set(keys))
    assert len({image.relative_path for image in plan_images().values()}) == len(plan_images())


@pytest.mark.be_t("BE-T-104")
def test_seed_counts_and_limits_match_ts017() -> None:
    assert {
        "case_studies": 6,
        "case_study_results": 18,
        "case_study_images": sum(len(cs.gallery) for cs in data.CASE_STUDIES),
        "writing_samples": 12,
        "services": 5,
        "engagement_models": 3,
        "testimonials": 5,
        "faq_categories": 4,
        "faqs": 16,
        "core_values": 4,
        "process_steps": 4,
    } == data.EXPECTED_COUNTS
    assert all(6 <= len(cs.gallery) <= 8 for cs in data.CASE_STUDIES)
    assert sum(cs.is_featured for cs in data.CASE_STUDIES) == 4
    assert set(Counter(sample.format for sample in data.WRITING_SAMPLES).values()) == {2}
    assert sum(preview for category in data.FAQ_CATEGORIES for _q, _a, preview in category.faqs) == 6
    assert len(data.ENQUIRIES) == 4
    for cs in data.CASE_STUDIES:
        assert len(cs.title) <= 120
        assert len(cs.summary) <= 600
        assert len(cs.timeline) <= 40
        assert 2000 <= cs.year <= 2100
        for result in cs.results:
            assert len(result.metric_label) <= 80
            assert len(result.value) <= 30
            assert all(len(v or "") <= 30 for v in (result.before_value, result.change_text))
    for sample in data.WRITING_SAMPLES:
        assert len(sample.excerpt) <= 600
        assert render_markdown(sample.body_md).word_count > 0
    for category in data.FAQ_CATEGORIES:
        for question, answer, _preview in category.faqs:
            assert len(question) <= 200
            assert len(answer) <= 2000
    assert all(len(image.alt) <= 250 for image in plan_images().values())


@pytest.mark.sec("SEC-BE-019")
def test_generated_svgs_escape_text_and_stay_local() -> None:
    tricky = images.writing_thumbnail('A <script> & "quoted" title', "email", dark=True)
    markup = tricky.markup.decode("utf-8")
    assert "<script>" not in markup
    assert "&lt;script&gt; &amp;" in markup
    SafeET.fromstring(tricky.markup, forbid_dtd=True)
    for planned in plan_images().values():
        body = planned.svg.markup.replace(b'xmlns="http://www.w3.org/2000/svg"', b"")
        assert b"http" not in body.lower()
        assert b"href" not in body.lower()
    assert (
        images.cover("X", "Y", ("#000000", "#ffffff")).markup == images.cover("X", "Y", ("#000000", "#ffffff")).markup
    )
