"""Shared fixtures (BE-025, TS-019, SD-006).

Two families of fixtures:

* **No database** (``unit_settings``, ``app``, ``client``, ``media_root``): the app is built with dummy settings and
  never connects. Used by unit tests and by integration tests of middleware, errors and static files.
* **Test database** (``db_engine``, ``db_session``, ``db_client``, ``admin_client``, ``query_counter``,
  ``shift_time``): require ``TEST_DATABASE_URL`` in ``backend/.env`` naming a database that ends in ``_test``
  (anything else aborts the session before any migration or truncation, BE-T-107). The schema is migrated once per
  session (``alembic upgrade head``), all tables except the singletons are truncated and the singletons reset to the
  placeholders; each test runs inside a connection-level transaction (``join_transaction_mode="create_savepoint"``)
  that is rolled back afterwards.

Tests that use a database fixture get the ``db`` marker automatically, so ``pytest -m "not db"`` runs everything
that works without PostgreSQL.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import event, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.api.deps import get_db
from app.core.config import Settings, load_settings
from app.db import create_engine
from app.main import create_app
from app.models import Base
from app.models.singletons import (
    CONTACT_PROMISE_DEFAULT,
    FOOTER_RIGHTS_LINE_DEFAULT,
    PROFILE_PLACEHOLDER,
    SETTINGS_PLACEHOLDER,
)
from tests import factories
from tests.fixtures.images import write_samples
from tests.harness import (
    SINGLETON_TABLES,
    UnsafeTestDatabaseError,
    alembic_upgrade,
    assert_safe_test_database,
    unit_settings,
)

BASE_URL = "http://127.0.0.1:8000"
ALLOWED_ORIGIN = "http://localhost:5173"
DB_FIXTURES = frozenset({"db_engine", "db_settings"})


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    for item in items:
        if DB_FIXTURES & set(getattr(item, "fixturenames", ())):
            item.add_marker(pytest.mark.db)


# ------------------------------------------------------------------------------------------- no database


@pytest.fixture
def media_root(tmp_path: Path) -> Path:
    root = tmp_path / "media"
    (root / "uploads").mkdir(parents=True)
    (root / "seed").mkdir()
    (root / "tmp").mkdir()
    return root


@pytest.fixture
def sample_images(tmp_path: Path) -> dict[str, Path]:
    return write_samples(tmp_path / "images")


@pytest.fixture
def settings(media_root: Path) -> Settings:
    return unit_settings(media_root=media_root)


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=BASE_URL) as async_client:
        yield async_client


# ------------------------------------------------------------------------------------------- test database


@pytest.fixture(scope="session")
def db_settings() -> Settings:
    """Settings from ``backend/.env`` with ``DATABASE_URL`` replaced by ``TEST_DATABASE_URL`` (guarded)."""
    loaded = load_settings(app_env="test")
    url = loaded.test_database_url.get_secret_value() if loaded.test_database_url else None
    try:
        assert_safe_test_database(url)
    except UnsafeTestDatabaseError as exc:
        pytest.exit(str(exc), returncode=3)
    return load_settings(app_env="test", database_url=url)


@pytest.fixture(scope="session")
def migrated_database(db_settings: Settings) -> str:
    url = db_settings.database_url.get_secret_value()
    alembic_upgrade(url)
    return url


@pytest.fixture(scope="session")
async def db_engine(db_settings: Settings, migrated_database: str) -> AsyncIterator[AsyncEngine]:
    engine = create_engine(db_settings.database_url)
    async with engine.begin() as connection:
        await reset_database(connection)
    try:
        yield engine
    finally:
        await engine.dispose()


async def reset_database(connection: AsyncConnection) -> None:
    """Truncate every table except the singletons and reset those to the migration placeholders.

    ``TRUNCATE ... CASCADE`` also empties the singletons (they reference ``media_assets``), so they are upserted
    afterwards rather than updated.
    """
    tables = [table.name for table in Base.metadata.sorted_tables if table.name not in SINGLETON_TABLES]
    # Table names come from the model metadata, never from input.
    await connection.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    profile_values = {
        **PROFILE_PLACEHOLDER,
        "portrait_media_id": None,
        "portrait_alt": None,
        "seed_key": None,
        "updated_at": text("now()"),
    }
    settings_values = {
        **SETTINGS_PLACEHOLDER,
        "contact_promise": CONTACT_PROMISE_DEFAULT,  # migration 0002 defaults
        "footer_rights_line": FOOTER_RIGHTS_LINE_DEFAULT,
        "seed_key": None,
        "content_changed_at": text("now()"),
        "updated_at": text("now()"),
    }
    for table_name, values in (("profile", profile_values), ("site_settings", settings_values)):
        table = Base.metadata.tables[table_name]
        statement = insert(table).values(id=1, **values)
        await connection.execute(statement.on_conflict_do_update(index_elements=["id"], set_=values))


@pytest.fixture
async def db_connection(db_engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    async with db_engine.connect() as connection:
        transaction = await connection.begin()
        try:
            yield connection
        finally:
            await transaction.rollback()


def _session_on(connection: AsyncConnection) -> AsyncSession:
    return AsyncSession(
        bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False, autoflush=False
    )


@pytest.fixture
async def db_session(db_connection: AsyncConnection) -> AsyncIterator[AsyncSession]:
    session = _session_on(db_connection)
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture
def db_app_factory(db_settings: Settings, db_connection: AsyncConnection, media_root: Path) -> Callable[..., FastAPI]:
    """``db_app_factory(session_cookie_secure=True)``: app on the per-test transaction with settings overrides."""

    def build(**overrides: Any) -> FastAPI:
        app = create_app(db_settings.model_copy(update={"media_root": media_root, **overrides}))

        async def override_get_db() -> AsyncIterator[AsyncSession]:
            session = _session_on(db_connection)
            try:
                yield session
            finally:
                await session.close()

        app.dependency_overrides[get_db] = override_get_db
        return app

    return build


@pytest.fixture
def db_app(db_app_factory: Callable[..., FastAPI]) -> FastAPI:
    return db_app_factory()


@pytest.fixture
def db_session_factory(db_connection: AsyncConnection) -> Callable[[], AsyncSession]:
    """Factory of sessions joined to the per-test transaction (for CLI ``main_async(session_factory=...)``)."""
    return lambda: _session_on(db_connection)


def api_client(
    app: FastAPI,
    *,
    ip: str = "127.0.0.1",
    cookies: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.AsyncClient:
    """Client whose requests come from ``ip`` (``request.client.host``); use with ``async with``."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, client=(ip, 50000)),
        base_url=BASE_URL,
        cookies=cookies,
        headers=headers,
    )


@pytest.fixture
async def db_client(db_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=db_app), base_url=BASE_URL) as async_client:
        yield async_client


@pytest.fixture
async def admin_client(db_app: FastAPI, db_session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    """Client with a valid admin session: ``mp_session`` + ``mp_csrf`` cookies, ``X-CSRF-Token`` and ``Origin``.

    The session row is created directly (only hashes stored, SD-007), so this fixture does not depend on the login
    endpoint.
    """
    admin = await factories.admin_user(db_session)
    _row, token, csrf = await factories.admin_session(db_session, admin.id)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=db_app),
        base_url=BASE_URL,
        cookies={"mp_session": token, "mp_csrf": csrf},
        headers={"X-CSRF-Token": csrf, "Origin": ALLOWED_ORIGIN},
    ) as async_client:
        yield async_client


@pytest.fixture
def shift_time(db_session: AsyncSession) -> Callable[..., Awaitable[None]]:
    """``await shift_time(Model.column, timedelta(hours=-9), Model.id == x)``: move stored timestamps, no sleeps."""

    async def shift(column: InstrumentedAttribute[Any], delta: timedelta, *where: Any) -> None:
        statement = update(column.class_).values({column.key: column + delta})
        if where:
            statement = statement.where(*where)
        await db_session.execute(statement)
        await db_session.flush()

    return shift


class QueryCounter:
    def __init__(self) -> None:
        self.count = 0
        self.statements: list[str] = []


@pytest.fixture
def query_counter(db_engine: AsyncEngine) -> Callable[[], Any]:
    """``with query_counter() as counter: ...`` then ``counter.count`` (SQL statements executed meanwhile)."""

    @contextmanager
    def counting() -> Iterator[QueryCounter]:
        counter = QueryCounter()

        def before_cursor_execute(*args: Any) -> None:
            counter.count += 1
            counter.statements.append(str(args[2]))

        event.listen(db_engine.sync_engine, "before_cursor_execute", before_cursor_execute)
        try:
            yield counter
        finally:
            event.remove(db_engine.sync_engine, "before_cursor_execute", before_cursor_execute)

    return counting
