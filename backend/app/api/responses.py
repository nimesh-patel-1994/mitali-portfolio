"""Documented error responses for routes (BE-REV-002): ``responses=errors(401, 403, 404)``.

Descriptions follow ``components/responses`` of ``docs/api-contract.yaml``; every entry uses the error envelope.
"""

from __future__ import annotations

from typing import Any, Final

from app.schemas.common import ERROR_RESPONSE

_DESCRIPTIONS: Final[dict[int, str]] = {
    401: "No valid session (code unauthenticated)",
    403: "Missing or wrong X-CSRF-Token (code csrf_failed) or disallowed Origin (code origin_rejected)",
    404: "Unknown or mismatched resource (code not_found)",
    409: "Conflicting state (codes slug_taken with fields.slug, category_not_empty, media_in_use)",
    413: "Body or file too large (codes payload_too_large, file_too_large)",
    415: "File is not a JPEG, PNG, WebP or SVG image (code unsupported_media_type)",
    422: "Invalid input (codes validation_error, order_mismatch, invalid_image); fields maps paths to messages",
}


def errors(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    return {code: {**ERROR_RESPONSE, "description": _DESCRIPTIONS[code]} for code in status_codes}
