"""``/api/admin/faqs`` (BE-016, 6 operations). ``/order`` is declared before ``/{id}``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.faq import AdminFaq, FaqInput, FaqOrderRequest
from app.services import faqs as service

router = APIRouter(prefix="/faqs", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
FaqId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminFaqs",
    summary="FAQs ordered by category position then FAQ position",
    response_model=list[AdminFaq],
    status_code=200,
    responses=errors(401, 422),
)
async def list_admin_faqs(session: Db, category_id: Annotated[uuid.UUID | None, Query()] = None) -> list[AdminFaq]:
    return await service.list_faqs(session, category_id=category_id)


@router.post(
    "",
    operation_id="createAdminFaq",
    response_model=AdminFaq,
    status_code=201,
    responses=errors(401, 403, 422),
)
async def create_admin_faq(payload: FaqInput, session: Db) -> AdminFaq:
    return await service.create_faq(session, payload)


@router.put(
    "/order",
    operation_id="reorderAdminFaqs",
    summary="Reorder the FAQs of one category",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404, 422),
)
async def reorder_admin_faqs(payload: FaqOrderRequest, session: Db) -> None:
    await service.reorder_faqs(session, payload.category_id, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminFaq",
    response_model=AdminFaq,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_faq(faq_id: FaqId, session: Db) -> AdminFaq:
    return await service.get_faq(session, faq_id)


@router.put(
    "/{id}",
    operation_id="updateAdminFaq",
    summary="Replace the FAQ (a new category_id moves it to the end of that category)",
    response_model=AdminFaq,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_faq(faq_id: FaqId, payload: FaqInput, session: Db) -> AdminFaq:
    return await service.update_faq(session, faq_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminFaq",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_faq(faq_id: FaqId, session: Db) -> None:
    await service.delete_faq(session, faq_id)
