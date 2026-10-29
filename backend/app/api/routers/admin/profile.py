"""``GET/PUT /api/admin/profile`` (``getAdminProfile``, ``updateAdminProfile``, BE-019)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.common import ERROR_RESPONSE
from app.schemas.site import AdminProfile, ProfileInput
from app.services import site as site_service

router = APIRouter(prefix="/profile", tags=["admin-site"])


@router.get(
    "",
    operation_id="getAdminProfile",
    response_model=AdminProfile,
    status_code=200,
    responses={401: {**ERROR_RESPONSE, "description": "No valid session"}},
)
async def get_admin_profile(session: Annotated[AsyncSession, Depends(get_db)]) -> AdminProfile:
    return await site_service.get_profile(session)


@router.put(
    "",
    operation_id="updateAdminProfile",
    response_model=AdminProfile,
    status_code=200,
    responses={
        401: {**ERROR_RESPONSE, "description": "No valid session"},
        403: {**ERROR_RESPONSE, "description": "Missing or wrong X-CSRF-Token"},
        422: {**ERROR_RESPONSE, "description": "Invalid input"},
    },
)
async def update_admin_profile(
    payload: ProfileInput, session: Annotated[AsyncSession, Depends(get_db)]
) -> AdminProfile:
    return await site_service.update_profile(session, payload)
