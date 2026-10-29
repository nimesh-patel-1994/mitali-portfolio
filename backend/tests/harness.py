"""Test-harness helpers shared by ``conftest.py`` and the harness tests (BE-025, SD-006, SEC-BE-019)."""

from __future__ import annotations

import socket
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any, Final

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from app.core.config import Settings, load_settings

BACKEND_DIR: Final = Path(__file__).resolve().parents[1]
ALEMBIC_INI: Final = BACKEND_DIR / "alembic.ini"

DUMMY_DATABASE_URL: Final = "postgresql+asyncpg://dummy_user:dummy-password@127.0.0.1:5442/not_used_test"
DUMMY_HASH_KEY_SECRET: Final = "test-only-hash-key-secret-0123456789abcdef"

# Tables kept by the per-session reset (rows are reset to the placeholders instead of truncated).
SINGLETON_TABLES: Final = frozenset({"profile", "site_settings"})


class UnsafeTestDatabaseError(RuntimeError):
    pass


def assert_safe_test_database(url: str | None) -> str:
    """Return the database name, or raise when it is missing or does not end in ``_test`` (BE-T-107)."""
    if not url:
        raise UnsafeTestDatabaseError(
            "TEST_DATABASE_URL is not set (backend/.env). Integration tests need the mitali_portfolio_test database."
        )
    name = make_url(url).database or ""
    if not name.endswith("_test"):
        raise UnsafeTestDatabaseError(
            f"Refusing to run tests against database '{name}': TEST_DATABASE_URL must name a database ending in "
            "'_test'. No migration or truncation was run."
        )
    return name


def unit_settings(**overrides: Any) -> Settings:
    """Settings for tests that never touch a database (no ``.env`` is read)."""
    values: dict[str, Any] = {
        "_env_file": None,
        "app_env": "test",
        "database_url": DUMMY_DATABASE_URL,
        "hash_key_secret": DUMMY_HASH_KEY_SECRET,
    }
    values.update(overrides)
    return load_settings(**values)


def closed_port() -> int:
    """A local TCP port with nothing listening on it (bound, then released)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port: int = sock.getsockname()[1]
    return port


def alembic_config(database_url: str) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.attributes["database_url"] = database_url
    config.attributes["skip_logging_config"] = True
    return config


def run_in_thread[T](func: Callable[[], T]) -> T:
    """Run ``func`` in a fresh thread (Alembic's env.py calls ``asyncio.run``, which needs a loop-free thread)."""
    result: dict[str, Any] = {}

    def target() -> None:
        try:
            result["value"] = func()
        except BaseException as exc:  # re-raised in the caller's thread
            result["error"] = exc

    thread = threading.Thread(target=target, name="alembic-runner")
    thread.start()
    thread.join()
    if "error" in result:
        raise result["error"]
    return result["value"]  # type: ignore[no-any-return]


def alembic_upgrade(database_url: str, revision: str = "head") -> None:
    run_in_thread(lambda: command.upgrade(alembic_config(database_url), revision))


def alembic_downgrade(database_url: str, revision: str = "base") -> None:
    run_in_thread(lambda: command.downgrade(alembic_config(database_url), revision))


def alembic_check(database_url: str) -> None:
    run_in_thread(lambda: command.check(alembic_config(database_url)))


def effective_api_routes(app: Any) -> list[Any]:
    """Every API route of ``app`` with its effective path, methods, operation id and dependant.

    FastAPI >= 0.16x keeps included routers as lazy ``_IncludedRouter`` entries in ``app.routes``; their effective
    routes (router prefixes and dependencies applied) come from ``effective_candidates()``. Plain ``APIRoute``
    entries are returned as they are.
    """
    found: list[Any] = []

    def walk(routes: list[Any]) -> None:
        for route in routes:
            candidates = getattr(route, "effective_candidates", None)
            if callable(candidates):
                walk(list(candidates()))
            elif getattr(route, "dependant", None) is not None:
                found.append(route)

    walk(list(app.routes))
    return found
