"""Admin FAQ schemas (BE-016, TS-010; contract ``FaqCategoryInput``, ``AdminFaqCategory``, ``FaqInput``, ``AdminFaq``,
``FaqOrderRequest``)."""

from __future__ import annotations

import uuid
from typing import Annotated

from pydantic import Field

from app.schemas.base import InputModel, MultiLine, SingleLine
from app.schemas.common import AdminMeta


class FaqCategoryInput(InputModel):
    name: Annotated[SingleLine, Field(min_length=1, max_length=80)]
    is_published: bool


class AdminFaqCategory(AdminMeta):
    name: str
    is_published: bool
    faq_count: int = Field(ge=0)


class FaqInput(InputModel):
    category_id: uuid.UUID
    question: Annotated[SingleLine, Field(min_length=1, max_length=200)]
    answer: Annotated[MultiLine, Field(min_length=1, max_length=2000)]
    show_in_preview: bool
    is_published: bool


class AdminFaq(AdminMeta):
    category_id: uuid.UUID
    question: str
    answer: str
    show_in_preview: bool
    is_published: bool


class FaqOrderRequest(InputModel):
    """Reorder the FAQs of one category: every FAQ id of that category exactly once (else 422 ``order_mismatch``)."""

    category_id: uuid.UUID
    ids: list[uuid.UUID] = Field(min_length=1)
