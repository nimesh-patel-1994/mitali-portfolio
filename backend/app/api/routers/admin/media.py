"""``/api/admin/media`` (BE-017): ``uploadAdminMedia`` (multipart), ``listAdminMedia``, ``deleteAdminMedia``."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Path, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_settings_dep
from app.api.responses import errors
from app.core.config import Settings
from app.schemas.common import PageParams
from app.schemas.media import MediaAsset, MediaPage
from app.services.media import upload as service

router = APIRouter(prefix="/media", tags=["admin-media"])

Db = Annotated[AsyncSession, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings_dep)]
MediaId = Annotated[uuid.UUID, Path(alias="id")]


@router.get(
    "",
    operation_id="listAdminMedia",
    summary="Uploaded and seeded media, newest first (for re-use in pickers)",
    response_model=MediaPage,
    status_code=200,
    responses=errors(401, 422),
)
async def list_admin_media(session: Db, params: Annotated[PageParams, Depends()]) -> MediaPage:
    return await service.list_media(session, params)


@router.post(
    "",
    operation_id="uploadAdminMedia",
    summary="Upload a JPEG, PNG, WebP or SVG image (max 10 MB); rasters become responsive WebP variants",
    response_model=MediaAsset,
    status_code=201,
    responses=errors(401, 403, 413, 415, 422),
)
async def upload_admin_media(
    session: Db,
    settings: AppSettings,
    file: Annotated[UploadFile, File(description="JPEG, PNG, WebP or SVG, at most 10 MB (type detected from content)")],
    alt: Annotated[str | None, Form(max_length=250, description="Default alt suggestion")] = None,
) -> MediaAsset:
    return await service.upload_media(
        session, media_root=settings.media_root_path, upload=file.file, filename=file.filename, alt=alt
    )


@router.delete(
    "/{id}",
    operation_id="deleteAdminMedia",
    summary="Delete an unreferenced media asset and its files (409 media_in_use while referenced)",
    status_code=204,
    response_class=Response,
    responses=errors(401, 403, 404, 409),
)
async def delete_admin_media(media_id: MediaId, session: Db, settings: AppSettings) -> None:
    await service.delete_media(session, media_root=settings.media_root_path, media_id=media_id)
