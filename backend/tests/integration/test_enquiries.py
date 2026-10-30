"""BE-007 contact endpoint and rate limiter: BE-T-030..BE-T-036, SEC-BE-007 (NUL bytes)."""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.config import Settings
from app.core.logging import JsonFormatter
from app.main import create_app
from app.models import Enquiry, RateLimitCounter
from app.repositories import enquiries as enquiry_repository
from app.services.rate_limit import make_key
from tests.conftest import api_client

PATH = "/api/public/enquiries"


def _valid(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": "Riley Example",
        "email": "riley@example.com",
        "enquiry_type": "content_strategy",
        "message": "We would like help with a product launch.",
    }
    body.update(overrides)
    return body


async def _count(session: AsyncSession, model: Any) -> int:
    return int((await session.execute(select(func.count()).select_from(model))).scalar_one())


async def _counter(session: AsyncSession, settings: Settings, ip: str) -> RateLimitCounter | None:
    key = make_key(settings.hash_key_secret, ip)
    statement = select(RateLimitCounter).where(
        RateLimitCounter.bucket == "contact_ip", RateLimitCounter.key_hash == key
    )
    return (await session.execute(statement.execution_options(populate_existing=True))).scalar_one_or_none()


@pytest.mark.be_t("BE-T-030")
async def test_create_enquiry_valid_input_stores_one_new_row(db_app: FastAPI, db_session: AsyncSession) -> None:
    async with api_client(db_app, ip="198.51.100.10") as client:
        response = await client.post(PATH, json=_valid(budget_range="3000_7500", company="  Example Ltd  ", website=""))
    assert response.status_code == 201, response.text
    assert response.json() == {"received": True}
    rows = (await db_session.execute(select(Enquiry))).scalars().all()
    assert len(rows) == 1
    row = rows[0]
    assert row.status == "new"
    assert row.company == "Example Ltd"
    assert row.budget_range == "3000_7500"
    assert row.email == "riley@example.com"


@pytest.mark.be_t("BE-T-031")
@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"name": None}, "name"),
        ({"email": "not-an-email"}, "email"),
        ({"message": "x" * 5001}, "message"),
        ({"enquiry_type": "plumbing"}, "enquiry_type"),
        ({"message": "   "}, "message"),
        ({"budget_range": "1000000"}, "budget_range"),
        ({"surprise": "field"}, "surprise"),
    ],
)
async def test_create_enquiry_invalid_input_422_nothing_stored_or_counted(
    db_app: FastAPI, db_session: AsyncSession, db_settings: Settings, overrides: dict[str, Any], field: str
) -> None:
    body = _valid(**overrides)
    if body.get("name") is None:
        body.pop("name")
    async with api_client(db_app, ip="198.51.100.11") as client:
        response = await client.post(PATH, json=body)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert field in error["fields"]
    assert await _count(db_session, Enquiry) == 0
    assert await _counter(db_session, db_settings, "198.51.100.11") is None


@pytest.mark.sec("SEC-BE-007")
@pytest.mark.parametrize("field", ["name", "message"])
async def test_create_enquiry_nul_byte_is_422_with_field_path(db_app: FastAPI, field: str) -> None:
    async with api_client(db_app, ip="198.51.100.12") as client:
        response = await client.post(PATH, json=_valid(**{field: "abc\x00def"}))
    assert response.status_code == 422
    assert field in response.json()["error"]["fields"]


@pytest.mark.be_t("BE-T-032")
async def test_create_enquiry_honeypot_returns_201_stores_nothing_counts(
    db_app: FastAPI, db_session: AsyncSession, db_settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    async with api_client(db_app, ip="198.51.100.13") as client:
        response = await client.post(PATH, json=_valid(website="https://spam.example"))
    assert response.status_code == 201
    assert response.json() == {"received": True}
    assert await _count(db_session, Enquiry) == 0
    counter = await _counter(db_session, db_settings, "198.51.100.13")
    assert counter is not None
    assert counter.count == 1
    events = [record.getMessage() for record in caplog.records if record.name == "app.audit"]
    assert events == ["contact.honeypot_hit"]
    assert "spam.example" not in caplog.text
    assert "Riley" not in caplog.text


@pytest.mark.be_t("BE-T-032")
@pytest.mark.parametrize("website", ["x" * 5000, "spam" + chr(0) + "bot" + chr(7), "line one" + chr(10) + "two"])
async def test_honeypot_of_any_length_or_content_still_gets_the_decoy(
    db_app: FastAPI, db_session: AsyncSession, website: str
) -> None:
    """Review n5: an over-long or control-character honeypot value is a bot too: decoy 201, nothing stored."""
    async with api_client(db_app, ip="198.51.100.14") as client:
        response = await client.post(PATH, json=_valid(website=website))
    assert response.status_code == 201, response.text
    assert response.json() == {"received": True}
    assert await _count(db_session, Enquiry) == 0


@pytest.mark.be_t("BE-T-033")
async def test_contact_rate_limit_per_ip_and_window(
    db_app: FastAPI,
    db_session: AsyncSession,
    db_settings: Settings,
    shift_time: Callable[..., Awaitable[None]],
) -> None:
    async with api_client(db_app, ip="198.51.100.20") as client_a, api_client(db_app, ip="198.51.100.21") as client_b:
        statuses = [(await client_a.post(PATH, json=_valid())).status_code for _ in range(5)]
        assert statuses == [201] * 5
        sixth = await client_a.post(PATH, json=_valid())
        assert sixth.status_code == 429
        assert sixth.json()["error"]["code"] == "rate_limited"
        retry_after = int(sixth.headers["Retry-After"])
        assert 1 <= retry_after <= 600

        assert (await client_b.post(PATH, json=_valid())).status_code == 201

        key = make_key(db_settings.hash_key_secret, "198.51.100.20")
        await shift_time(
            RateLimitCounter.window_start,
            timedelta(minutes=-10),
            RateLimitCounter.bucket == "contact_ip",
            RateLimitCounter.key_hash == key,
        )
        assert (await client_a.post(PATH, json=_valid())).status_code == 201
    assert await _count(db_session, Enquiry) == 7


@pytest.mark.be_t("BE-T-034")
async def test_rate_limit_rows_hold_only_hmac_keys(
    db_app: FastAPI, db_session: AsyncSession, db_settings: Settings
) -> None:
    ip = "198.51.100.30"
    async with api_client(db_app, ip=ip) as client:
        await client.post(PATH, json=_valid())
    rows = (await db_session.execute(select(RateLimitCounter))).scalars().all()
    assert len(rows) == 1
    assert rows[0].bucket == "contact_ip"
    assert len(rows[0].key_hash) == 64
    assert all(char in "0123456789abcdef" for char in rows[0].key_hash)
    assert rows[0].key_hash == make_key(db_settings.hash_key_secret, ip)
    dump = (await db_session.execute(text("SELECT row_to_json(r)::text FROM rate_limit_counters r"))).scalars().all()
    assert all(ip not in line for line in dump)
    enquiry_dump = (await db_session.execute(text("SELECT row_to_json(e)::text FROM enquiries e"))).scalars().all()
    assert all(ip not in line for line in enquiry_dump)


@pytest.mark.be_t("BE-T-035")
async def test_contact_rate_limit_is_exact_under_concurrency(db_settings: Settings, db_engine: AsyncEngine) -> None:
    """Real commits on separate connections (no per-test transaction); rows are removed afterwards."""
    ip = f"203.0.113.{uuid.uuid4().int % 200 + 20}"
    marker = f"concurrency-{uuid.uuid4().hex}"
    app = create_app(db_settings)
    try:
        async with api_client(app, ip=ip) as client:
            responses = await asyncio.gather(*(client.post(PATH, json=_valid(message=marker)) for _ in range(10)))
        statuses = sorted(response.status_code for response in responses)
        assert statuses == [201] * 5 + [429] * 5
        async with db_engine.connect() as connection:
            stored = (
                await connection.execute(select(func.count()).select_from(Enquiry).where(Enquiry.message == marker))
            ).scalar_one()
        assert stored == 5
    finally:
        await app.state.engine.dispose()
        async with db_engine.begin() as connection:
            await connection.execute(delete(Enquiry).where(Enquiry.message == marker))
            await connection.execute(
                delete(RateLimitCounter).where(RateLimitCounter.key_hash == make_key(db_settings.hash_key_secret, ip))
            )


@pytest.mark.be_t("BE-T-036")
async def test_create_enquiry_database_failure_is_500_without_content_in_logs(
    db_app: FastAPI, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def failing_insert(*_args: Any, **_kwargs: Any) -> Any:
        raise OperationalError("INSERT INTO enquiries ... riley@example.com", {}, Exception("connection lost"))

    monkeypatch.setattr(enquiry_repository, "insert", failing_insert)
    caplog.set_level(logging.DEBUG)
    async with api_client(db_app, ip="198.51.100.40") as client:
        response = await client.post(PATH, json=_valid(message="Private launch plan for Zephyr"))
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "riley@example.com" not in response.text
    # What the app writes is the JSON formatter's output (exception type and frames only, never the message).
    written = "\n".join(JsonFormatter().format(record) for record in caplog.records)
    assert '"error_type": "OperationalError"' in written
    for needle in ("riley@example.com", "Zephyr", "Riley Example", "198.51.100.40"):
        assert needle not in written
