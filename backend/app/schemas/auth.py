"""Admin auth schemas (BE-008, contract ``LoginRequest`` / ``AdminSession``)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, StringConstraints

from app.schemas.base import Email, InputModel, check_single_line

# Passwords are taken exactly as typed (no stripping), 1..128 characters on one line. The constraint sits directly on
# ``str``: on top of another ``Annotated`` type the model-wide ``str_strip_whitespace=True`` of ``InputModel`` would
# still strip, so a password created by the CLI with surrounding spaces could never log in.
Password = Annotated[
    str,
    StringConstraints(strip_whitespace=False, min_length=1, max_length=128),
    AfterValidator(check_single_line),
]


class LoginRequest(InputModel):
    email: Email
    password: Password = Field(repr=False)


class AdminSession(BaseModel):
    email: str
    csrf_token: str = Field(description="Send as X-CSRF-Token; keep in memory only", repr=False)
    idle_expires_at: datetime
    absolute_expires_at: datetime
