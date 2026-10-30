"""BE-011 admin CLI: BE-T-050..BE-T-054.

``main_async`` runs with sessions joined to the per-test transaction (``db_session_factory``), so nothing is
committed. The unreachable-database case runs the real ``python -m app.cli`` in a subprocess.
"""

from __future__ import annotations

import getpass
import io
import os
import subprocess
import sys
from collections.abc import Callable
from typing import Any

import pytest
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import cli
from app.core import security
from app.core.config import Settings
from app.models import AdminUser, RateLimitCounter, Session
from app.services.rate_limit import make_key
from tests import factories
from tests.conftest import ALLOWED_ORIGIN, api_client
from tests.harness import BACKEND_DIR, DUMMY_HASH_KEY_SECRET, closed_port

EMAIL = "owner@example.com"
PASSWORD = "twelve-chars"  # exactly 12 characters


async def _run(
    argv: list[str], factory: Callable[[], AsyncSession], settings: Settings, password: str
) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    code = await cli.main_async(
        argv, settings=settings, session_factory=factory, stdin=io.StringIO(password + "\n"), stdout=out, stderr=err
    )
    return code, out.getvalue(), err.getvalue()


async def _admins(session: AsyncSession) -> list[AdminUser]:
    statement = select(AdminUser).execution_options(populate_existing=True)
    return list((await session.execute(statement)).scalars().all())


async def _login(app: FastAPI, email: str, password: str) -> int:
    async with api_client(app, headers={"Origin": ALLOWED_ORIGIN}) as client:
        return (await client.post("/api/admin/auth/login", json={"email": email, "password": password})).status_code


@pytest.mark.be_t("BE-T-050")
async def test_cli_create_admin_then_login(
    db_session_factory: Callable[[], AsyncSession], db_settings: Settings, db_session: AsyncSession, db_app: FastAPI
) -> None:
    assert len(PASSWORD) == 12
    code, out, err = await _run(
        ["create-admin", "--email", "Owner@Example.com", "--password-stdin"], db_session_factory, db_settings, PASSWORD
    )
    assert (code, err) == (0, "")
    assert "created" in out
    assert PASSWORD not in out
    admins = await _admins(db_session)
    assert [admin.email for admin in admins] == [EMAIL]
    assert admins[0].password_hash.startswith("$argon2id$")
    assert await _login(db_app, EMAIL, PASSWORD) == 200


@pytest.mark.be_t("BE-T-050")
async def test_cli_password_with_surrounding_spaces_logs_in_exactly_as_typed(
    db_session_factory: Callable[[], AsyncSession], db_settings: Settings, db_session: AsyncSession, db_app: FastAPI
) -> None:
    """Review M1: the login body must not strip the password (the CLI hashes the exact string)."""
    spaced = "  spaced secret phrase  "
    code, _out, err = await _run(
        ["create-admin", "--email", EMAIL, "--password-stdin"], db_session_factory, db_settings, spaced
    )
    assert (code, err) == (0, "")
    assert await _login(db_app, EMAIL, spaced) == 200
    assert await _login(db_app, EMAIL, spaced.strip()) == 401


@pytest.mark.be_t("BE-T-051")
@pytest.mark.parametrize(
    ("email", "password"),
    [
        (EMAIL, "x" * 11),
        (EMAIL, "x" * 129),
        (EMAIL, EMAIL),
        ("ownerlocal12@example.com", "OWNERLOCAL12"),  # the local part in upper case
    ],
)
async def test_cli_create_admin_policy_refusals(
    db_session_factory: Callable[[], AsyncSession],
    db_settings: Settings,
    db_session: AsyncSession,
    email: str,
    password: str,
) -> None:
    code, out, err = await _run(
        ["create-admin", "--email", email, "--password-stdin"], db_session_factory, db_settings, password
    )
    assert code == 1
    assert out == ""
    assert err.startswith("Error: The password must")
    assert password not in err
    assert await _admins(db_session) == []


@pytest.mark.be_t("BE-T-052")
async def test_cli_create_admin_refuses_when_admin_exists(
    db_session_factory: Callable[[], AsyncSession], db_settings: Settings, db_session: AsyncSession
) -> None:
    existing = await factories.admin_with_password(db_session)
    original_hash = existing.password_hash
    code, _out, err = await _run(
        ["create-admin", "--email", "second@example.com", "--password-stdin"],
        db_session_factory,
        db_settings,
        "another-long-password",
    )
    assert code == 1
    assert "an admin already exists" in err.lower()
    admins = await _admins(db_session)
    assert len(admins) == 1
    assert admins[0].password_hash == original_hash


@pytest.mark.be_t("BE-T-053")
async def test_cli_reset_password_ends_sessions_and_clears_account_bucket(
    db_session_factory: Callable[[], AsyncSession], db_settings: Settings, db_session: AsyncSession, db_app: FastAPI
) -> None:
    admin = await factories.admin_with_password(db_session)
    changed_before = admin.password_changed_at
    _s1, token1, _ = await factories.admin_session(db_session, admin.id)
    await factories.admin_session(db_session, admin.id)
    account_key = make_key(db_settings.hash_key_secret, factories.ADMIN_EMAIL)
    db_session.add(
        RateLimitCounter(
            bucket="login_account", key_hash=account_key, window_start=func.now(), count=5,
            blocked_until=func.now() + func.make_interval(0, 0, 0, 0, 0, 15),
        )
    )  # fmt: skip
    await db_session.flush()

    new_password = "a-brand-new-password"
    code, out, err = await _run(
        ["reset-password", "--email", "ADMIN@example.com", "--password-stdin"],
        db_session_factory,
        db_settings,
        new_password,
    )
    assert (code, err) == (0, ""), err
    assert "sessions were ended" in out
    assert (await db_session.execute(select(func.count()).select_from(Session))).scalar_one() == 0
    remaining = (
        await db_session.execute(select(RateLimitCounter).where(RateLimitCounter.key_hash == account_key))
    ).scalar_one_or_none()
    assert remaining is None
    refreshed = (await _admins(db_session))[0]
    assert refreshed.password_changed_at > changed_before
    assert security.verify_password(refreshed.password_hash, new_password)

    async with api_client(db_app, cookies={"mp_session": token1}) as old:
        assert (await old.get("/api/admin/auth/me")).status_code == 401
    assert await _login(db_app, factories.ADMIN_EMAIL, factories.ADMIN_PASSWORD) == 401
    assert await _login(db_app, factories.ADMIN_EMAIL, new_password) == 200


async def test_cli_reset_password_refusals(
    db_session_factory: Callable[[], AsyncSession], db_settings: Settings, db_session: AsyncSession
) -> None:
    code, _out, err = await _run(["reset-password", "--password-stdin"], db_session_factory, db_settings, "x" * 20)
    assert code == 1
    assert "no admin account exists" in err.lower()
    await factories.admin_with_password(db_session)
    code, _out, err = await _run(
        ["reset-password", "--email", "someone@example.com", "--password-stdin"],
        db_session_factory,
        db_settings,
        "y" * 20,
    )
    assert code == 1
    assert "no admin account with that email" in err.lower()
    code, _out, err = await _run(["reset-password", "--password-stdin"], db_session_factory, db_settings, "short")
    assert code == 1
    assert "at least 12" in err


async def test_cli_password_prompt_mismatch_and_empty_stdin(
    db_session_factory: Callable[[], AsyncSession], db_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    answers = iter(["first-password-1", "second-password-2"])
    monkeypatch.setattr(getpass, "getpass", lambda _prompt: next(answers))
    out, err = io.StringIO(), io.StringIO()
    code = await cli.main_async(
        ["create-admin", "--email", EMAIL], settings=db_settings, session_factory=db_session_factory,
        stdout=out, stderr=err,
    )  # fmt: skip
    assert code == 1
    assert "do not match" in err.getvalue()
    assert "first-password-1" not in err.getvalue() + out.getvalue()
    code = await cli.main_async(
        ["create-admin", "--email", EMAIL, "--password-stdin"], settings=db_settings,
        session_factory=db_session_factory, stdin=io.StringIO(""), stdout=out, stderr=err,
    )  # fmt: skip
    assert code == 1
    assert "No password received" in err.getvalue()


async def test_cli_prompted_password_is_used(
    db_session_factory: Callable[[], AsyncSession], db_settings: Settings, db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:  # fmt: skip
    monkeypatch.setattr(getpass, "getpass", lambda _prompt: "prompted-password-ok")
    code = await cli.main_async(
        ["create-admin", "--email", EMAIL], settings=db_settings, session_factory=db_session_factory,
        stdout=io.StringIO(), stderr=io.StringIO(),
    )  # fmt: skip
    assert code == 0
    assert security.verify_password((await _admins(db_session))[0].password_hash, "prompted-password-ok")


@pytest.mark.be_t("BE-T-054")
def test_cli_database_unreachable_subprocess_exits_1_without_password() -> None:
    port = closed_port()
    secret_password = "subprocess-secret-password"
    env: dict[str, Any] = {
        **os.environ,
        "APP_ENV": "test",
        "DATABASE_URL": f"postgresql+asyncpg://nobody:dummy-password@127.0.0.1:{port}/unreachable_test",
        "HASH_KEY_SECRET": DUMMY_HASH_KEY_SECRET,
        "PYTHONIOENCODING": "utf-8",
    }
    result = subprocess.run(  # noqa: S603 - fixed argv, this project's CLI
        [sys.executable, "-m", "app.cli", "create-admin", "--email", EMAIL, "--password-stdin"],
        input=secret_password + "\n",
        capture_output=True,
        text=True,
        cwd=BACKEND_DIR,
        env=env,
        timeout=60,
        check=False,
    )
    assert result.returncode == 1
    output = result.stdout + result.stderr
    assert f"database unreachable on 127.0.0.1:{port}" in output
    assert secret_password not in output
    assert "dummy-password" not in output
    assert "Traceback" not in output


@pytest.mark.be_t("BE-T-054")
def test_cli_main_sync_unreachable_and_bad_config() -> None:
    from tests.harness import unit_settings

    settings = unit_settings(database_url=f"postgresql+asyncpg://nobody:pw@127.0.0.1:{closed_port()}/x_test")
    assert cli.main(["reset-password", "--password-stdin"], settings=settings) == 1
