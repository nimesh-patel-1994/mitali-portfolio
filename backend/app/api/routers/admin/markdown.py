"""``POST /api/admin/markdown/preview`` (operation ``previewAdminMarkdown``, BE-018)."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.common import ERROR_RESPONSE
from app.schemas.markdown import MarkdownPreview, MarkdownPreviewRequest
from app.services.markdown_preview import preview_markdown

router = APIRouter(prefix="/markdown", tags=["admin-content"])


@router.post(
    "/preview",
    operation_id="previewAdminMarkdown",
    summary="Render and sanitize Markdown exactly as on save (live preview)",
    response_model=MarkdownPreview,
    status_code=200,
    responses={
        401: {**ERROR_RESPONSE, "description": "No valid session"},
        403: {**ERROR_RESPONSE, "description": "Missing or wrong X-CSRF-Token"},
        422: {**ERROR_RESPONSE, "description": "Invalid input (over 100 000 characters)"},
    },
)
async def preview_admin_markdown(payload: MarkdownPreviewRequest) -> MarkdownPreview:
    return await preview_markdown(payload.markdown)
