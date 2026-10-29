"""``GET /api/public/faqs`` and ``/faqs/preview`` (``listPublicFaqGroups``, ``listPublicFaqPreview``, BE-006)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.public import Faq, FaqGroup
from app.services import content_public

router = APIRouter(prefix="/api/public", tags=["public"])


# "/faqs/preview" is declared before any parameterised FAQ path (none exists today).
@router.get(
    "/faqs/preview",
    operation_id="listPublicFaqPreview",
    summary="Published FAQs marked show_in_preview, ordered by category then FAQ position",
    response_model=list[Faq],
    status_code=200,
)
async def list_public_faq_preview(session: Annotated[AsyncSession, Depends(get_db)]) -> list[Faq]:
    return await content_public.list_faq_preview(session)


@router.get(
    "/faqs",
    operation_id="listPublicFaqGroups",
    summary="Published FAQ categories (with at least one published FAQ) and their FAQs, in order",
    response_model=list[FaqGroup],
    status_code=200,
)
async def list_public_faq_groups(session: Annotated[AsyncSession, Depends(get_db)]) -> list[FaqGroup]:
    return await content_public.list_faq_groups(session)
