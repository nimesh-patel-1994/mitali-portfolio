"""BE-010 login throttle: BE-T-045..BE-T-049 and SEC-BE-006 (no Argon2 work while blocked)."""

from __future__ import annotations

import asyncio
import threading
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import timedelta

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core import security
from app.core.config import Settings
from app.main import create_app
from app.models import RateLimitCounter
from app.services import rate_limit
from app.services.rate_limit import make_key
from tests import factories
from tests.conftest import ALLOWED_ORIGIN, api_client

LOGIN = "/api/admin/auth/login"
IP_A = "192.0.2.10"
IP_B = "192.0.2.20"
WRONG_PASSWORD = "wrong-password"


async def _attempt(app: FastAPI, ip: str, *, email: str = factories.ADMIN_EMAIL, password: str) -> httpx.Response:
    async with api_client(app, ip=ip, headers={"Origin": ALLOWED_ORIGIN}) as client:
        return await client.post(LOGIN, json={"email": email, "password": password})


async def _codes(
    app: FastAPI, ip: str, count: int, *, email: str = factories.ADMIN_EMAIL, password: str = WRONG_PASSWORD
) -> list[int]:
    return [(await _attempt(app, ip, email=email, password=password)).status_code for _ in range(count)]


async def _rows(session: AsyncSession) -> list[RateLimitCounter]:
    statement = select(RateLimitCounter).execution_options(populate_existing=True)
    return list((await session.execute(statement)).scalars().all())


@pytest.mark.be_t("BE-T-045")
async def test_five_failures_block_even_the_correct_password(db_app: FastAPI, db_session: AsyncSession) -> None:
    await factories.admin_with_password(db_session)
    assert await _codes(db_app, IP_A, 5) == [401] * 5
    blocked = await _attempt(db_app, IP_A, password=factories.ADMIN_PASSWORD)
    assert blocked.status_code == 429
    error = blocked.json()["error"]
    assert error == {"code": "too_many_attempts", "message": "Too many attempts. Try again in 15 minutes."}
    assert 1 <= int(blocked.headers["Retry-After"]) <= 900
    assert "set-cookie" not in blocked.headers


@pytest.mark.be_t("BE-T-046")
async def test_ip_bucket_blocks_one_client_only(db_app: FastAPI, db_session: AsyncSession) -> None:
    await factories.admin_with_password(db_session)
    for n in range(5):
        response = await _attempt(db_app, IP_A, email=f"guess{n}@example.com", password="wrong-password")
        assert response.status_code == 401
    assert (await _attempt(db_app, IP_A, password=factories.ADMIN_PASSWORD)).status_code == 429
    assert (await _attempt(db_app, IP_B, password=factories.ADMIN_PASSWORD)).status_code == 200


@pytest.mark.be_t("BE-T-047")
async def test_expired_block_allows_login_and_resets_both_buckets(
    db_app: FastAPI, db_session: AsyncSession, db_settings: Settings, shift_time: Callable[..., Awaitable[None]]
) -> None:
    await factories.admin_with_password(db_session)
    assert await _codes(db_app, IP_A, 5) == [401] * 5
    rows = await _rows(db_session)
    assert {row.bucket for row in rows} == {"login_ip", "login_account"}
    assert all(row.blocked_until is not None for row in rows)
    await shift_time(RateLimitCounter.blocked_until, -timedelta(minutes=16))
    await shift_time(RateLimitCounter.window_start, -timedelta(minutes=16))

    assert (await _attempt(db_app, IP_A, password=factories.ADMIN_PASSWORD)).status_code == 200
    keys = {make_key(db_settings.hash_key_secret, IP_A), make_key(db_settings.hash_key_secret, factories.ADMIN_EMAIL)}
    assert not [row for row in await _rows(db_session) if row.key_hash in keys]


@pytest.mark.be_t("BE-T-048")
async def test_success_resets_counters_so_four_plus_four_never_blocks(
    db_app: FastAPI, db_session: AsyncSession
) -> None:
    await factories.admin_with_password(db_session)
    assert await _codes(db_app, IP_A, 4) == [401] * 4
    assert (await _attempt(db_app, IP_A, password=factories.ADMIN_PASSWORD)).status_code == 200
    assert await _codes(db_app, IP_A, 4) == [401] * 4
    assert (await _attempt(db_app, IP_A, password=factories.ADMIN_PASSWORD)).status_code == 200
    assert all(row.blocked_until is None for row in await _rows(db_session))


@pytest.mark.be_t("BE-T-049")
async def test_login_deletes_counters_older_than_one_day(db_app: FastAPI, db_session: AsyncSession) -> None:
    await factories.admin_with_password(db_session)
    old_key, recent_key = "a" * 64, "b" * 64
    for key in (old_key, recent_key):
        db_session.add(RateLimitCounter(bucket="contact_ip", key_hash=key, window_start=func.now(), count=1))
    await db_session.flush()
    await db_session.execute(
        update(RateLimitCounter)
        .where(RateLimitCounter.key_hash == old_key)
        .values(updated_at=func.now() - timedelta(days=2))
    )
    assert (await _attempt(db_app, IP_A, password=factories.ADMIN_PASSWORD)).status_code == 200
    remaining = {row.key_hash for row in await _rows(db_session)}
    assert old_key not in remaining
    assert recent_key in remaining


@pytest.mark.sec("SEC-BE-006")
async def test_blocked_login_does_not_run_argon2(
    db_app: FastAPI, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    await factories.admin_with_password(db_session)
    assert await _codes(db_app, IP_A, 5) == [401] * 5
    calls: list[str] = []

    def spy(stored: str, _password: str) -> bool:
        calls.append(stored)
        return True

    monkeypatch.setattr(security, "verify_password", spy)
    assert (await _attempt(db_app, IP_A, password=factories.ADMIN_PASSWORD)).status_code == 429
    assert calls == []


@pytest.mark.sec("SEC-BE-006")
async def test_concurrent_logins_never_verify_more_than_the_failure_limit(
    db_settings: Settings, db_engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review m3: real commits on separate pooled connections (no per-test transaction); rows removed afterwards.

    Ten simultaneous wrong attempts for one account from one client: check → verify → count is atomic per key, so
    at most five reach Argon2 and the rest are refused with 429.
    """
    ip = f"198.51.100.{uuid.uuid4().int % 200 + 20}"
    email = f"race-{uuid.uuid4().hex[:12]}@example.com"
    lock = threading.Lock()
    calls: list[str] = []

    def slow_spy(stored: str, _password: str) -> bool:
        with lock:
            calls.append(stored)
        time.sleep(0.05)  # widen the window between check and count
        return False

    monkeypatch.setattr(security, "verify_password", slow_spy)
    app = create_app(db_settings)
    try:
        async with api_client(app, ip=ip, headers={"Origin": ALLOWED_ORIGIN}) as client:
            responses = await asyncio.gather(
                *(client.post(LOGIN, json={"email": email, "password": WRONG_PASSWORD}) for _ in range(10))
            )
        statuses = sorted(response.status_code for response in responses)
        assert len(calls) <= 5
        assert statuses == [401] * 5 + [429] * 5
    finally:
        await app.state.engine.dispose()
        keys = [make_key(db_settings.hash_key_secret, ip), make_key(db_settings.hash_key_secret, email)]
        async with db_engine.begin() as connection:
            await connection.execute(delete(RateLimitCounter).where(RateLimitCounter.key_hash.in_(keys)))


@pytest.mark.sec("SEC-BE-006")
async def test_password_verification_holds_no_database_connection(
    db_settings: Settings, db_engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review B-1: six logins (more than the pool's five connections, no overflow) verify at the same time, which is
    only possible when no connection or transaction is held during Argon2; real commits, rows removed afterwards."""
    count = 6
    run = uuid.uuid4().hex[:8]
    ips = [f"203.0.113.{n + 100}" for n in range(count)]
    emails = [f"pool-{run}-{n}@example.com" for n in range(count)]
    app = create_app(db_settings)
    barrier = threading.Barrier(count, timeout=5)
    checked_out: list[int] = []

    def blocking_spy(_stored: str, _password: str) -> bool:
        barrier.wait()  # every login must be inside verification at once
        checked_out.append(app.state.engine.pool.checkedout())
        return False

    monkeypatch.setattr(security, "verify_password", blocking_spy)

    async def attempt(ip: str, email: str) -> int:
        async with api_client(app, ip=ip, headers={"Origin": ALLOWED_ORIGIN}) as client:
            return (await client.post(LOGIN, json={"email": email, "password": WRONG_PASSWORD})).status_code

    try:
        statuses = await asyncio.gather(*(attempt(ip, email) for ip, email in zip(ips, emails, strict=True)))
        assert statuses == [401] * count
        assert checked_out == [0] * count
    finally:
        await app.state.engine.dispose()
        keys = [make_key(db_settings.hash_key_secret, raw) for raw in [*ips, *emails]]
        async with db_engine.begin() as connection:
            await connection.execute(delete(RateLimitCounter).where(RateLimitCounter.key_hash.in_(keys)))


@pytest.mark.be_t("BE-T-049")
async def test_counter_cleanup_skips_rows_locked_by_another_transaction(db_engine: AsyncEngine) -> None:
    """Review B-2: the stale-counter DELETE uses SKIP LOCKED, so it neither waits on nor deadlocks with an upsert."""
    key = uuid.uuid4().hex + uuid.uuid4().hex
    async with db_engine.begin() as connection:
        await connection.execute(
            insert(RateLimitCounter).values(
                bucket="login_ip",
                key_hash=key,
                window_start=func.now() - timedelta(days=2),
                count=1,
                updated_at=func.now() - timedelta(days=2),
            )
        )
    try:
        async with AsyncSession(db_engine) as holder, AsyncSession(db_engine) as cleaner:
            async with holder.begin():
                locked = select(RateLimitCounter.key_hash).where(RateLimitCounter.key_hash == key).with_for_update()
                assert (await holder.execute(locked)).scalar_one() == key
                async with cleaner.begin():
                    await asyncio.wait_for(rate_limit.cleanup_old_counters(cleaner), timeout=3)
                still_there = select(func.count()).where(RateLimitCounter.key_hash == key)
                assert (await holder.execute(still_there)).scalar_one() == 1
            async with cleaner.begin():
                await rate_limit.cleanup_old_counters(cleaner)
            async with cleaner.begin():
                assert (await cleaner.execute(still_there)).scalar_one() == 0
    finally:
        async with db_engine.begin() as connection:
            await connection.execute(delete(RateLimitCounter).where(RateLimitCounter.key_hash == key))
