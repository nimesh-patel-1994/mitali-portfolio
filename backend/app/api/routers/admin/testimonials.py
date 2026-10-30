"""``/api/admin/testimonials`` (testimonials, BE-015, 6 operations).

``/order`` is declared before ``/{id}``.

``case_study_id`` must reference an existing case study (422 ``fields.case_study_id``) or be null."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import OrderRequest
from app.schemas.simple_content import AdminTestimonial, TestimonialInput
from app.services import simple_content as service
from app.services.simple_content import TESTIMONIALS

router = APIRouter(prefix="/testimonials", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
ItemId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminTestimonials",
    response_model=list[AdminTestimonial],
    status_code=200,
    responses=errors(401),
)
async def list_admin_testimonials(session: Db) -> list[AdminTestimonial]:
    return await service.list_items(session, TESTIMONIALS)


@router.post(
    "",
    operation_id="createAdminTestimonial",
    response_model=AdminTestimonial,
    status_code=201,
    responses=errors(401, 403, 422),
)
async def create_admin_testimonial(payload: TestimonialInput, session: Db) -> AdminTestimonial:
    return await service.create_item(session, TESTIMONIALS, payload)


@router.put(
    "/order",
    operation_id="reorderAdminTestimonials",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_testimonials(payload: OrderRequest, session: Db) -> None:
    await service.reorder_items(session, TESTIMONIALS, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminTestimonial",
    response_model=AdminTestimonial,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_testimonial(item_id: ItemId, session: Db) -> AdminTestimonial:
    return await service.get_item(session, TESTIMONIALS, item_id)


@router.put(
    "/{id}",
    operation_id="updateAdminTestimonial",
    response_model=AdminTestimonial,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_testimonial(item_id: ItemId, payload: TestimonialInput, session: Db) -> AdminTestimonial:
    return await service.update_item(session, TESTIMONIALS, item_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminTestimonial",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_testimonial(item_id: ItemId, session: Db) -> None:
    await service.delete_item(session, TESTIMONIALS, item_id)
