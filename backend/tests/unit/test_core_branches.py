"""Defensive branches of ``app/core`` (error handlers, body limit, middleware) that the API tests do not reach:
handler type guards, 5xx ``HTTPException``, untranslated integrity errors, non-HTTP scopes and a malformed
``Content-Length`` (BE-003, BE-004, SEC-009)."""

from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.types import Message, Receive, Scope, Send

from app.core import errors
from app.core.headers import SecurityHeadersMiddleware
from app.core.limits import BodySizeLimitMiddleware
from app.core.middleware import CatchAllMiddleware, OriginCheckMiddleware, RequestContextMiddleware

REQUEST = Request({"type": "http", "method": "GET", "path": "/", "headers": []})


class _DriverError(Exception):
    def __init__(self, sqlstate: str | None) -> None:
        super().__init__("driver detail with row values")
        self.sqlstate = sqlstate


def _integrity(sqlstate: str | None) -> IntegrityError:
    return IntegrityError("INSERT ...", {}, _DriverError(sqlstate))


def _body(response: Any) -> dict[str, Any]:
    return json.loads(bytes(response.body))  # type: ignore[no-any-return]


def test_app_error_overrides_status_and_code() -> None:
    error = errors.AppError("Custom.", status_code=418, code="not_found", headers={"X-A": "1"}, fields={"a": "b"})
    assert (error.status_code, error.code, error.headers, error.fields) == (418, "not_found", {"X-A": "1"}, {"a": "b"})


@pytest.mark.parametrize(
    "handler",
    [
        errors.app_error_handler,
        errors.request_validation_handler,
        errors.http_exception_handler,
        errors.integrity_error_handler,
    ],
)
async def test_handlers_reraise_foreign_exceptions(handler: Any) -> None:
    with pytest.raises(KeyError):
        await handler(REQUEST, KeyError("x"))


async def test_handlers_build_envelopes() -> None:
    server = await errors.http_exception_handler(REQUEST, HTTPException(status_code=502))
    assert server.status_code == 502
    assert _body(server)["error"]["code"] == "internal_error"
    teapot = await errors.http_exception_handler(REQUEST, HTTPException(status_code=418))
    assert _body(teapot)["error"] == {"code": "validation_error", "message": "The request could not be processed."}
    validation = await errors.request_validation_handler(
        REQUEST, RequestValidationError([{"loc": ("body", "name"), "msg": "Value error, Too long", "type": "x"}])
    )
    assert _body(validation)["error"]["fields"] == {"name": "Too long"}
    assert errors.code_for_status(599) == "internal_error"
    assert errors.code_for_status(418) == "validation_error"


@pytest.mark.be_t("BE-T-010")
async def test_generic_403_is_not_reported_as_csrf_failure() -> None:
    """Review n6: only the CSRF dependency answers csrf_failed; a framework 403 uses a neutral contract code."""
    forbidden = await errors.http_exception_handler(REQUEST, HTTPException(status_code=403))
    assert forbidden.status_code == 403
    assert _body(forbidden)["error"] == {"code": "validation_error", "message": "Forbidden."}
    assert errors.CsrfFailedError().code == "csrf_failed"


@pytest.mark.be_t("BE-T-010")
async def test_invalid_json_has_no_offset_field() -> None:
    """Review n4: a JSON syntax error is located by a character offset, which is not a field."""
    response = await errors.request_validation_handler(
        REQUEST,
        RequestValidationError(
            [{"type": "json_invalid", "loc": ("body", 9), "msg": "JSON decode error", "ctx": {"error": "x"}}]
        ),
    )
    assert response.status_code == 422
    assert _body(response)["error"] == {"code": "validation_error", "message": "The request body is not valid JSON."}


async def test_integrity_handler_check_violation_and_untranslated() -> None:
    check = await errors.integrity_error_handler(REQUEST, _integrity("23514"))
    assert check.status_code == 422
    other = await errors.integrity_error_handler(REQUEST, _integrity("23505"))
    assert other.status_code == 500
    assert "row values" not in bytes(other.body).decode()
    unknown = await errors.integrity_error_handler(REQUEST, _integrity(None))
    assert unknown.status_code == 500
    fallback = await errors.unhandled_exception_handler(REQUEST, RuntimeError("boom"))
    assert fallback.status_code == 500
    assert "boom" not in bytes(fallback.body).decode()


@pytest.mark.parametrize(
    "middleware",
    [BodySizeLimitMiddleware, SecurityHeadersMiddleware, RequestContextMiddleware, CatchAllMiddleware],
)
async def test_middleware_passes_non_http_scopes_through(middleware: Any) -> None:
    seen: list[str] = []

    async def inner(scope: Scope, _receive: Receive, _send: Send) -> None:
        seen.append(scope["type"])

    async def receive() -> Message:
        return {"type": "lifespan.startup"}

    async def send(_message: Message) -> None:
        return None

    await middleware(inner)({"type": "lifespan"}, receive, send)
    await OriginCheckMiddleware(inner, allowed_origins=["http://localhost:5173"])({"type": "lifespan"}, receive, send)
    assert seen == ["lifespan", "lifespan"]


async def test_body_limit_ignores_malformed_content_length() -> None:
    sent: list[Message] = []

    async def inner(_scope: Scope, receive: Receive, send: Send) -> None:
        await receive()
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    async def receive() -> Message:
        return {"type": "http.request", "body": b"{}", "more_body": False}

    async def send(message: Message) -> None:
        sent.append(message)

    scope = {"type": "http", "method": "PUT", "path": "/api/admin/x", "headers": [(b"content-length", b"abc")]}
    await BodySizeLimitMiddleware(inner)(scope, receive, send)
    assert sent[0]["status"] == 204
