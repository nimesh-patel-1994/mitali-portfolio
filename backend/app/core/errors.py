"""Error envelope, ``AppError`` hierarchy and exception handlers (TS-003 point 2, SEC-009).

Every non-2xx response has the body ``{"error": {"code", "message", "fields"?}}``. Codes are exactly the
``Error.code`` enum of ``docs/api-contract.yaml``; adding one needs a tech-spec change.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final, Literal, get_args

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import request_id_var

logger = logging.getLogger(__name__)

ErrorCode = Literal[
    "validation_error",
    "not_found",
    "unauthenticated",
    "invalid_credentials",
    "csrf_failed",
    "origin_rejected",
    "slug_taken",
    "category_not_empty",
    "media_in_use",
    "order_mismatch",
    "rate_limited",
    "too_many_attempts",
    "file_too_large",
    "unsupported_media_type",
    "invalid_image",
    "payload_too_large",
    "service_unavailable",
    "internal_error",
]

ERROR_CODES: Final[tuple[str, ...]] = get_args(ErrorCode)

INTERNAL_ERROR_MESSAGE: Final = "Something went wrong on our side. Please try again."
CHECK_VIOLATION_SQLSTATE: Final = "23514"
INVALID_JSON_MESSAGE: Final = "The request body is not valid JSON."


class AppError(Exception):
    """Service-raised error carrying an HTTP status and a contract error code."""

    status_code: int = 400
    code: ErrorCode = "validation_error"
    default_message: str = "The request is not valid."

    def __init__(
        self,
        message: str | None = None,
        *,
        fields: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
        status_code: int | None = None,
        code: ErrorCode | None = None,
    ) -> None:
        self.message = message or self.default_message
        self.fields = dict(fields) if fields else None
        self.headers = dict(headers) if headers else None
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        super().__init__(self.message)


class ValidationFailedError(AppError):
    status_code = 422
    code = "validation_error"
    default_message = "Some fields are not valid."


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    default_message = "Not found."


class UnauthenticatedError(AppError):
    status_code = 401
    code = "unauthenticated"
    default_message = "Please log in."


class InvalidCredentialsError(AppError):
    status_code = 401
    code = "invalid_credentials"
    default_message = "Email or password is incorrect."


class CsrfFailedError(AppError):
    status_code = 403
    code = "csrf_failed"
    default_message = "The request could not be verified. Reload the page and try again."


class OriginRejectedError(AppError):
    status_code = 403
    code = "origin_rejected"
    default_message = "Request origin not allowed."


class SlugTakenError(AppError):
    status_code = 409
    code = "slug_taken"
    default_message = "This slug is already used."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message, fields={"slug": message or self.default_message})


class CategoryNotEmptyError(AppError):
    status_code = 409
    code = "category_not_empty"
    default_message = "Move or delete the FAQs in this category first."


class MediaInUseError(AppError):
    status_code = 409
    code = "media_in_use"
    default_message = "This image is still used by content."


class OrderMismatchError(AppError):
    status_code = 422
    code = "order_mismatch"
    default_message = "The list changed while you were editing. Reload and try again."


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    default_message = "Too many messages. Please try again later."

    def __init__(self, retry_after_seconds: int, message: str | None = None) -> None:
        super().__init__(message, headers={"Retry-After": str(max(1, retry_after_seconds))})


class TooManyAttemptsError(AppError):
    status_code = 429
    code = "too_many_attempts"
    default_message = "Too many attempts. Try again in 15 minutes."

    def __init__(self, retry_after_seconds: int, message: str | None = None) -> None:
        super().__init__(message, headers={"Retry-After": str(max(1, retry_after_seconds))})


class FileTooLargeError(AppError):
    status_code = 413
    code = "file_too_large"
    default_message = "The file is larger than 10 MB."


class UnsupportedMediaTypeError(AppError):
    status_code = 415
    code = "unsupported_media_type"
    default_message = "Only JPEG, PNG, WebP or SVG images are accepted."


class InvalidImageError(AppError):
    status_code = 422
    code = "invalid_image"
    default_message = "The image could not be read."


class PayloadTooLargeError(AppError):
    status_code = 413
    code = "payload_too_large"
    default_message = "The request body is too large."


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "service_unavailable"
    default_message = "The service is temporarily unavailable."


# ---------------------------------------------------------------------------------------------- envelope helpers


def error_body(code: ErrorCode, message: str, fields: Mapping[str, str] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields:
        error["fields"] = dict(fields)
    return {"error": error}


def error_response(
    status_code: int,
    code: ErrorCode,
    message: str,
    *,
    fields: Mapping[str, str] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(error_body(code, message, fields), status_code=status_code, headers=headers)


def internal_error_body() -> dict[str, Any]:
    """Generic 500 body: fixed message plus the request id, nothing else (SEC-009)."""
    body = error_body("internal_error", INTERNAL_ERROR_MESSAGE)
    request_id = request_id_var.get()
    if request_id:
        body["error"]["message"] = f"{INTERNAL_ERROR_MESSAGE} (request id {request_id})"
    return body


_LOCATION_PREFIXES: Final = frozenset({"body", "query", "path", "header", "cookie"})


def validation_fields(errors: Any) -> dict[str, str]:
    """Map Pydantic errors to ``{dotted.path: message}`` without the ``body.``/``query.`` prefix."""
    fields: dict[str, str] = {}
    for error in errors:
        loc = [str(part) for part in error.get("loc", ())]
        if len(loc) > 1 and loc[0] in _LOCATION_PREFIXES:
            loc = loc[1:]
        key = ".".join(loc) or "body"
        fields.setdefault(key, _clean_message(str(error.get("msg", "Invalid value."))))
    return fields


def _clean_message(message: str) -> str:
    # Pydantic prefixes custom validator messages with "Value error, "; the UI shows the message as is.
    for prefix in ("Value error, ", "Assertion failed, "):
        if message.startswith(prefix):
            message = message[len(prefix) :]
    return message


_STATUS_CODES: Final[dict[int, ErrorCode]] = {
    400: "validation_error",
    401: "unauthenticated",
    # The contract has no generic "forbidden" code. Our own 403s are raised as AppErrors (csrf_failed from the CSRF
    # dependency, origin_rejected from the Origin check); a framework 403 is neither, so it must not claim to be a
    # CSRF failure (the admin client would refetch the session and retry). It is answered as a refused request.
    403: "validation_error",
    404: "not_found",
    # 405 has no dedicated contract code; "not_found" (no such operation on this path) is the closest one.
    405: "not_found",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "rate_limited",
    503: "service_unavailable",
}

_STATUS_MESSAGES: Final[dict[int, str]] = {
    400: "The request is not valid.",
    401: "Please log in.",
    403: "Forbidden.",
    404: "Not found.",
    405: "Method not allowed.",
    413: "The request body is too large.",
    415: "Unsupported media type.",
    422: "Some fields are not valid.",
    429: "Too many requests.",
    503: "The service is temporarily unavailable.",
}


def code_for_status(status_code: int) -> ErrorCode:
    if status_code in _STATUS_CODES:
        return _STATUS_CODES[status_code]
    return "internal_error" if status_code >= 500 else "validation_error"


# ---------------------------------------------------------------------------------------------- handlers


async def app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):  # registered for AppError only
        raise exc
    return error_response(exc.status_code, exc.code, exc.message, fields=exc.fields, headers=exc.headers)


async def request_validation_handler(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):  # registered for RequestValidationError only
        raise exc
    errors = exc.errors()
    if any(error.get("type") == "json_invalid" for error in errors):
        # The location of a JSON syntax error is a character offset, not a field: no ``fields`` map.
        return error_response(422, "validation_error", INVALID_JSON_MESSAGE)
    return error_response(422, "validation_error", "Some fields are not valid.", fields=validation_fields(errors))


async def http_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):  # registered for StarletteHTTPException only
        raise exc
    status_code = exc.status_code
    if status_code >= 500:
        return JSONResponse(internal_error_body(), status_code=status_code, headers=exc.headers)
    # Only fixed messages: framework details (e.g. "There was an error parsing the body") are not echoed.
    message = _STATUS_MESSAGES.get(status_code, "The request could not be processed.")
    return error_response(status_code, code_for_status(status_code), message, headers=exc.headers)


def _sqlstate(exc: IntegrityError) -> str | None:
    orig = exc.orig
    for candidate in (orig, getattr(orig, "__cause__", None)):
        for attribute in ("sqlstate", "pgcode"):
            value = getattr(candidate, attribute, None)
            if isinstance(value, str):
                return value
    return None


async def integrity_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Fallback for integrity errors the service layer did not translate.

    A CHECK violation means input slipped past Pydantic validation: 422. Anything else is a bug: 500. The driver
    message is never logged or returned because it can contain row values.
    """
    if not isinstance(exc, IntegrityError):  # registered for IntegrityError only
        raise exc
    if _sqlstate(exc) == CHECK_VIOLATION_SQLSTATE:
        logger.warning("db.check_violation")
        return error_response(422, "validation_error", "Some fields are not valid.")
    logger.error("db.integrity_error_untranslated", exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(internal_error_body(), status_code=500)


async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Last resort (Starlette's ServerErrorMiddleware); normally ``CatchAllMiddleware`` answers first."""
    logger.error("unhandled_error", exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(internal_error_body(), status_code=500)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, request_validation_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
