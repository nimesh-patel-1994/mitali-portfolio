"""Enquiry schemas: contact form (BE-007, TS-007, contract ``EnquiryCreate`` / ``EnquiryReceived``) and admin
management (BE-020, TS-014, contract ``EnquirySummary``, ``Enquiry``, ``EnquiryPage``, ``EnquiryStatusUpdate``).

Enquiry fields are personal data: never log them (REQ-NFR-005, SEC-BE-009).
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated, Final, Literal

from pydantic import BaseModel, BeforeValidator, Field

from app.schemas.base import Email, InputModel, MultiLine, SingleLine
from app.schemas.common import Page
from app.schemas.enums import BudgetRange, EnquiryStatus, EnquiryType

HONEYPOT_MAX_LENGTH: Final = 200
_HONEYPOT_CONTROL: Final = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _tame_honeypot(value: object) -> object:
    """Review n5: a filled honeypot must always get the decoy 201, never a 422 that tells a bot what to change.

    Any string is cut to the documented 200 characters with control characters removed (it is never stored).
    """
    if isinstance(value, str):
        return _HONEYPOT_CONTROL.sub("", value)[:HONEYPOT_MAX_LENGTH]
    return value


class EnquiryCreate(InputModel):
    name: Annotated[SingleLine, Field(min_length=1, max_length=120)]
    email: Email
    enquiry_type: EnquiryType
    budget_range: BudgetRange | None = None
    company: Annotated[SingleLine, Field(max_length=120)] | None = None
    message: Annotated[MultiLine, Field(min_length=1, max_length=5000)]
    website: Annotated[
        Annotated[MultiLine, Field(max_length=HONEYPOT_MAX_LENGTH)] | None, BeforeValidator(_tame_honeypot)
    ] = Field(
        default=None, description="Honeypot; must be empty. When filled the response is 201 but nothing is stored."
    )

    @property
    def is_honeypot_hit(self) -> bool:
        return bool(self.website)


class EnquiryReceived(BaseModel):
    received: Literal[True]


# ---------------------------------------------------------------------------------------------- admin (BE-020)


class EnquirySummary(BaseModel):
    """Contract ``EnquirySummary``. Personal data: admin responses only (``Cache-Control: no-store``)."""

    id: uuid.UUID
    name: str
    email: str
    company: str | None
    enquiry_type: EnquiryType
    status: EnquiryStatus
    created_at: datetime


class Enquiry(EnquirySummary):
    budget_range: BudgetRange | None
    message: str
    status_changed_at: datetime | None
    updated_at: datetime


class EnquiryPage(Page[EnquirySummary]):
    pass


class EnquiryStatusUpdate(InputModel):
    status: EnquiryStatus
