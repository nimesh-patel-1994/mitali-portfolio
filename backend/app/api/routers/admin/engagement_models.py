"""``/api/admin/engagement-models`` (engagement models, BE-015, 6 operations).

``/order`` is declared before ``/{id}``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import OrderRequest
from app.schemas.simple_content import AdminEngagementModel, EngagementModelInput
from app.services import simple_content as service
from app.services.simple_content import ENGAGEMENT_MODELS

router = APIRouter(prefix="/engagement-models", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
ItemId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminEngagementModels",
    response_model=list[AdminEngagementModel],
    status_code=200,
    responses=errors(401),
)
async def list_admin_engagement_models(session: Db) -> list[AdminEngagementModel]:
    return await service.list_items(session, ENGAGEMENT_MODELS)


@router.post(
    "",
    operation_id="createAdminEngagementModel",
    response_model=AdminEngagementModel,
    status_code=201,
    responses=errors(401, 403, 422),
)
async def create_admin_engagement_model(payload: EngagementModelInput, session: Db) -> AdminEngagementModel:
    return await service.create_item(session, ENGAGEMENT_MODELS, payload)


@router.put(
    "/order",
    operation_id="reorderAdminEngagementModels",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_engagement_models(payload: OrderRequest, session: Db) -> None:
    await service.reorder_items(session, ENGAGEMENT_MODELS, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminEngagementModel",
    response_model=AdminEngagementModel,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_engagement_model(item_id: ItemId, session: Db) -> AdminEngagementModel:
    return await service.get_item(session, ENGAGEMENT_MODELS, item_id)


@router.put(
    "/{id}",
    operation_id="updateAdminEngagementModel",
    response_model=AdminEngagementModel,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_engagement_model(
    item_id: ItemId, payload: EngagementModelInput, session: Db
) -> AdminEngagementModel:
    return await service.update_item(session, ENGAGEMENT_MODELS, item_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminEngagementModel",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_engagement_model(item_id: ItemId, session: Db) -> None:
    await service.delete_item(session, ENGAGEMENT_MODELS, item_id)
