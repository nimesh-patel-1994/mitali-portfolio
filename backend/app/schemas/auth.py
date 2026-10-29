"""Admin auth schemas (BE-008, contract ``LoginRequest`` / ``AdminSession``)."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.base import Email, InputModel, SingleLine

# Passwords are taken exactly as typed (no stripping), 1..128 characters on one line.
Password = Annotated[SingleLine, StringConstraints(strip_whitespace=False, min_length=1, max_length=128)]


class LoginRequest(InputModel):
    email: Email
    password: Password = Field(repr=False)


class AdminSession(BaseModel):
    email: str
    csrf_token: str = Field(description="Send as X-CSRF-Token; keep in memory only", repr=False)
    idle_expires_at: datetime
    absolute_expires_at: datetime
