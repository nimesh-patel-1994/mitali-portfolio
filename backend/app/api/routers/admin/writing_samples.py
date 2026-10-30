"""``/api/admin/writing-samples`` (BE-014, 6 operations). ``/order`` is declared before ``/{id}``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.common import OrderRequest
from app.schemas.enums import WritingFormat
from app.schemas.writing_sample import AdminWritingSample, AdminWritingSampleListItem, WritingSampleInput
from app.services import writing_samples as service

router = APIRouter(prefix="/writing-samples", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
SampleId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminWritingSamples",
    response_model=list[AdminWritingSampleListItem],
    status_code=200,
    responses=errors(401, 422),
)
async def list_admin_writing_samples(
    session: Db, writing_format: Annotated[WritingFormat | None, Query(alias="format")] = None
) -> list[AdminWritingSampleListItem]:
    return await service.list_writing_samples(session, writing_format=writing_format)


@router.post(
    "",
    operation_id="createAdminWritingSample",
    response_model=AdminWritingSample,
    status_code=201,
    responses=errors(401, 403, 409, 422),
)
async def create_admin_writing_sample(payload: WritingSampleInput, session: Db) -> AdminWritingSample:
    return await service.create_writing_sample(session, payload)


@router.put(
    "/order",
    operation_id="reorderAdminWritingSamples",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_writing_samples(payload: OrderRequest, session: Db) -> None:
    await service.reorder_writing_samples(session, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminWritingSample",
    response_model=AdminWritingSample,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_writing_sample(sample_id: SampleId, session: Db) -> AdminWritingSample:
    return await service.get_writing_sample(session, sample_id)


@router.put(
    "/{id}",
    operation_id="updateAdminWritingSample",
    response_model=AdminWritingSample,
    status_code=200,
    responses=errors(401, 403, 404, 409, 422),
)
async def update_admin_writing_sample(
    sample_id: SampleId, payload: WritingSampleInput, session: Db
) -> AdminWritingSample:
    return await service.update_writing_sample(session, sample_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminWritingSample",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_writing_sample(sample_id: SampleId, session: Db) -> None:
    await service.delete_writing_sample(session, sample_id)
