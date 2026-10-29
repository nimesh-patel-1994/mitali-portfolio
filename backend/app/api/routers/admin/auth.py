"""Admin auth routes (BE-008): ``adminLogin`` (public router), ``adminLogout`` and ``getAdminMe`` (protected)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.cookies import CSRF_COOKIE, clear_session_cookies, set_csrf_cookie, set_session_cookies
from app.api.deps import client_ip, get_current_admin, get_db, get_settings_dep
from app.core.config import Settings
from app.schemas.auth import AdminSession, LoginRequest
from app.schemas.common import ERROR_RESPONSE
from app.services import auth as auth_service
from app.services.auth import CurrentAdmin

# Mounted without the session dependency: the only admin route that works without a session.
login_router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

# Included into the protected admin router (session + CSRF at router level).
router = APIRouter(prefix="/auth", tags=["admin-auth"])


@login_router.post(
    "/login",
    operation_id="adminLogin",
    summary="Log in; sets mp_session (HttpOnly) and mp_csrf cookies",
    response_model=AdminSession,
    status_code=200,
    responses={
        401: {**ERROR_RESPONSE, "description": "Wrong email or password (code invalid_credentials)"},
        403: {**ERROR_RESPONSE, "description": "Disallowed Origin (code origin_rejected)"},
        422: {**ERROR_RESPONSE, "description": "Invalid input"},
        429: {**ERROR_RESPONSE, "description": "Login blocked for 15 minutes after 5 failures"},
    },
)
async def admin_login(
    payload: LoginRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    ip: Annotated[str, Depends(client_ip)],
) -> AdminSession:
    result = await auth_service.login(
        session, email=payload.email, password=payload.password, client_ip=ip, hash_secret=settings.hash_key_secret
    )
    set_session_cookies(response, settings, session_token=result.session_token, csrf_token=result.csrf_token)
    return result.admin_session


@router.post(
    "/logout",
    operation_id="adminLogout",
    summary="End the session and clear cookies",
    status_code=204,
    response_class=Response,
    responses={
        401: {**ERROR_RESPONSE, "description": "No valid session"},
        403: {**ERROR_RESPONSE, "description": "Missing or wrong X-CSRF-Token"},
    },
)
async def admin_logout(
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    current: Annotated[CurrentAdmin, Depends(get_current_admin)],
) -> Response:
    await auth_service.logout(session, current)
    response = Response(status_code=204)
    clear_session_cookies(response, settings)
    return response


@router.get(
    "/me",
    operation_id="getAdminMe",
    summary="Current session (also returns the CSRF token for the in-memory store)",
    response_model=AdminSession,
    status_code=200,
    responses={401: {**ERROR_RESPONSE, "description": "No valid session"}},
)
async def get_admin_me(
    request: Request,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    current: Annotated[CurrentAdmin, Depends(get_current_admin)],
) -> AdminSession:
    admin_session, rotated = await auth_service.describe_session(session, current, request.cookies.get(CSRF_COOKIE))
    if rotated is not None:
        set_csrf_cookie(response, settings, rotated)
    return admin_session
