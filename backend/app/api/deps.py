"""Shared FastAPI dependencies (BE-001, BE-009).

``get_current_admin`` and ``require_csrf`` are attached at router level to the protected admin router
(``app/api/routers/admin/__init__.py``), so every admin route except ``adminLogin`` is protected without per-route
code (deny by default, SEC-BE-005).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated, Final

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.cookies import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE
from app.core.config import Settings
from app.services.auth import CurrentAdmin, authenticate, verify_csrf

SAFE_METHODS: Final = frozenset({"GET", "HEAD", "OPTIONS"})


def get_settings_dep(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """One ``AsyncSession`` per request; services own the transaction (``async with session.begin()``)."""
    sessionmaker: async_sessionmaker[AsyncSession] = request.app.state.sessionmaker
    async with sessionmaker() as session:
        yield session


def client_ip(request: Request) -> str:
    """Client address from the socket only. ``X-Forwarded-For`` / ``Forwarded`` are ignored (SEC-BE-008, H-3).

    Never log or store the returned value; rate limiting keys it with an HMAC.
    """
    client = request.client
    return client.host if client is not None else "unknown"


async def get_current_admin(request: Request, session: Annotated[AsyncSession, Depends(get_db)]) -> CurrentAdmin:
    """401 ``unauthenticated`` unless ``mp_session`` names a live session (idle 8 h, absolute 7 d)."""
    return await authenticate(session, request.cookies.get(SESSION_COOKIE))


async def require_csrf(request: Request, current: Annotated[CurrentAdmin, Depends(get_current_admin)]) -> None:
    """403 ``csrf_failed`` for state-changing methods without a valid ``X-CSRF-Token`` (double-submit + session)."""
    if request.method in SAFE_METHODS:
        return
    verify_csrf(current, request.headers.get(CSRF_HEADER), request.cookies.get(CSRF_COOKIE))
