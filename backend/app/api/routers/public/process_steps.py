"""``GET /api/public/process-steps`` (``listPublicProcessSteps``, BE-006)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.public import ProcessStep
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get(
    "/process-steps",
    operation_id="listPublicProcessSteps",
    summary="Published process steps in display order",
    response_model=list[ProcessStep],
    status_code=200,
)
async def list_public_process_steps(session: Annotated[AsyncSession, Depends(get_db)]) -> list[ProcessStep]:
    return await content_public.list_process_steps(session)
