"""Application settings (TS-001, SEC-003).

This is the only module that reads the process environment or ``backend/.env``. Everything else receives a
``Settings`` instance (``app.state.settings`` or the ``get_settings()`` cache).
"""

from __future__ import annotations

import enum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

# Values that mark an unedited placeholder from .env.example; startup refuses them for secrets (SEC-003).
PLACEHOLDER_MARKERS = ("change_me", "changeme", "placeholder", "<", ">")
MIN_HASH_KEY_SECRET_LENGTH = 32


class AppEnv(enum.StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class LogLevel(enum.StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class ConfigError(RuntimeError):
    """Raised when the configuration is missing or invalid. The message never contains secret values."""


def _is_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def _normalise_origin(raw: str) -> str:
    """Return ``scheme://host[:port]`` in lower case, without default ports; raise ValueError when invalid."""
    value = raw.strip()
    if value in {"*", "null"} or not value:
        raise ValueError(f"'{value or '<empty>'}' is not allowed; list exact scheme://host:port origins")
    parts = urlsplit(value)
    if parts.scheme not in {"http", "https"} or not parts.hostname:
        raise ValueError(f"'{value}' must be an absolute http(s) origin such as http://localhost:5173")
    if parts.username or parts.password or parts.path not in {"", "/"} or parts.query or parts.fragment:
        raise ValueError(f"'{value}' must be an origin only (no user info, path, query or fragment)")
    if "*" in value:
        raise ValueError(f"'{value}' must not contain wildcards")
    return origin_of(parts.scheme, parts.hostname, parts.port)


def origin_of(scheme: str, hostname: str, port: int | None) -> str:
    """Canonical origin string used for exact comparison (Origin check, SEC-BE-004)."""
    scheme = scheme.lower()
    host = hostname.lower()
    if ":" in host:  # IPv6 literal
        host = f"[{host}]"
    default_port = {"http": 80, "https": 443}.get(scheme)
    if port is None or port == default_port:
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


def _check_database_url(value: SecretStr, key: str) -> URL:
    try:
        url = make_url(value.get_secret_value())
    except ArgumentError:
        raise ValueError(f"{key} is not a valid database URL") from None
    if url.drivername != "postgresql+asyncpg":
        raise ValueError(f"{key} must use the 'postgresql+asyncpg://' scheme")
    if not url.host or not url.database:
        raise ValueError(f"{key} must name a host and a database")
    return url


class Settings(BaseSettings):
    """Every key of TS-001. Secrets are ``SecretStr`` and never appear in ``repr`` or error messages."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        hide_input_in_errors=True,
    )

    app_env: AppEnv = AppEnv.DEVELOPMENT
    database_url: SecretStr
    test_database_url: SecretStr | None = None
    media_root: Path = Path("media")
    frontend_dist_dir: Path = Path("../frontend/dist")
    serve_frontend: bool = False
    allowed_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:8000", "http://127.0.0.1:8000"]
    )
    session_cookie_secure: bool = False
    hash_key_secret: SecretStr
    log_level: LogLevel = LogLevel.INFO

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [item for item in (part.strip() for part in value.split(",")) if item]
        return value

    @field_validator("allowed_origins")
    @classmethod
    def _validate_origins(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("at least one origin is required")
        return list(dict.fromkeys(_normalise_origin(item) for item in value))

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper_log_level(cls, value: Any) -> Any:
        return value.upper() if isinstance(value, str) else value

    @field_validator("database_url")
    @classmethod
    def _validate_database_url(cls, value: SecretStr) -> SecretStr:
        _check_database_url(value, "DATABASE_URL")
        return value

    @field_validator("test_database_url")
    @classmethod
    def _validate_test_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and value.get_secret_value().strip():
            _check_database_url(value, "TEST_DATABASE_URL")
            return value
        return None

    @field_validator("hash_key_secret")
    @classmethod
    def _validate_hash_key_secret(cls, value: SecretStr) -> SecretStr:
        secret = value.get_secret_value()
        if len(secret) < MIN_HASH_KEY_SECRET_LENGTH:
            raise ValueError(f"must be at least {MIN_HASH_KEY_SECRET_LENGTH} characters of random data")
        if _is_placeholder(secret):
            raise ValueError("still holds the placeholder from .env.example; generate a random value")
        return value

    @model_validator(mode="after")
    def _production_guards(self) -> Settings:
        if self.app_env is AppEnv.PRODUCTION and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE must be true when APP_ENV=production (SEC-BE-003)")
        return self

    # ------------------------------------------------------------------ derived values
    @property
    def is_development(self) -> bool:
        return self.app_env is AppEnv.DEVELOPMENT

    @property
    def media_root_path(self) -> Path:
        """``MEDIA_ROOT`` resolved; relative values are relative to the ``backend/`` folder."""
        return _resolve_from_backend(self.media_root)

    @property
    def frontend_dist_path(self) -> Path:
        return _resolve_from_backend(self.frontend_dist_dir)

    @property
    def allowed_hosts(self) -> list[str]:
        """Host names for the Host-header allow-list (SEC-BE-016), derived from ``ALLOWED_ORIGINS``."""
        hosts: list[str] = []
        for origin in self.allowed_origins:
            hostname = urlsplit(origin).hostname
            if hostname and hostname not in hosts:
                hosts.append(hostname)
        return hosts

    def database_location(self, *, test: bool = False) -> str:
        """``host:port`` of the configured database, safe to show in messages (no credentials)."""
        secret = self.test_database_url if test else self.database_url
        if secret is None:
            return "<not configured>"
        url = make_url(secret.get_secret_value())
        return f"{url.host}:{url.port or 5432}"


def _resolve_from_backend(path: Path) -> Path:
    return (path if path.is_absolute() else BACKEND_DIR / path).resolve()


def _format_validation_error(exc: ValidationError) -> str:
    problems: list[str] = []
    for error in exc.errors(include_input=False, include_url=False):
        location = ".".join(str(part) for part in error["loc"]) or "settings"
        key = location.split(".")[0].upper()
        message = str(error["msg"])
        if error["type"] == "missing":
            message = "is required but not set"
        problems.append(f"{key} {message}")
    return "Invalid configuration in backend/.env or the environment: " + "; ".join(problems)


def load_settings(**overrides: Any) -> Settings:
    """Build ``Settings`` and turn validation errors into one clear ``ConfigError`` without secret values."""
    try:
        return Settings(**overrides)
    except ValidationError as exc:
        raise ConfigError(_format_validation_error(exc)) from None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
