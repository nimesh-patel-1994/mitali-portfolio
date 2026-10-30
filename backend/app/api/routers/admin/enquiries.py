"""``/api/admin/enquiries`` (BE-020, TS-014): list (paginated, newest first), get, status PATCH, hard delete."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import PageParams
from app.schemas.enquiry import Enquiry, EnquiryPage, EnquiryStatusUpdate
from app.schemas.enums import EnquiryStatus
from app.services import enquiries as service

router = APIRouter(prefix="/enquiries", tags=["admin-enquiries"])

Db = Annotated[AsyncSession, Depends(get_db)]
EnquiryId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminEnquiries",
    summary="Enquiries, newest first, optionally filtered by status (paginated)",
    response_model=EnquiryPage,
    status_code=200,
    responses=errors(401, 422),
)
async def list_admin_enquiries(
    session: Db,
    params: Annotated[PageParams, Depends()],
    status: Annotated[EnquiryStatus | None, Query()] = None,
) -> EnquiryPage:
    return await service.list_enquiries(session, status=status, params=params)


@router.get(
    "/{id}",
    operation_id="getAdminEnquiry",
    response_model=Enquiry,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_enquiry(enquiry_id: EnquiryId, session: Db) -> Enquiry:
    return await service.get_enquiry(session, enquiry_id)


@router.patch(
    "/{id}",
    operation_id="updateAdminEnquiryStatus",
    response_model=Enquiry,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_enquiry_status(enquiry_id: EnquiryId, payload: EnquiryStatusUpdate, session: Db) -> Enquiry:
    return await service.update_status(session, enquiry_id, payload.status)


@router.delete(
    "/{id}",
    operation_id="deleteAdminEnquiry",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_enquiry(enquiry_id: EnquiryId, session: Db) -> None:
    await service.delete_enquiry(session, enquiry_id)
