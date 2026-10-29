"""``GET/PUT /api/admin/settings`` (``getAdminSettings``, ``updateAdminSettings``, BE-019)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.common import ERROR_RESPONSE
from app.schemas.site import AdminSettings, SettingsInput
from app.services import site as site_service

router = APIRouter(prefix="/settings", tags=["admin-site"])


@router.get(
    "",
    operation_id="getAdminSettings",
    response_model=AdminSettings,
    status_code=200,
    responses={401: {**ERROR_RESPONSE, "description": "No valid session"}},
)
async def get_admin_settings(session: Annotated[AsyncSession, Depends(get_db)]) -> AdminSettings:
    return await site_service.get_settings(session)


@router.put(
    "",
    operation_id="updateAdminSettings",
    response_model=AdminSettings,
    status_code=200,
    responses={
        401: {**ERROR_RESPONSE, "description": "No valid session"},
        403: {**ERROR_RESPONSE, "description": "Missing or wrong X-CSRF-Token"},
        422: {**ERROR_RESPONSE, "description": "Invalid input"},
    },
)
async def update_admin_settings(
    payload: SettingsInput, session: Annotated[AsyncSession, Depends(get_db)]
) -> AdminSettings:
    return await site_service.update_settings(session, payload)
