"""``POST /api/public/enquiries`` (operation ``createEnquiry``, BE-007)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_ip, get_db, get_settings_dep
from app.core.config import Settings
from app.schemas.common import ERROR_RESPONSE
from app.schemas.enquiry import EnquiryCreate, EnquiryReceived
from app.services.enquiries import submit_enquiry

router = APIRouter(prefix="/api/public", tags=["public"])


@router.post(
    "/enquiries",
    operation_id="createEnquiry",
    summary="Submit the contact form (honeypot + per-client rate limit, 5 per 10 minutes)",
    response_model=EnquiryReceived,
    status_code=201,
    responses={
        413: {**ERROR_RESPONSE, "description": "Body too large"},
        422: {**ERROR_RESPONSE, "description": "Invalid input"},
        429: {**ERROR_RESPONSE, "description": "Too many submissions from this client"},
    },
)
async def create_enquiry(
    payload: EnquiryCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    ip: Annotated[str, Depends(client_ip)],
) -> EnquiryReceived:
    return await submit_enquiry(session, payload, client_ip=ip, hash_secret=settings.hash_key_secret)
