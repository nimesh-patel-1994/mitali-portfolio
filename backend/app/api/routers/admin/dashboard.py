"""``GET /api/admin/dashboard`` (``getAdminDashboard``, BE-021)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_settings_dep
from app.api.responses import errors
from app.core.config import Settings
from app.schemas.dashboard import Dashboard
from app.services import dashboard as service

router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


@router.get(
    "",
    operation_id="getAdminDashboard",
    response_model=Dashboard,
    status_code=200,
    responses=errors(401),
)
async def get_admin_dashboard(
    session: Annotated[AsyncSession, Depends(get_db)], settings: Annotated[Settings, Depends(get_settings_dep)]
) -> Dashboard:
    return await service.get_dashboard(session, dist_dir=settings.frontend_dist_path)
