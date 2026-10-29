"""BE-T-107: the test session refuses any database whose name does not end in ``_test`` (SEC-BE-019).

The subprocess test runs a real pytest session with ``TEST_DATABASE_URL`` pointing at ``mitali_portfolio`` and a
port where nothing listens: the guard must stop the session before any connection, migration or truncation.
"""

from __future__ import annotations

import os
import subprocess
import sys

import pytest

from tests.harness import BACKEND_DIR, UnsafeTestDatabaseError, assert_safe_test_database, closed_port


@pytest.mark.be_t("BE-T-107")
@pytest.mark.parametrize(
    "url",
    [
        "postgresql+asyncpg://u:p@localhost:5442/mitali_portfolio",
        "postgresql+asyncpg://u:p@localhost:5442/mitali_portfolio_test_copy",
        "postgresql+asyncpg://u:p@localhost:5442/",
        "",
        None,
    ],
)
def test_assert_safe_test_database_rejects_non_test_names(url: str | None) -> None:
    with pytest.raises(UnsafeTestDatabaseError):
        assert_safe_test_database(url)


def test_assert_safe_test_database_accepts_test_name() -> None:
    url = "postgresql+asyncpg://u:p@localhost:5442/mitali_portfolio_test"
    assert assert_safe_test_database(url) == "mitali_portfolio_test"


@pytest.mark.be_t("BE-T-107")
def test_session_fixture_aborts_before_migration_for_non_test_database(tmp_path: object) -> None:
    port = closed_port()
    env = {
        **os.environ,
        "APP_ENV": "test",
        "DATABASE_URL": f"postgresql+asyncpg://guard:guard-pw@127.0.0.1:{port}/mitali_portfolio",
        "TEST_DATABASE_URL": f"postgresql+asyncpg://guard:guard-pw@127.0.0.1:{port}/mitali_portfolio",
        "HASH_KEY_SECRET": "guard-test-hash-key-secret-0123456789abcdef",
    }
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-p",
            "no:cacheprovider",
            "tests/integration/test_migrations.py::test_migrations_downgrade_upgrade_cycle_succeeds",
        ],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    output = result.stdout + result.stderr
    assert result.returncode == 3, output
    assert "Refusing to run tests against database 'mitali_portfolio'" in output
    assert "No migration or truncation was run" in output
    assert "guard-pw" not in output
