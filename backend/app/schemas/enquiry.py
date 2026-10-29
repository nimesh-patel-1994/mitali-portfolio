"""Contact form schemas (BE-007, TS-007, contract ``EnquiryCreate`` / ``EnquiryReceived``).

Enquiry fields are personal data: never log them (REQ-NFR-005, SEC-BE-009).
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.base import Email, InputModel, MultiLine, SingleLine
from app.schemas.enums import BudgetRange, EnquiryType


class EnquiryCreate(InputModel):
    name: Annotated[SingleLine, Field(min_length=1, max_length=120)]
    email: Email
    enquiry_type: EnquiryType
    budget_range: BudgetRange | None = None
    company: Annotated[SingleLine, Field(max_length=120)] | None = None
    message: Annotated[MultiLine, Field(min_length=1, max_length=5000)]
    website: Annotated[MultiLine, Field(max_length=200)] | None = Field(
        default=None, description="Honeypot; must be empty. When filled the response is 201 but nothing is stored."
    )

    @property
    def is_honeypot_hit(self) -> bool:
        return bool(self.website)


class EnquiryReceived(BaseModel):
    received: Literal[True]
