"""``/api/admin/case-studies`` with nested ``results`` and ``images`` (BE-013, 14 operations).

Thin: one service call per route. ``/order`` routes are declared before the ``/{id}`` and ``/{itemId}`` routes.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.responses import errors
from app.schemas.case_study import (
    AdminCaseStudy,
    AdminCaseStudyImage,
    AdminCaseStudyListItem,
    AdminCaseStudyResult,
    CaseStudyImageInput,
    CaseStudyInput,
    CaseStudyResultInput,
)
from app.schemas.common import OrderRequest
from app.services import case_studies as service

router = APIRouter(prefix="/case-studies", tags=["admin-content"])

Db = Annotated[AsyncSession, Depends(get_db)]
CaseStudyId = Annotated[uuid.UUID, Path(alias="id")]
ItemId = Annotated[uuid.UUID, Path(alias="itemId")]


@router.get(
    "",
    operation_id="listAdminCaseStudies",
    summary="All case studies (published and unpublished) in display order",
    response_model=list[AdminCaseStudyListItem],
    status_code=200,
    responses=errors(401),
)
async def list_admin_case_studies(session: Db) -> list[AdminCaseStudyListItem]:
    return await service.list_case_studies(session)


@router.post(
    "",
    operation_id="createAdminCaseStudy",
    response_model=AdminCaseStudy,
    status_code=201,
    responses=errors(401, 403, 409, 422),
)
async def create_admin_case_study(payload: CaseStudyInput, session: Db) -> AdminCaseStudy:
    return await service.create_case_study(session, payload)


@router.put(
    "/order",
    operation_id="reorderAdminCaseStudies",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 422),
)
async def reorder_admin_case_studies(payload: OrderRequest, session: Db) -> None:
    await service.reorder_case_studies(session, payload.ids)


@router.get(
    "/{id}",
    operation_id="getAdminCaseStudy",
    summary="Case study with its results and gallery images",
    response_model=AdminCaseStudy,
    status_code=200,
    responses=errors(401, 404),
)
async def get_admin_case_study(case_study_id: CaseStudyId, session: Db) -> AdminCaseStudy:
    return await service.get_case_study(session, case_study_id)


@router.put(
    "/{id}",
    operation_id="updateAdminCaseStudy",
    summary="Replace the editable fields (includes is_published, is_featured, is_sample)",
    response_model=AdminCaseStudy,
    status_code=200,
    responses=errors(401, 403, 404, 409, 422),
)
async def update_admin_case_study(case_study_id: CaseStudyId, payload: CaseStudyInput, session: Db) -> AdminCaseStudy:
    return await service.update_case_study(session, case_study_id, payload)


@router.delete(
    "/{id}",
    operation_id="deleteAdminCaseStudy",
    summary="Delete the case study with its results and gallery entries",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_case_study(case_study_id: CaseStudyId, session: Db) -> None:
    await service.delete_case_study(session, case_study_id)


# ---------------------------------------------------------------------------------------------- results


@router.post(
    "/{id}/results",
    operation_id="createAdminCaseStudyResult",
    response_model=AdminCaseStudyResult,
    status_code=201,
    responses=errors(401, 403, 404, 422),
)
async def create_admin_case_study_result(
    case_study_id: CaseStudyId, payload: CaseStudyResultInput, session: Db
) -> AdminCaseStudyResult:
    return await service.create_result(session, case_study_id, payload)


@router.put(
    "/{id}/results/order",
    operation_id="reorderAdminCaseStudyResults",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404, 422),
)
async def reorder_admin_case_study_results(case_study_id: CaseStudyId, payload: OrderRequest, session: Db) -> None:
    await service.reorder_results(session, case_study_id, payload.ids)


@router.put(
    "/{id}/results/{itemId}",
    operation_id="updateAdminCaseStudyResult",
    response_model=AdminCaseStudyResult,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_case_study_result(
    case_study_id: CaseStudyId, item_id: ItemId, payload: CaseStudyResultInput, session: Db
) -> AdminCaseStudyResult:
    return await service.update_result(session, case_study_id, item_id, payload)


@router.delete(
    "/{id}/results/{itemId}",
    operation_id="deleteAdminCaseStudyResult",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_case_study_result(case_study_id: CaseStudyId, item_id: ItemId, session: Db) -> None:
    await service.delete_result(session, case_study_id, item_id)


# ---------------------------------------------------------------------------------------------- images


@router.post(
    "/{id}/images",
    operation_id="createAdminCaseStudyImage",
    summary="Add an uploaded media asset to the gallery (alt text required)",
    response_model=AdminCaseStudyImage,
    status_code=201,
    responses=errors(401, 403, 404, 422),
)
async def create_admin_case_study_image(
    case_study_id: CaseStudyId, payload: CaseStudyImageInput, session: Db
) -> AdminCaseStudyImage:
    return await service.create_image(session, case_study_id, payload)


@router.put(
    "/{id}/images/order",
    operation_id="reorderAdminCaseStudyImages",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404, 422),
)
async def reorder_admin_case_study_images(case_study_id: CaseStudyId, payload: OrderRequest, session: Db) -> None:
    await service.reorder_images(session, case_study_id, payload.ids)


@router.put(
    "/{id}/images/{itemId}",
    operation_id="updateAdminCaseStudyImage",
    response_model=AdminCaseStudyImage,
    status_code=200,
    responses=errors(401, 403, 404, 422),
)
async def update_admin_case_study_image(
    case_study_id: CaseStudyId, item_id: ItemId, payload: CaseStudyImageInput, session: Db
) -> AdminCaseStudyImage:
    return await service.update_image(session, case_study_id, item_id, payload)


@router.delete(
    "/{id}/images/{itemId}",
    operation_id="deleteAdminCaseStudyImage",
    summary="Remove the gallery entry (the media asset itself is kept)",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404),
)
async def delete_admin_case_study_image(case_study_id: CaseStudyId, item_id: ItemId, session: Db) -> None:
    await service.delete_image(session, case_study_id, item_id)
