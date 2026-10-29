"""BE-T-106: static checks on ``scripts/setup_db.ps1`` and ``scripts/setup_db.sql`` (BE-024, SEC-004, BE-REV-020).

The scripts are never executed by tests or agents; only the user runs them.
"""

from __future__ import annotations

import re

import pytest

from tests.harness import BACKEND_DIR

PS1 = (BACKEND_DIR / "scripts" / "setup_db.ps1").read_text(encoding="utf-8")
SQL = (BACKEND_DIR / "scripts" / "setup_db.sql").read_text(encoding="utf-8")


def _param_block(source: str) -> str:
    match = re.search(r"param\((.*?)\n\)", source, re.DOTALL)
    assert match is not None
    return match.group(1)


@pytest.mark.be_t("BE-T-106")
def test_setup_ps1_uses_full_psql_path_and_port_5442() -> None:
    assert '"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe"' in PS1
    assert "[int]$Port = 5442" in PS1
    assert "-p $Port" in PS1
    assert "-v ON_ERROR_STOP=1" in PS1


@pytest.mark.be_t("BE-T-106")
def test_setup_ps1_takes_no_password_parameter_and_reads_it_securely() -> None:
    params = _param_block(PS1)
    assert "password" not in params.lower()
    assert "SecureString" not in params
    assert PS1.count("Read-Host") >= 2
    assert 'Read-Host "New password for the app role' in PS1
    assert "-AsSecureString" in PS1
    # The superuser password is prompted by psql itself: no PGPASSWORD handling in the script.
    assert "PGPASSWORD" not in PS1


@pytest.mark.be_t("BE-T-106")
def test_setup_ps1_passes_password_only_via_process_env_removed_in_finally() -> None:
    assert "$env:MP_APP_PASSWORD = $appPassword" in PS1
    finally_blocks = re.findall(r"finally\s*\{(.*?)\}", PS1, re.DOTALL)
    assert any("Remove-Item Env:\\MP_APP_PASSWORD" in block for block in finally_blocks)
    # Never on the psql command line.
    psql_lines = [line for line in PS1.splitlines() if line.strip().startswith("& $PsqlPath")]
    assert psql_lines
    assert all("Password" not in line and "MP_APP_PASSWORD" not in line for line in psql_lines)
    # Machine/user-scoped environment writes would persist the secret.
    assert "SetEnvironmentVariable" not in PS1


@pytest.mark.be_t("BE-T-106")
def test_setup_ps1_never_overwrites_env_without_confirmation() -> None:
    assert "already exists. Overwrite it? [y/N]" in PS1
    assert 'Read-Confirmation "Write backend\\.env now? [Y/n]" $true' in PS1


@pytest.mark.be_t("BE-T-106")
def test_setup_sql_is_idempotent_and_least_privilege() -> None:
    assert "\\set ON_ERROR_STOP on" in SQL
    assert "\\getenv app_password MP_APP_PASSWORD" in SQL
    assert SQL.count("\\gexec") >= 3
    assert "WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')" in SQL
    assert "WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = wanted.db)" in SQL
    assert "NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION" in SQL
    assert "TEMPLATE template0" in SQL
    assert "ENCODING %L" in SQL
    assert "'UTF8'" in SQL
    assert "REVOKE CONNECT" in SQL
    assert "FROM PUBLIC" in SQL
    assert SQL.count('ALTER SCHEMA public OWNER TO :"app_role"') == 2
    for database in ("mitali_portfolio", "mitali_portfolio_test"):
        assert f"('{database}')" in SQL
    statements = "\n".join(line for line in SQL.splitlines() if not line.lstrip().startswith("--"))
    upper = statements.upper()
    for forbidden in (" SUPERUSER ", " CREATEDB ", " CREATEROLE ", "REPLICATION PASSWORD"):
        assert forbidden not in upper.replace("NOSUPERUSER", "").replace("NOCREATEDB", "").replace(
            "NOCREATEROLE", ""
        ).replace("NOREPLICATION", "")
    # The password is only ever referenced through the psql variable, never as a literal.
    assert re.search(r"PASSWORD\s+'", SQL) is None
