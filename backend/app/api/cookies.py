"""Session and CSRF cookies (SD-007, SEC-BE-003). Host-only (no ``Domain``), ``SameSite=Strict``, ``Path=/``."""

from __future__ import annotations

from typing import Final

from fastapi import Response

from app.core.config import Settings
from app.services.auth import ABSOLUTE_LIFETIME

SESSION_COOKIE: Final = "mp_session"
CSRF_COOKIE: Final = "mp_csrf"
CSRF_HEADER: Final = "X-CSRF-Token"
SESSION_MAX_AGE: Final = int(ABSOLUTE_LIFETIME.total_seconds())  # 604800


def set_session_cookies(response: Response, settings: Settings, *, session_token: str, csrf_token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        session_token,
        max_age=SESSION_MAX_AGE,
        path="/",
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="strict",
    )
    set_csrf_cookie(response, settings, csrf_token)


def set_csrf_cookie(response: Response, settings: Settings, csrf_token: str) -> None:
    # Readable by the admin app on purpose (double-submit token, SD-007).
    response.set_cookie(
        CSRF_COOKIE, csrf_token, path="/", secure=settings.session_cookie_secure, httponly=False, samesite="strict"
    )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        SESSION_COOKIE, path="/", secure=settings.session_cookie_secure, httponly=True, samesite="strict"
    )
    response.delete_cookie(
        CSRF_COOKIE, path="/", secure=settings.session_cookie_secure, httponly=False, samesite="strict"
    )
