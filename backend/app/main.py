"""Application factory (TS-003 point 1).

``create_app(settings)`` wires routers, exception handlers, middleware and static mounts. The ASGI entry point
``app.main:app`` (used by ``fastapi dev app/main.py`` / ``uvicorn``) is created lazily on first access, so importing
this module (tests, scripts) has no side effects and needs no ``.env``.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routers.admin import login_router, protected_router
from app.api.routers.public import PUBLIC_ROUTERS
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.frontend import install_frontend
from app.core.headers import SecurityHeadersMiddleware
from app.core.limits import BodySizeLimitMiddleware
from app.core.logging import configure_logging
from app.core.middleware import CatchAllMiddleware, OriginCheckMiddleware, RequestContextMiddleware
from app.core.static import MediaFiles
from app.db import DatabaseUnreachableError, create_engine, create_sessionmaker, verify_connection

logger = logging.getLogger(__name__)

API_TITLE = "mitali-portfolio API"
API_VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    try:
        await verify_connection(app.state.engine, settings.database_location())
    except DatabaseUnreachableError as exc:
        # Fail fast with one clear line; the message holds host:port only, never credentials (BE-001).
        logger.critical("startup.failed", extra={"fields": {"reason": str(exc)}})
        await app.state.engine.dispose()
        raise
    logger.info("startup.ready", extra={"fields": {"app_env": settings.app_env.value}})
    try:
        yield
    finally:
        await app.state.engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level.value)

    docs_enabled = settings.is_development  # SEC-006: /docs, /redoc, /openapi.json only in development
    app = FastAPI(
        title=API_TITLE,
        version=API_VERSION,
        debug=False,
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
        separate_input_output_schemas=False,
    )
    app.state.settings = settings
    app.state.engine = create_engine(settings.database_url)
    app.state.sessionmaker = create_sessionmaker(app.state.engine)

    register_exception_handlers(app)

    # Routers (public, then admin); the frontend catch-all of BE-022 is added after the /media mount.
    for router in PUBLIC_ROUTERS:
        app.include_router(router)
    app.include_router(login_router)
    app.include_router(protected_router)

    media_root = settings.media_root_path
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount("/media", MediaFiles(directory=str(media_root)), name="media")

    # Production-like preview only (BE-022): registered last so API routes and /media always take precedence.
    if settings.serve_frontend:
        install_frontend(app, settings.frontend_dist_path)

    # Middleware, innermost first (Starlette wraps each new one around the previous ones):
    # request context -> security headers -> host check -> body size -> origin check -> catch-all -> routes.
    app.add_middleware(CatchAllMiddleware)
    app.add_middleware(OriginCheckMiddleware, allowed_origins=settings.allowed_origins)
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware)

    app.openapi = _openapi_factory(app)  # type: ignore[method-assign]
    return app


def _openapi_factory(app: FastAPI) -> Any:
    """Generated schema without FastAPI's automatic 422 ``HTTPValidationError`` entries.

    The app answers validation errors with the contract's ``Error`` envelope, so routes declare 422 explicitly where
    the contract lists it; the automatic entries would only make ``scripts/check_contract.py`` report false drift.
    """
    original = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is not None:
            return app.openapi_schema
        schema = original()
        for path_item in schema.get("paths", {}).values():
            for operation in path_item.values():
                if not isinstance(operation, dict):
                    continue
                response = operation.get("responses", {}).get("422")
                if response is not None and "HTTPValidationError" in str(response):
                    del operation["responses"]["422"]
        component_schemas = schema.get("components", {}).get("schemas", {})
        for name in ("HTTPValidationError", "ValidationError"):
            component_schemas.pop(name, None)
        app.openapi_schema = schema
        return schema

    return openapi


_app: FastAPI | None = None


def __getattr__(name: str) -> Any:
    if name == "app":
        global _app
        if _app is None:
            _app = create_app()
        return _app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted([*globals(), "app"])
