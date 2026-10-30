"""BE-T-109: README backend section (BE-026), extended for SEC-001 (loopback host) and SEC-008 (no Server header)."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

README = Path(__file__).resolve().parents[3] / "README.md"


def _backend_section() -> str:
    text = README.read_text(encoding="utf-8")
    start = text.index("## Backend")
    end = text.find("\n## ", start + 1)
    return text[start : end if end != -1 else len(text)]


@pytest.mark.be_t("BE-T-109")
def test_readme_backend_section_has_required_commands_in_order() -> None:
    section = _backend_section()
    required = [
        "Python 3.12",
        "5442",
        "setup_db.ps1",
        "uv sync",
        "alembic upgrade head",
        "app.cli create-admin",
        "app.cli seed",
        "--reset",
        "fastapi dev app/main.py",
        "pytest --cov=app",
        "mitali_portfolio_test",
        "SERVE_FRONTEND",
        "app.cli reset-password",
        "pg_dump",
    ]
    position = 0
    for item in required:  # each one appears after the previous one (documented in this order)
        position = section.index(item, position)
    assert re.search(r"pg_dump\.exe\" -h localhost -p 5442 -U mitali_app -Fc", section)
    assert r"C:\Program Files\PostgreSQL\17\bin" in section
    assert "Docker" in section


@pytest.mark.be_t("BE-T-109")
@pytest.mark.sec("SEC-001")
def test_readme_preview_binds_loopback_without_server_header() -> None:
    section = _backend_section()
    launch_lines = [line for line in section.splitlines() if re.search(r"uv run (uvicorn|fastapi run)", line)]
    assert launch_lines
    assert all("--host 127.0.0.1" in line for line in launch_lines)
    assert any("--no-server-header" in line for line in launch_lines)
    assert "0.0.0.0" in section  # noqa: S104 - checks that the README warns about the default binding


@pytest.mark.be_t("BE-T-109")
@pytest.mark.sec("SEC-003")
def test_readme_contains_no_credentials() -> None:
    text = README.read_text(encoding="utf-8")
    assert not re.search(r"postgresql(\+asyncpg)?://[^:\s]+:[^@\s]+@", text)
    assert not re.search(r"(?i)(password|secret|token)\s*[=:]\s*\S{6,}", text)
    assert not re.search(r"(?i)HASH_KEY_SECRET\s*=", text)
