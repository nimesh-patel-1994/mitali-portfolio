"""``/api/admin/values`` (values; stored in table ``core_values``, BE-015, 6 operations).

``/order`` is declared before ``/{id}``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import OrderRequest
from app.schemas.simple_content import AdminCoreValue, CoreValueInput
from app.services import simple_content as service
from app.services.simple_content import VALUES

router = APIRouter(prefix="/values", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
ItemId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminValues",
    response_model=list[AdminCoreValue],
    status_code=200,
    responses=errors(401),
)
async def list_admin_values(session: Db) -> list[AdminCoreValue]:
    return await service.list_items(session, VALUES)


@router.post(
    "",
    operation_id="createAdminValue",
    response_model=AdminCoreValue,
    status_code=201,
    responses=errors(401, 403, 422),
)
async def create_admin_value(payload: CoreValueInput, session: Db) -> AdminCoreValue:
    return await service.create_item(session, VALUES, payload)


@router.put(
    "/order",
    operation_id="reorderAdminValues",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_values(payload: OrderRequest, session: Db) -> None:
    await service.reorder_items(session, VALUES, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminValue",
    response_model=AdminCoreValue,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_value(item_id: ItemId, session: Db) -> AdminCoreValue:
    return await service.get_item(session, VALUES, item_id)


@router.put(
    "/{id}",
    operation_id="updateAdminValue",
    response_model=AdminCoreValue,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_value(item_id: ItemId, payload: CoreValueInput, session: Db) -> AdminCoreValue:
    return await service.update_item(session, VALUES, item_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminValue",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_value(item_id: ItemId, session: Db) -> None:
    await service.delete_item(session, VALUES, item_id)
