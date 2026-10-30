"""Unit checks without a database: input rules (BE-012, SEC-BE-007, SEC-BE-014), schema enums vs model CHECKs,
security helpers (BE-008, SEC-BE-001/003), password policy (BE-011), ``ImageRef`` (BE-T-028 unit part),
``more_work`` (BE-T-022 unit part)."""

from __future__ import annotations

import inspect
import types
import uuid
from datetime import UTC, datetime
from typing import Any, Union, get_args, get_origin

import pytest
from argon2 import PasswordHasher
from pydantic import BaseModel, ValidationError

import app.schemas.auth
import app.schemas.common
import app.schemas.enquiry
import app.schemas.markdown
import app.schemas.site
from app.core import security
from app.models import CaseStudy, MediaAsset
from app.models.content import CTA_TARGETS, IMAGE_LAYOUTS, WRITING_FORMATS
from app.models.enquiry import BUDGET_RANGES, ENQUIRY_STATUSES, ENQUIRY_TYPES
from app.models.media import MEDIA_MIME_TYPES
from app.schemas import enums
from app.schemas.base import TEXT_VALIDATORS, InputModel, normalise_http_url
from app.schemas.enquiry import EnquiryCreate
from app.schemas.site import ProfileInput, SettingsInput
from app.services.auth import AdminAccountError, normalise_cli_email, validate_password_policy
from app.services.content_public import more_work
from app.services.image_refs import image_ref
from app.services.slugs import is_valid_slug

# ------------------------------------------------------------------------------------------- InputModel audit

INPUT_MODULES = (app.schemas.auth, app.schemas.common, app.schemas.enquiry, app.schemas.markdown, app.schemas.site)


def _input_models() -> list[type[InputModel]]:
    found: list[type[InputModel]] = []
    for module in INPUT_MODULES:
        for _name, value in inspect.getmembers(module, inspect.isclass):
            if issubclass(value, InputModel) and value is not InputModel and value not in found:
                found.append(value)
    return found


def _contains_str(annotation: Any) -> bool:
    if annotation is str:
        return True
    origin = get_origin(annotation)
    if origin in (Union, types.UnionType, list):
        return any(_contains_str(arg) for arg in get_args(annotation))
    return False


def _validators(annotation: Any, metadata: list[Any]) -> set[Any]:
    found = {getattr(item, "func", None) for item in metadata}
    for arg in get_args(annotation):
        found |= {getattr(item, "func", None) for item in getattr(arg, "__metadata__", ())}
        found |= _validators(arg, [])
    return found


def test_input_models_forbid_extra_fields_and_check_every_string_field() -> None:
    models = _input_models()
    assert {model.__name__ for model in models} >= {
        "EnquiryCreate", "LoginRequest", "MarkdownPreviewRequest", "OrderRequest", "ProfileInput",
        "SettingsInput", "SocialLinkInput", "VisionBlockInput",
    }  # fmt: skip
    for model in models:
        assert model.model_config.get("extra") == "forbid", model.__name__
        for name, field in model.model_fields.items():
            annotation = field.annotation
            if _contains_str(annotation) or "Email" in repr(annotation) or "EmailStr" in repr(field.metadata):
                checks = _validators(annotation, list(field.metadata))
                assert checks & set(TEXT_VALIDATORS), f"{model.__name__}.{name} has no control-character check"


def _valid_enquiry(**overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "name": "Sam Example",
        "email": "sam@example.com",
        "enquiry_type": "copywriting",
        "message": "Hello there.",
    }
    values.update(overrides)
    return values


def _errors(model: type[BaseModel], data: dict[str, Any]) -> dict[str, str]:
    with pytest.raises(ValidationError) as caught:
        model.model_validate(data)
    return {".".join(str(part) for part in error["loc"]): error["msg"] for error in caught.value.errors()}


@pytest.mark.sec("SEC-BE-007")
@pytest.mark.parametrize(("field", "value"), [("name", "Sam\x00"), ("message", "Hi\x00there"), ("name", "a\nb")])
def test_input_rejects_nul_and_line_breaks_in_single_line_fields(field: str, value: str) -> None:
    assert field in _errors(EnquiryCreate, _valid_enquiry(**{field: value}))


def test_input_multi_line_fields_allow_newlines_and_tabs() -> None:
    assert EnquiryCreate.model_validate(_valid_enquiry(message="Line one\n\tLine two\r\n")).message


def test_input_strips_whitespace_and_blank_is_rejected() -> None:
    model = EnquiryCreate.model_validate(_valid_enquiry(name="  Sam  "))
    assert model.name == "Sam"
    assert "message" in _errors(EnquiryCreate, _valid_enquiry(message="   "))


@pytest.mark.sec("SEC-BE-014")
@pytest.mark.parametrize(
    "url",
    [
        "https://user:pw@example.com",
        "//evil.example",
        "https://exa mple.com",
        "javascript:alert(1)",
        "data:text/html,hi",
        "vbscript:x",
        "ftp://example.com",
        "/relative/path",
        "https://",
        "https://example.com:99999/",
        "https://bad_host.example",
        "https://exämple.com",
        "https://example.com/\x00",
    ],
)
def test_http_url_rule_rejects_unsafe_values(url: str) -> None:
    with pytest.raises(ValueError, match="http"):
        normalise_http_url(url)


@pytest.mark.sec("SEC-BE-014")
def test_http_url_rule_normalises_scheme_and_host() -> None:
    assert normalise_http_url("HTTPS://EXAMPLE.COM/Path?q=1#Top") == "https://example.com/Path?q=1#Top"
    assert normalise_http_url("http://[::1]:8080/x") == "http://[::1]:8080/x"
    assert normalise_http_url("https://sub.example.co.uk") == "https://sub.example.co.uk"


def _settings(**overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "contact_email": "hello@example.com",
        "booking_url": None,
        "social_links": [],
        "footer_signoff": "Thanks for visiting",
        "contact_promise": "I reply within two working days.",
        "footer_rights_line": "All rights reserved.",
        "notification_email": None,
    }
    values.update(overrides)
    return values


@pytest.mark.parametrize(("value", "stored"), [(None, None), ("", None), ("#", "#"), ("https://Example.com/b", None)])
def test_booking_url_accepts_null_empty_hash_and_http(value: str | None, stored: str | None) -> None:
    result = SettingsInput.model_validate(_settings(booking_url=value)).booking_url
    assert result == (stored if value != "https://Example.com/b" else "https://example.com/b")


def test_settings_input_rejects_mailto_social_link_and_more_than_eight() -> None:
    errors = _errors(SettingsInput, _settings(social_links=[{"label": "Mail", "url": "mailto:a@example.com"}]))
    assert "social_links.0.url" in errors
    links = [{"label": f"L{i}", "url": "https://example.com"} for i in range(9)]
    assert "social_links" in _errors(SettingsInput, _settings(social_links=links))


def _profile(**overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "name": "Mitali Example",
        "headline": "Content strategist",
        "bio": ["Paragraph."],
        "skills": [],
        "tools": [],
        "years_experience": None,
        "origin_statement": "Origin.",
        "vision_blocks": [{"heading": "Vision", "body": "B"}, {"heading": "Mission", "body": "B"}],
        "portrait_media_id": None,
        "portrait_alt": None,
    }
    values.update(overrides)
    return values


def test_profile_input_alt_required_only_with_portrait() -> None:
    assert ProfileInput.model_validate(_profile(portrait_alt="  ")).portrait_alt is None
    errors = _errors(ProfileInput, _profile(portrait_media_id=str(uuid.uuid4()), portrait_alt=" "))
    assert set(errors) == {"portrait_alt"}


# ------------------------------------------------------------------------------------------- enums vs models


def test_schema_enums_match_model_check_constraints() -> None:
    assert get_args(enums.WritingFormat) == WRITING_FORMATS
    assert get_args(enums.ImageLayout) == IMAGE_LAYOUTS
    assert get_args(enums.CtaTarget) == CTA_TARGETS
    assert get_args(enums.EnquiryType) == ENQUIRY_TYPES
    assert get_args(enums.BudgetRange) == BUDGET_RANGES
    assert get_args(enums.EnquiryStatus) == ENQUIRY_STATUSES
    assert get_args(enums.MediaMime) == MEDIA_MIME_TYPES


@pytest.mark.parametrize(
    ("slug", "valid"),
    [("hello-world", True), ("a", True), ("Hello", False), ("a--b", False), ("-a", False), ("a" * 81, False)],
)
def test_is_valid_slug(slug: str, valid: bool) -> None:
    assert is_valid_slug(slug) is valid


# ------------------------------------------------------------------------------------------- security helpers


def test_security_verify_password_true_false_and_bad_hash() -> None:
    hashed = security.hash_password("a-long-test-password")
    assert hashed.startswith("$argon2id$v=19$m=65536,t=3,p=4$")
    assert security.verify_password(hashed, "a-long-test-password") is True
    assert security.verify_password(hashed, "wrong") is False
    assert security.verify_password("not-a-hash", "x") is False
    assert security.needs_rehash(hashed) is False
    assert security.needs_rehash("not-a-hash") is True
    weak = PasswordHasher(time_cost=1, memory_cost=8192, parallelism=1).hash("x")
    assert security.needs_rehash(weak) is True
    assert security.dummy_hash() is security.dummy_hash()


def test_security_tokens_and_keyed_hash() -> None:
    token = security.generate_token()
    assert len(token) >= 43
    assert token != security.generate_token()
    assert len(security.token_hash(token)) == 32
    key = security.keyed_hash("secret-value-for-tests", "203.0.113.5")
    assert len(key) == 64
    assert all(char in "0123456789abcdef" for char in key)
    assert "203.0.113.5" not in key
    assert security.strings_equal("abc", "abc")
    assert not security.strings_equal("abc", "abd")


@pytest.mark.be_t("BE-T-051")
@pytest.mark.parametrize(
    "password",
    ["x" * 11, "x" * 129, "owner@example.com", "OWNER@EXAMPLE.COM", "OWNERNAME1234", "line\nbreak-password"],
)
def test_password_policy_refuses(password: str) -> None:
    email = "ownername1234@example.com" if password == "OWNERNAME1234" else "owner@example.com"
    with pytest.raises(AdminAccountError):
        validate_password_policy(password, email)


def test_password_policy_accepts_12_and_128_chars() -> None:
    validate_password_policy("x" * 12, "owner@example.com")
    validate_password_policy("y" * 128, "owner@example.com")


def test_cli_email_normalised_or_refused() -> None:
    assert normalise_cli_email("  Owner@Example.COM ") == "owner@example.com"
    for bad in ("not-an-email", "a@b\n.com"):
        with pytest.raises(AdminAccountError):
            normalise_cli_email(bad)


# ------------------------------------------------------------------------------------------- ImageRef, more_work


@pytest.mark.be_t("BE-T-028")
def test_image_ref_raster_svg_and_usage_alt() -> None:
    raster = MediaAsset(
        path="uploads/2026/10/a-1600.webp",
        variants=[
            {"width": 1600, "path": "uploads/2026/10/a-1600.webp"},
            {"width": 480, "path": "uploads/2026/10/a-480.webp"},
            {"width": 960, "path": "uploads/2026/10/a-960.webp"},
        ],
        mime="image/webp",
        width=1600,
        height=900,
        alt="media default alt",
    )
    ref = image_ref(raster, "usage alt")
    assert ref is not None
    assert ref.url == "/media/uploads/2026/10/a-1600.webp"
    assert [source.width for source in ref.srcset] == [480, 960, 1600]
    assert ref.srcset[0].url == "/media/uploads/2026/10/a-480.webp"
    assert ref.alt == "usage alt"
    svg = MediaAsset(path="seed/covers/x.svg", variants=[], mime="image/svg+xml", width=1200, height=630, alt="d")
    svg_ref = image_ref(svg, "cover alt")
    assert svg_ref is not None
    assert svg_ref.srcset == []
    assert svg_ref.mime == "image/svg+xml"
    assert svg_ref.alt == "cover alt"
    assert image_ref(None, "x") is None


def _case_studies(count: int) -> list[CaseStudy]:
    now = datetime.now(UTC)
    return [CaseStudy(id=uuid.uuid4(), slug=f"cs-{i}", position=i, created_at=now) for i in range(count)]


@pytest.mark.be_t("BE-T-022")
@pytest.mark.parametrize(("count", "expected"), [(1, 0), (2, 1), (3, 2), (5, 2)])
def test_more_work_counts_and_wraps(count: int, expected: int) -> None:
    rows = _case_studies(count)
    last = rows[-1]
    picked = more_work(rows, last)
    assert len(picked) == expected
    assert last not in picked
    assert picked == rows[:expected]  # wraps to the first ones
    middle = more_work(rows, rows[0])
    assert middle == rows[1 : 1 + expected]
