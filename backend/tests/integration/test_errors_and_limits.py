"""Error envelope, request-size limits and pagination (BE-003): BE-T-010, BE-T-011, BE-T-012, BE-T-013 (part).

These run against the real middleware stack with test-only probe routes; no database is needed.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx
import pytest

from app.core.limits import JSON_BODY_LIMIT


def _assert_envelope(response: httpx.Response, status: int, code: str) -> dict[str, object]:
    assert response.status_code == status, response.text
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)
    assert body["error"]["message"]
    error: dict[str, object] = body["error"]
    return error


@pytest.mark.be_t("BE-T-010")
async def test_validation_error_fields_use_dotted_paths_without_prefix(
    probe_client: httpx.AsyncClient, allowed_origin: str
) -> None:
    response = await probe_client.post(
        "/api/public/_probe",
        json={"results": [{"label": "Open rate", "value": "not-a-number"}]},
    )
    error = _assert_envelope(response, 422, "validation_error")
    fields = error["fields"]
    assert isinstance(fields, dict)
    assert set(fields) == {"name", "results.0.value"}
    assert not any(key.startswith(("body.", "query.")) for key in fields)

    admin = await probe_client.put(
        "/api/admin/_probe", json={"name": "x", "unexpected": 1}, headers={"Origin": allowed_origin}
    )
    admin_error = _assert_envelope(admin, 422, "validation_error")
    assert admin_error["fields"] == {"unexpected": "Extra inputs are not permitted"}


async def test_malformed_json_body_returns_validation_envelope(probe_client: httpx.AsyncClient) -> None:
    response = await probe_client.post(
        "/api/public/_probe", content=b'{"name": ', headers={"Content-Type": "application/json"}
    )
    _assert_envelope(response, 422, "validation_error")


@pytest.mark.be_t("BE-T-011")
async def test_unexpected_exception_returns_generic_500_with_request_id(
    probe_client: httpx.AsyncClient,
) -> None:
    response = await probe_client.get("/api/public/_boom")
    error = _assert_envelope(response, 500, "internal_error")
    message = str(error["message"])
    request_id = response.headers["X-Request-ID"]
    assert request_id in message
    assert "boom" not in response.text
    assert "s3cr3t" not in response.text
    assert "Traceback" not in response.text
    assert "fields" not in error
    # Security headers are present on the 500 too (catch-all runs inside the header middleware).
    assert response.headers["X-Content-Type-Options"] == "nosniff"


@pytest.mark.be_t("BE-T-011")
async def test_unknown_route_returns_404_envelope(client: httpx.AsyncClient) -> None:
    for path in ("/api/public/does-not-exist", "/work", "/"):
        response = await client.get(path)
        _assert_envelope(response, 404, "not_found")


@pytest.mark.be_t("BE-T-011")
async def test_wrong_method_returns_405_envelope(client: httpx.AsyncClient) -> None:
    response = await client.delete("/api/health")
    error = _assert_envelope(response, 405, "not_found")
    assert error["message"] == "Method not allowed."
    assert "GET" in response.headers.get("allow", "")


@pytest.mark.be_t("BE-T-012")
async def test_json_body_over_1mb_returns_413(probe_client: httpx.AsyncClient, allowed_origin: str) -> None:
    body = json.dumps({"name": "x", "blob": ""}).encode()
    oversized = body[:-2] + b"a" * (JSON_BODY_LIMIT + 1 - len(body)) + b'"}'
    assert len(oversized) == JSON_BODY_LIMIT + 1
    response = await probe_client.put(
        "/api/admin/_probe",
        content=oversized,
        headers={"Content-Type": "application/json", "Origin": allowed_origin},
    )
    _assert_envelope(response, 413, "payload_too_large")


@pytest.mark.be_t("BE-T-012")
async def test_json_body_of_exactly_1mb_reaches_validation(
    probe_client: httpx.AsyncClient, allowed_origin: str
) -> None:
    body = json.dumps({"name": "x", "blob": ""}).encode()
    exact = body[:-2] + b"a" * (JSON_BODY_LIMIT - len(body)) + b'"}'
    assert len(exact) == JSON_BODY_LIMIT
    response = await probe_client.put(
        "/api/admin/_probe",
        content=exact,
        headers={"Content-Type": "application/json", "Origin": allowed_origin},
    )
    assert response.status_code == 200, response.text


@pytest.mark.be_t("BE-T-012")
async def test_streamed_body_without_length_over_limit_returns_413(
    probe_client: httpx.AsyncClient, allowed_origin: str
) -> None:
    chunk = b"a" * 65_536

    async def stream() -> AsyncIterator[bytes]:
        yield b'{"name": "x", "blob": "'
        for _ in range(JSON_BODY_LIMIT // len(chunk) + 1):
            yield chunk
        yield b'"}'

    response = await probe_client.put(
        "/api/admin/_probe",
        content=stream(),
        headers={"Content-Type": "application/json", "Origin": allowed_origin},
    )
    assert "content-length" not in {key.lower() for key in response.request.headers}
    _assert_envelope(response, 413, "payload_too_large")


@pytest.mark.be_t("BE-T-013")
@pytest.mark.parametrize("query", ["page=0", "page_size=0", "page_size=101", "page=abc"])
async def test_pagination_out_of_range_returns_422(probe_client: httpx.AsyncClient, query: str) -> None:
    response = await probe_client.get(f"/api/public/_page?{query}")
    error = _assert_envelope(response, 422, "validation_error")
    fields = error["fields"]
    assert isinstance(fields, dict)
    assert set(fields) <= {"page", "page_size"}


@pytest.mark.be_t("BE-T-013")
async def test_pagination_page_beyond_end_returns_empty_items_and_total(
    probe_client: httpx.AsyncClient,
) -> None:
    response = await probe_client.get("/api/public/_page?page=999&page_size=5")
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 7, "page": 999, "page_size": 5}

    first = await probe_client.get("/api/public/_page")
    assert first.json() == {"items": [0, 1, 2, 3, 4, 5, 6], "total": 7, "page": 1, "page_size": 20}
