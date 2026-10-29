"""``GET /api/public/values`` (``listPublicValues``, BE-006)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.public import CoreValue
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get(
    "/values",
    operation_id="listPublicValues",
    summary="Published values in display order",
    response_model=list[CoreValue],
    status_code=200,
)
async def list_public_values(session: Annotated[AsyncSession, Depends(get_db)]) -> list[CoreValue]:
    return await content_public.list_values(session)
