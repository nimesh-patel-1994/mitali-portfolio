"""``GET /api/public/testimonials`` (``listPublicTestimonials``, BE-006)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.public import Testimonial
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get(
    "/testimonials",
    operation_id="listPublicTestimonials",
    summary="Published testimonials in display order",
    response_model=list[Testimonial],
    status_code=200,
)
async def list_public_testimonials(session: Annotated[AsyncSession, Depends(get_db)]) -> list[Testimonial]:
    return await content_public.list_testimonials(session)
