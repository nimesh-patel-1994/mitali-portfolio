"""Request-scoped middleware (TS-003 points 1, 5, 6; SEC-008; SEC-BE-004).

All middleware here is pure ASGI (no ``BaseHTTPMiddleware``) so streaming bodies and context variables behave.

* ``RequestContextMiddleware`` (outermost): request id, ``X-Request-ID`` header and one JSON access line per request.
* ``OriginCheckMiddleware``: non-GET ``/api/admin/*`` requests need an allowed ``Origin`` (or ``Referer`` origin).
* ``CatchAllMiddleware`` (innermost): turns unexpected exceptions into the 500 envelope *inside* the middleware stack,
  so the response still gets the request id and the security headers.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Iterable
from typing import Final
from urllib.parse import urlsplit

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import origin_of
from app.core.errors import OriginRejectedError, error_body, internal_error_body
from app.core.logging import request_id_var

logger = logging.getLogger("app.access")
audit = logging.getLogger("app.audit")
error_logger = logging.getLogger("app.errors")

REQUEST_ID_HEADER: Final = "X-Request-ID"
SAFE_METHODS: Final = frozenset({"GET", "HEAD"})
ADMIN_API_PREFIX: Final = "/api/admin/"


def route_template(scope: Scope) -> str | None:
    """Route path template (e.g. ``/api/admin/case-studies/{id}``), never the concrete path.

    FastAPI keeps the full template (router prefixes included) on the selected route context; ``scope["route"]``
    only knows the router-local path, so it is the fallback (it is complete for routes without include prefixes).
    """
    fastapi_scope = scope.get("fastapi")
    if isinstance(fastapi_scope, dict):
        context = fastapi_scope.get("effective_route_context")
        path_format = getattr(context, "path_format", None)
        if isinstance(path_format, str):
            return path_format
    route = scope.get("route")
    for attribute in ("path_format", "path"):
        value = getattr(route, attribute, None)
        if isinstance(value, str):
            return value
    return None


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status_holder: dict[str, int] = {}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = int(message["status"])
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            logger.info(
                "http.request",
                extra={
                    "fields": {
                        "method": scope.get("method"),
                        "route": route_template(scope),
                        "status": status_holder.get("status", 500),
                        "duration_ms": duration_ms,
                    }
                },
            )
            request_id_var.reset(token)


def request_origin(headers: Headers) -> str | None:
    """Origin of the request from ``Origin``, or failing that the ``Referer``; ``None`` when absent or invalid."""
    origin = headers.get("origin")
    if origin is not None:
        return _parse_origin(origin, allow_path=False)
    referer = headers.get("referer")
    if referer is not None:
        return _parse_origin(referer, allow_path=True)
    return None


def _parse_origin(value: str, *, allow_path: bool) -> str | None:
    value = value.strip()
    if not value or value == "null":
        return None
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError:
        return None
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username or parts.password:
        return None
    if not allow_path and (parts.path not in {"", "/"} or parts.query or parts.fragment):
        return None
    return origin_of(parts.scheme, parts.hostname, port)


class OriginCheckMiddleware:
    """403 ``origin_rejected`` for non-GET ``/api/admin/*`` requests without an allowed origin (incl. login)."""

    def __init__(self, app: ASGIApp, allowed_origins: Iterable[str]) -> None:
        self.app = app
        self.allowed = frozenset(allowed_origins)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] not in SAFE_METHODS
            and str(scope.get("path", "")).startswith(ADMIN_API_PREFIX)
        ):
            origin = request_origin(Headers(scope=scope))
            if origin is None or origin not in self.allowed:
                audit.warning("auth.origin_rejected")
                rejected = OriginRejectedError()
                response = JSONResponse(error_body(rejected.code, rejected.message), status_code=403)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


class CatchAllMiddleware:
    """Innermost catch-all: unexpected exceptions become the generic 500 envelope (SEC-009)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:  # the one documented catch-all (BE-REV-006)
            if _is_body_limit_signal(exc):
                raise
            error_logger.error("unhandled_error", exc_info=(type(exc), exc, exc.__traceback__))
            if response_started:
                raise
            response = JSONResponse(internal_error_body(), status_code=500)
            await response(scope, receive, send)


def _is_body_limit_signal(exc: BaseException) -> bool:
    # Imported lazily to avoid a cycle; the body-size middleware handles its own signal.
    from app.core.limits import BodyTooLargeError

    return isinstance(exc, BodyTooLargeError)


__all__: Final[list[str]] = [
    "CatchAllMiddleware",
    "OriginCheckMiddleware",
    "RequestContextMiddleware",
    "request_origin",
    "route_template",
]
