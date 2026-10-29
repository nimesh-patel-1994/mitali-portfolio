"""Published-only queries for the public API (BE-006, TS-004, BE-REV-009, BE-REV-010).

Every query filters ``is_published = true`` (FAQs also on the category; testimonial links on the case study) and
orders by ``(position, created_at)``. Relations are loaded with ``selectinload`` so a list costs a fixed number of
statements regardless of the row count.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CaseStudy,
    CaseStudyImage,
    CoreValue,
    EngagementModel,
    Faq,
    FaqCategory,
    ProcessStep,
    Profile,
    Service,
    SiteSettings,
    Testimonial,
    WritingSample,
)
from app.models.singletons import SINGLETON_ID


async def _scalars(session: AsyncSession, statement: Any) -> list[Any]:
    return list((await session.execute(statement)).scalars().all())


async def published_case_studies(session: AsyncSession, *, featured_only: bool = False) -> list[CaseStudy]:
    statement = (
        select(CaseStudy)
        .where(CaseStudy.is_published.is_(True))
        .options(selectinload(CaseStudy.cover_media))
        .order_by(CaseStudy.position, CaseStudy.created_at)
    )
    if featured_only:
        statement = statement.where(CaseStudy.is_featured.is_(True))
    return await _scalars(session, statement)


async def published_case_study_by_slug(session: AsyncSession, slug: str) -> CaseStudy | None:
    statement = (
        select(CaseStudy)
        .where(CaseStudy.slug == slug, CaseStudy.is_published.is_(True))
        .options(
            selectinload(CaseStudy.cover_media),
            selectinload(CaseStudy.results),
            selectinload(CaseStudy.images).selectinload(CaseStudyImage.media),
        )
    )
    return (await session.execute(statement)).scalar_one_or_none()


async def published_writing_samples(session: AsyncSession, *, writing_format: str | None = None) -> list[WritingSample]:
    statement = (
        select(WritingSample)
        .where(WritingSample.is_published.is_(True))
        .options(selectinload(WritingSample.thumbnail_media))
        .order_by(WritingSample.position, WritingSample.created_at)
    )
    if writing_format is not None:
        statement = statement.where(WritingSample.format == writing_format)
    return await _scalars(session, statement)


async def published_writing_sample_by_slug(session: AsyncSession, slug: str) -> WritingSample | None:
    statement = (
        select(WritingSample)
        .where(WritingSample.slug == slug, WritingSample.is_published.is_(True))
        .options(selectinload(WritingSample.thumbnail_media))
    )
    return (await session.execute(statement)).scalar_one_or_none()


async def published_rows(session: AsyncSession, model: Any) -> list[Any]:
    """Services, engagement models, values and process steps (no relations)."""
    statement = select(model).where(model.is_published.is_(True)).order_by(model.position, model.created_at)
    return await _scalars(session, statement)


async def published_services(session: AsyncSession) -> list[Service]:
    return await published_rows(session, Service)


async def published_engagement_models(session: AsyncSession) -> list[EngagementModel]:
    return await published_rows(session, EngagementModel)


async def published_values(session: AsyncSession) -> list[CoreValue]:
    return await published_rows(session, CoreValue)


async def published_process_steps(session: AsyncSession) -> list[ProcessStep]:
    return await published_rows(session, ProcessStep)


async def published_testimonials(session: AsyncSession) -> Sequence[tuple[Testimonial, str | None]]:
    """Testimonials with the slug of the linked case study only when that case study is published."""
    statement = (
        select(Testimonial, CaseStudy.slug)
        .outerjoin(CaseStudy, and_(CaseStudy.id == Testimonial.case_study_id, CaseStudy.is_published.is_(True)))
        .where(Testimonial.is_published.is_(True))
        .order_by(Testimonial.position, Testimonial.created_at)
    )
    return [(row[0], row[1]) for row in (await session.execute(statement)).all()]


async def published_faqs_with_categories(session: AsyncSession) -> Sequence[tuple[FaqCategory, Faq]]:
    """Published FAQs in published categories, ordered by category then FAQ position."""
    statement = (
        select(FaqCategory, Faq)
        .join(Faq, Faq.category_id == FaqCategory.id)
        .where(FaqCategory.is_published.is_(True), Faq.is_published.is_(True))
        .order_by(FaqCategory.position, FaqCategory.created_at, Faq.position, Faq.created_at)
    )
    return [(row[0], row[1]) for row in (await session.execute(statement)).all()]


async def published_faq_preview(session: AsyncSession) -> list[Faq]:
    statement = (
        select(Faq)
        .join(FaqCategory, FaqCategory.id == Faq.category_id)
        .where(FaqCategory.is_published.is_(True), Faq.is_published.is_(True), Faq.show_in_preview.is_(True))
        .order_by(FaqCategory.position, FaqCategory.created_at, Faq.position, Faq.created_at)
    )
    return await _scalars(session, statement)


async def site_singletons(session: AsyncSession) -> tuple[SiteSettings, Profile]:
    settings = (await session.execute(select(SiteSettings).where(SiteSettings.id == SINGLETON_ID))).scalar_one()
    profile = (
        await session.execute(
            select(Profile).where(Profile.id == SINGLETON_ID).options(selectinload(Profile.portrait_media))
        )
    ).scalar_one()
    return settings, profile
