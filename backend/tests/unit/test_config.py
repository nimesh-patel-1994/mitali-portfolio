"""Settings tests: BE-T-001, BE-T-002, BE-T-004 and SEC-003 / SEC-BE-003 / SEC-BE-004 configuration checks."""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from pydantic import SecretStr

from app.core.config import AppEnv, ConfigError, Settings, load_settings
from tests.harness import BACKEND_DIR, DUMMY_DATABASE_URL, DUMMY_HASH_KEY_SECRET

ENV_KEYS = [name.upper() for name in Settings.model_fields]
SECRET_DB_PASSWORD = "Sup3r-Secret-Db-Pw"
SECRET_HASH_KEY = "x9-very-secret-hash-key-material-0123456789"


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


@pytest.mark.be_t("BE-T-001")
def test_settings_all_keys_present_values_parsed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DATABASE_URL", f"postgresql+asyncpg://mitali_app:{SECRET_DB_PASSWORD}@localhost:5442/mp")
    monkeypatch.setenv("TEST_DATABASE_URL", "postgresql+asyncpg://mitali_app:pw@localhost:5442/mp_test")
    monkeypatch.setenv("MEDIA_ROOT", "media")
    monkeypatch.setenv("FRONTEND_DIST_DIR", "../frontend/dist")
    monkeypatch.setenv("SERVE_FRONTEND", "true")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173, http://127.0.0.1:8000,HTTP://LOCALHOST:8000")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("HASH_KEY_SECRET", SECRET_HASH_KEY)
    monkeypatch.setenv("LOG_LEVEL", "warning")

    settings = load_settings(_env_file=None)

    assert settings.app_env is AppEnv.DEVELOPMENT
    assert settings.allowed_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]
    assert settings.serve_frontend is True
    assert settings.session_cookie_secure is False
    assert isinstance(settings.database_url, SecretStr)
    assert isinstance(settings.test_database_url, SecretStr)
    assert isinstance(settings.hash_key_secret, SecretStr)
    assert settings.log_level.value == "WARNING"
    assert settings.media_root_path == (BACKEND_DIR / "media").resolve()
    assert settings.allowed_hosts == ["localhost", "127.0.0.1"]
    assert settings.database_location() == "localhost:5442"
    # Secrets never show up in repr/str.
    assert SECRET_DB_PASSWORD not in repr(settings)
    assert SECRET_HASH_KEY not in repr(settings)


@pytest.mark.be_t("BE-T-002")
def test_settings_missing_database_url_raises_clear_error_without_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("HASH_KEY_SECRET", SECRET_HASH_KEY)
    with pytest.raises(ConfigError) as caught:
        load_settings(_env_file=None)
    message = str(caught.value)
    assert "DATABASE_URL is required but not set" in message
    assert SECRET_HASH_KEY not in message
    assert caught.value.__cause__ is None
    assert caught.value.__suppress_context__


@pytest.mark.be_t("BE-T-002")
def test_settings_unknown_app_env_names_the_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("DATABASE_URL", f"postgresql+asyncpg://u:{SECRET_DB_PASSWORD}@localhost:5442/mp")
    monkeypatch.setenv("HASH_KEY_SECRET", SECRET_HASH_KEY)
    with pytest.raises(ConfigError) as caught:
        load_settings(_env_file=None)
    message = str(caught.value)
    assert message.count("APP_ENV") == 1
    assert "staging" not in message
    assert SECRET_DB_PASSWORD not in message
    assert SECRET_HASH_KEY not in message


@pytest.mark.be_t("BE-T-002")
def test_settings_wrong_database_driver_rejected_without_echoing_url() -> None:
    with pytest.raises(ConfigError) as caught:
        load_settings(
            _env_file=None,
            database_url=f"postgresql://u:{SECRET_DB_PASSWORD}@localhost:5442/mp",
            hash_key_secret=SECRET_HASH_KEY,
        )
    assert "DATABASE_URL must use the 'postgresql+asyncpg://' scheme" in str(caught.value)
    assert SECRET_DB_PASSWORD not in str(caught.value)


@pytest.mark.sec("SEC-003")
@pytest.mark.parametrize(
    "secret",
    ["short-secret", "CHANGE_ME_generate_a_random_value_of_at_least_32_chars", "x" * 31],
)
def test_settings_short_or_placeholder_hash_key_secret_rejected(secret: str) -> None:
    with pytest.raises(ConfigError) as caught:
        load_settings(_env_file=None, database_url=DUMMY_DATABASE_URL, hash_key_secret=secret)
    assert "HASH_KEY_SECRET" in str(caught.value)
    assert secret not in str(caught.value)


@pytest.mark.sec("SEC-BE-003")
def test_settings_production_without_secure_cookie_rejected() -> None:
    with pytest.raises(ConfigError, match="SESSION_COOKIE_SECURE must be true when APP_ENV=production"):
        load_settings(
            _env_file=None,
            app_env="production",
            session_cookie_secure=False,
            database_url=DUMMY_DATABASE_URL,
            hash_key_secret=DUMMY_HASH_KEY_SECRET,
        )
    allowed = load_settings(
        _env_file=None,
        app_env="production",
        session_cookie_secure=True,
        database_url=DUMMY_DATABASE_URL,
        hash_key_secret=DUMMY_HASH_KEY_SECRET,
    )
    assert allowed.app_env is AppEnv.PRODUCTION


@pytest.mark.sec("SEC-BE-004")
@pytest.mark.parametrize(
    "origins",
    [
        "*",
        "null",
        "http://localhost:5173,*",
        "localhost:5173",
        "http://localhost:5173/path",
        "ftp://localhost",
        "http://user:pw@localhost:5173",
        "http://*.example.com",
    ],
)
def test_settings_allowed_origins_rejects_wildcards_and_non_origins(origins: str) -> None:
    with pytest.raises(ConfigError, match="ALLOWED_ORIGINS"):
        load_settings(
            _env_file=None,
            allowed_origins=origins,
            database_url=DUMMY_DATABASE_URL,
            hash_key_secret=DUMMY_HASH_KEY_SECRET,
        )


def _env_example_entries() -> dict[str, str]:
    entries: dict[str, str] = {}
    for line in (BACKEND_DIR / ".env.example").read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        key, _, value = stripped.partition("=")
        entries[key.strip()] = value.strip()
    return entries


@pytest.mark.be_t("BE-T-004")
def test_env_example_keys_match_settings_and_hold_placeholders_only() -> None:
    entries = _env_example_entries()
    assert set(entries) == set(ENV_KEYS)

    for key in ("DATABASE_URL", "TEST_DATABASE_URL"):
        password = re.match(r"^[^:]+://[^:]+:([^@]*)@", entries[key])
        assert password is not None, key
        assert password.group(1) == "CHANGE_ME", f"{key} must hold the CHANGE_ME placeholder password"
        assert ":5442/" in entries[key]
    assert entries["HASH_KEY_SECRET"].startswith("CHANGE_ME")
    assert entries["APP_ENV"] == "development"
    assert entries["SESSION_COOKIE_SECURE"] == "false"

    # The example file as-is must be refused (placeholder secret), so it can never run unedited.
    with pytest.raises(ConfigError, match="HASH_KEY_SECRET"):
        load_settings(_env_file=BACKEND_DIR / ".env.example")


@pytest.mark.sec("SEC-003")
def test_env_file_is_git_ignored() -> None:
    gitignore = (BACKEND_DIR.parent / ".gitignore").read_text(encoding="utf-8").splitlines()
    for pattern in (
        ".env",
        "!.env.example",
        "*.dump",
        "*.backup",
        "backend/media/uploads/",
        "backend/media/seed/",
    ):
        assert pattern in gitignore, pattern


def test_settings_module_is_the_only_environment_reader() -> None:
    offenders = []
    for path in Path(BACKEND_DIR / "app").rglob("*.py"):
        if path.name == "config.py" and path.parent.name == "core":
            continue
        source = path.read_text(encoding="utf-8")
        if "os.environ" in source or "getenv(" in source:
            offenders.append(str(path.relative_to(BACKEND_DIR)))
    assert offenders == []
