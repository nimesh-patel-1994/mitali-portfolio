"""``/api/admin/process-steps`` (process steps, BE-015, 6 operations).

``/order`` is declared before ``/{id}``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import OrderRequest
from app.schemas.simple_content import AdminProcessStep, ProcessStepInput
from app.services import simple_content as service
from app.services.simple_content import PROCESS_STEPS

router = APIRouter(prefix="/process-steps", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
ItemId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminProcessSteps",
    response_model=list[AdminProcessStep],
    status_code=200,
    responses=errors(401),
)
async def list_admin_process_steps(session: Db) -> list[AdminProcessStep]:
    return await service.list_items(session, PROCESS_STEPS)


@router.post(
    "",
    operation_id="createAdminProcessStep",
    response_model=AdminProcessStep,
    status_code=201,
    responses=errors(401, 403, 422),
)
async def create_admin_process_step(payload: ProcessStepInput, session: Db) -> AdminProcessStep:
    return await service.create_item(session, PROCESS_STEPS, payload)


@router.put(
    "/order",
    operation_id="reorderAdminProcessSteps",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_process_steps(payload: OrderRequest, session: Db) -> None:
    await service.reorder_items(session, PROCESS_STEPS, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminProcessStep",
    response_model=AdminProcessStep,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_process_step(item_id: ItemId, session: Db) -> AdminProcessStep:
    return await service.get_item(session, PROCESS_STEPS, item_id)


@router.put(
    "/{id}",
    operation_id="updateAdminProcessStep",
    response_model=AdminProcessStep,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_process_step(item_id: ItemId, payload: ProcessStepInput, session: Db) -> AdminProcessStep:
    return await service.update_item(session, PROCESS_STEPS, item_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminProcessStep",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_process_step(item_id: ItemId, session: Db) -> None:
    await service.delete_item(session, PROCESS_STEPS, item_id)
