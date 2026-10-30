"""``/api/admin/faq-categories`` (BE-016, 6 operations). ``/order`` is declared before ``/{id}``.

A duplicate name is answered with 422 ``fields.name`` (backend-scope BQ-1 default); 409 is documented because the
contract lists it (``category_not_empty`` on delete).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import OrderRequest
from app.schemas.faq import AdminFaqCategory, FaqCategoryInput
from app.services import faqs as service

router = APIRouter(prefix="/faq-categories", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
CategoryId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminFaqCategories",
    response_model=list[AdminFaqCategory],
    status_code=200,
    responses=errors(401),
)
async def list_admin_faq_categories(session: Db) -> list[AdminFaqCategory]:
    return await service.list_categories(session)


@router.post(
    "",
    operation_id="createAdminFaqCategory",
    response_model=AdminFaqCategory,
    status_code=201,
    responses=errors(401, 403, 409, 422),
)
async def create_admin_faq_category(payload: FaqCategoryInput, session: Db) -> AdminFaqCategory:
    return await service.create_category(session, payload)


@router.put(
    "/order",
    operation_id="reorderAdminFaqCategories",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_faq_categories(payload: OrderRequest, session: Db) -> None:
    await service.reorder_categories(session, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminFaqCategory",
    response_model=AdminFaqCategory,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_faq_category(category_id: CategoryId, session: Db) -> AdminFaqCategory:
    return await service.get_category(session, category_id)


@router.put(
    "/{id}",
    operation_id="updateAdminFaqCategory",
    response_model=AdminFaqCategory,
    status_code=200,
    responses=errors(401, 403, 404, 409, 422),
)
async def update_admin_faq_category(
    category_id: CategoryId, payload: FaqCategoryInput, session: Db
) -> AdminFaqCategory:
    return await service.update_category(session, category_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminFaqCategory",
    summary="Delete an empty category (409 category_not_empty while it still has FAQs)",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404, 409),
)
async def delete_admin_faq_category(category_id: CategoryId, session: Db) -> None:
    await service.delete_category(session, category_id)
