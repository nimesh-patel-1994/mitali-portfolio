"""Unit tests of pure helpers in ``app/core`` (errors, headers, media paths, logging). No database."""

from __future__ import annotations

import io
import json
import logging

import pytest
import yaml

from app.core import headers
from app.core.errors import ERROR_CODES, code_for_status, validation_fields
from app.core.logging import JsonFormatter, configure_logging, request_id_var
from app.core.static import is_safe_media_path
from tests.harness import BACKEND_DIR


# ------------------------------------------------------------------------------------------------ errors
@pytest.mark.be_t("BE-T-010")
def test_validation_fields_strip_location_prefix_and_keep_nested_path() -> None:
    errors = [
        {"loc": ("body", "name"), "msg": "Field required"},
        {"loc": ("body", "results", 0, "value"), "msg": "Input should be a valid integer"},
        {"loc": ("query", "page"), "msg": "Input should be greater than or equal to 1"},
        {"loc": ("body",), "msg": "JSON decode error"},
        {"loc": ("body", "slug"), "msg": "Value error, This slug is not valid."},
    ]
    assert validation_fields(errors) == {
        "name": "Field required",
        "results.0.value": "Input should be a valid integer",
        "page": "Input should be greater than or equal to 1",
        "body": "JSON decode error",
        "slug": "This slug is not valid.",
    }


def test_error_codes_equal_contract_enum() -> None:
    contract = yaml.safe_load((BACKEND_DIR.parent / "docs" / "api-contract.yaml").read_text(encoding="utf-8"))
    enum = contract["components"]["schemas"]["Error"]["properties"]["error"]["properties"]["code"]["enum"]
    assert list(ERROR_CODES) == enum


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (404, "not_found"),
        (405, "not_found"),
        (413, "payload_too_large"),
        (401, "unauthenticated"),
        (503, "service_unavailable"),
        (500, "internal_error"),
        (418, "validation_error"),
    ],
)
def test_code_for_status_maps_to_contract_codes(status: int, code: str) -> None:
    assert code_for_status(status) == code
    assert code in ERROR_CODES


# ------------------------------------------------------------------------------------------------ headers
@pytest.mark.sec("SEC-010")
def test_security_headers_follow_sec_010_table() -> None:
    api = headers.security_headers_for("/api/public/services", "application/json")
    assert api["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert "X-Robots-Tag" not in api
    assert "Permissions-Policy" not in api

    admin = headers.security_headers_for("/api/admin/case-studies", "application/json")
    assert admin["X-Robots-Tag"] == "noindex, nofollow"
    assert admin["Cache-Control"] == "no-store"

    html = headers.security_headers_for("/work/x", "text/html; charset=utf-8")
    assert html["Content-Security-Policy"] == (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
        "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    )
    assert html["Permissions-Policy"] == "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    assert html["Cross-Origin-Opener-Policy"] == "same-origin"
    assert "X-Robots-Tag" not in html

    shell = headers.security_headers_for("/admin/case-studies", "text/html")
    assert shell["X-Robots-Tag"] == "noindex, nofollow"
    assert shell["Cache-Control"] == "no-store"

    for result in (api, admin, html, shell):
        assert result["X-Content-Type-Options"] == "nosniff"
        assert result["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert result["X-Frame-Options"] == "DENY"
        assert result["Cross-Origin-Resource-Policy"] == "same-origin"
        assert "Strict-Transport-Security" not in result  # not sent locally (SEC-010)
    assert "unsafe-inline" not in headers.CSP_HTML
    assert headers.CSP_SVG == "default-src 'none'; style-src 'unsafe-inline'; sandbox"


# ------------------------------------------------------------------------------------------------ media paths
@pytest.mark.sec("SEC-BE-012")
@pytest.mark.parametrize(
    ("path", "safe"),
    [
        ("uploads/2026/10/0b7e.webp", True),
        ("seed/case-studies/cover-01.svg", True),
        ("tmp/upload.part", False),
        ("other/file.webp", False),
        ("uploads", False),
        ("uploads/../.env", False),
        ("uploads/./x.webp", False),
        ("uploads/.hidden", False),
        ("uploads\\..\\..\\.env", False),
        ("C:/Windows/win.ini", False),
        ("uploads/x.svg::$DATA", False),
        ("uploads/CON", False),
        ("uploads/nul.txt", False),
        ("uploads/com1", False),
        ("/uploads/x.webp", False),
        ("uploads//x.webp", False),
        ("uploads/x\x00.webp", False),
        ("", False),
    ],
)
def test_is_safe_media_path(path: str, safe: bool) -> None:
    assert is_safe_media_path(path) is safe


# ------------------------------------------------------------------------------------------------ logging
def _format(record: logging.LogRecord) -> dict[str, object]:
    parsed: dict[str, object] = json.loads(JsonFormatter().format(record))
    return parsed


@pytest.mark.sec("SEC-008")
def test_json_formatter_includes_fields_and_request_id_but_not_exception_messages() -> None:
    token = request_id_var.set("req-123")
    try:
        record = logging.LogRecord("app.test", logging.INFO, __file__, 1, "http.request", None, None)
        record.fields = {"method": "GET", "status": 200}
        payload = _format(record)
        assert payload["event"] == "http.request"
        assert payload["request_id"] == "req-123"
        assert payload["method"] == "GET"
        assert payload["status"] == 200

        try:
            raise ValueError("duplicate key (email)=(person@example.com)")
        except ValueError as exc:
            error_record = logging.LogRecord(
                "app.test",
                logging.ERROR,
                __file__,
                1,
                "unhandled_error",
                None,
                (type(exc), exc, exc.__traceback__),
            )
        payload = _format(error_record)
        assert payload["error_type"] == "ValueError"
        assert isinstance(payload["stack"], list)
        assert "person@example.com" not in json.dumps(payload)
    finally:
        request_id_var.reset(token)


@pytest.mark.sec("SEC-008")
def test_configure_logging_disables_uvicorn_access_log() -> None:
    logging.getLogger("uvicorn.access").addHandler(logging.StreamHandler(io.StringIO()))
    configure_logging("INFO")
    access = logging.getLogger("uvicorn.access")
    assert access.handlers == []
    assert access.disabled is True
    assert access.propagate is False
