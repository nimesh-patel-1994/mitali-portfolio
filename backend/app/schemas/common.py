"""Shared API schemas: error envelope, health, pagination and ordering (TS-003, contract ``components``)."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

from app.core.errors import ErrorCode
from app.schemas.base import InputModel

T = TypeVar("T")

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


class ErrorBody(BaseModel):
    code: ErrorCode
    message: str
    fields: dict[str, str] | None = Field(
        default=None, description='Field path (e.g. "email", "results.0.value") to message'
    )


class ErrorEnvelope(BaseModel):
    """Contract schema ``Error``: ``{"error": {"code", "message", "fields"?}}``."""

    error: ErrorBody


class Health(BaseModel):
    status: Literal["ok"]
    database: Literal["ok"]


class PageParams:
    """Query parameters ``page`` (>= 1, default 1) and ``page_size`` (1..100, default 20); use with ``Depends()``."""

    def __init__(
        self,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class Page[T](BaseModel):
    """``{items, total, page, page_size}``; subclass per contract name, e.g. ``class EnquiryPage(Page[...])``."""

    items: list[T]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=MAX_PAGE_SIZE)

    @classmethod
    def build(cls, items: list[T], total: int, params: PageParams) -> Page[T]:
        return cls(items=items, total=total, page=params.page, page_size=params.page_size)


class OrderRequest(InputModel):
    """Every id of the scope exactly once, in the new order (exact-set check in ``services/ordering.py``, TS-010)."""

    ids: list[uuid.UUID] = Field(min_length=1)


# Shared OpenAPI ``responses`` entries (routers combine the ones their contract operation lists).
ERROR_RESPONSE = {"model": ErrorEnvelope}
