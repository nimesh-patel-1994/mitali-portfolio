"""Admin schemas for services, engagement models, testimonials, values and process steps (BE-015, TS-010; contract
``ServiceInput``/``AdminService``, ``EngagementModelInput``/``AdminEngagementModel``,
``TestimonialInput``/``AdminTestimonial``, ``CoreValueInput``/``AdminCoreValue``,
``ProcessStepInput``/``AdminProcessStep``). Limits follow tech-spec section 3.1."""

from __future__ import annotations

import uuid
from typing import Annotated

from pydantic import Field

from app.schemas.base import InputModel, MultiLine, SingleLine, StringList
from app.schemas.common import AdminMeta
from app.schemas.enums import CtaTarget

Name = Annotated[SingleLine, Field(min_length=1, max_length=80)]
Description = Annotated[MultiLine, Field(min_length=1, max_length=600)]


class ServiceInput(InputModel):
    name: Name
    description: Description
    deliverables: StringList
    is_published: bool


class AdminService(AdminMeta):
    name: str
    description: str
    deliverables: list[str]
    is_published: bool


class EngagementModelInput(InputModel):
    name: Name
    description: Description
    features: StringList
    cta_label: Annotated[SingleLine, Field(min_length=1, max_length=40)]
    cta_target: CtaTarget
    is_published: bool


class AdminEngagementModel(AdminMeta):
    name: str
    description: str
    features: list[str]
    cta_label: str
    cta_target: CtaTarget
    is_published: bool


class TestimonialInput(InputModel):
    quote: Annotated[MultiLine, Field(min_length=1, max_length=600)]
    author_name: Annotated[SingleLine, Field(min_length=1, max_length=80)]
    author_role: Annotated[SingleLine, Field(min_length=1, max_length=80)]
    company: Annotated[SingleLine, Field(min_length=1, max_length=120)]
    case_study_id: uuid.UUID | None
    is_published: bool


class AdminTestimonial(AdminMeta):
    quote: str
    author_name: str
    author_role: str
    company: str
    case_study_id: uuid.UUID | None
    is_published: bool


class CoreValueInput(InputModel):
    title: Name
    body: Description
    is_published: bool


class AdminCoreValue(AdminMeta):
    title: str
    body: str
    is_published: bool


class ProcessStepInput(InputModel):
    title: Name
    body: Description
    is_published: bool


class AdminProcessStep(AdminMeta):
    title: str
    body: str
    is_published: bool
