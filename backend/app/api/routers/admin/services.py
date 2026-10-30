"""``/api/admin/services`` (services, BE-015, 6 operations).

``/order`` is declared before ``/{id}``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import OrderRequest
from app.schemas.simple_content import AdminService, ServiceInput
from app.services import simple_content as service
from app.services.simple_content import SERVICES

router = APIRouter(prefix="/services", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
ItemId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminServices",
    response_model=list[AdminService],
    status_code=200,
    responses=errors(401),
)
async def list_admin_services(session: Db) -> list[AdminService]:
    return await service.list_items(session, SERVICES)


@router.post(
    "",
    operation_id="createAdminService",
    response_model=AdminService,
    status_code=201,
    responses=errors(401, 403, 422),
)
async def create_admin_service(payload: ServiceInput, session: Db) -> AdminService:
    return await service.create_item(session, SERVICES, payload)


@router.put(
    "/order",
    operation_id="reorderAdminServices",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_services(payload: OrderRequest, session: Db) -> None:
    await service.reorder_items(session, SERVICES, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminService",
    response_model=AdminService,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_service(item_id: ItemId, session: Db) -> AdminService:
    return await service.get_item(session, SERVICES, item_id)


@router.put(
    "/{id}",
    operation_id="updateAdminService",
    response_model=AdminService,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_service(item_id: ItemId, payload: ServiceInput, session: Db) -> AdminService:
    return await service.update_item(session, SERVICES, item_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminService",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_service(item_id: ItemId, session: Db) -> None:
    await service.delete_item(session, SERVICES, item_id)
