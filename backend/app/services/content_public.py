"""Public content service (BE-006, TS-004): maps published rows to the public schemas.

Unknown, unpublished or malformed slugs give 404 ``not_found`` (REQ-022); ``is_sample`` flags are passed through
(REQ-023). ``more_work`` holds the next two published case studies after the current one by position, wrapping
around (REQ-021).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models import CaseStudy, Profile, SiteSettings, WritingSample
from app.repositories import public_content as repository
from app.schemas import public as schemas
from app.schemas.enums import WritingFormat
from app.schemas.images import ImageRef
from app.services.image_refs import image_ref
from app.services.slugs import is_valid_slug

MORE_WORK_COUNT = 2


def _case_study_summary(row: CaseStudy) -> schemas.CaseStudySummary:
    return schemas.CaseStudySummary(
        slug=row.slug,
        title=row.title,
        client_name=row.client_name,
        campaign_type=row.campaign_type,
        summary=row.summary,
        cover=image_ref(row.cover_media, row.cover_alt),
        is_featured=row.is_featured,
        is_sample=row.is_sample,
        updated_at=row.updated_at,
    )


def _writing_summary_fields(row: WritingSample) -> dict[str, Any]:
    return {
        "slug": row.slug,
        "title": row.title,
        "format": row.format,
        "excerpt": row.excerpt,
        "thumbnail": image_ref(row.thumbnail_media, row.thumbnail_alt),
        "client_name": row.client_name,
        "published_on": row.published_on,
        "reading_time_min": row.reading_time_min,
        "is_featured": row.is_featured,
        "is_sample": row.is_sample,
        "updated_at": row.updated_at,
    }


def more_work(ordered: list[CaseStudy], current: CaseStudy, count: int = MORE_WORK_COUNT) -> list[CaseStudy]:
    """Next ``count`` items after ``current`` in display order, wrapping around, never ``current`` itself."""
    others = [row for row in ordered if row.id != current.id]
    if not others:
        return []
    index = next((i for i, row in enumerate(ordered) if row.id == current.id), -1)
    rotated = ordered[index + 1 :] + ordered[: index + 1] if index >= 0 else ordered
    return [row for row in rotated if row.id != current.id][:count]


# ---------------------------------------------------------------------------------------------- site bundle


def _public_settings(row: SiteSettings) -> schemas.PublicSettings:
    return schemas.PublicSettings(
        contact_email=row.contact_email,
        booking_url=row.booking_url,
        social_links=[schemas.SocialLink(label=str(link["label"]), url=str(link["url"])) for link in row.social_links],
        footer_signoff=row.footer_signoff,
        contact_promise=row.contact_promise,
        footer_rights_line=row.footer_rights_line,
    )


def _public_profile(row: Profile) -> schemas.PublicProfile:
    return schemas.PublicProfile(
        name=row.name,
        headline=row.headline,
        bio=list(row.bio),
        skills=list(row.skills),
        tools=list(row.tools),
        years_experience=row.years_experience,
        origin_statement=row.origin_statement,
        vision_blocks=[
            schemas.VisionBlock(heading=str(block["heading"]), body=str(block["body"])) for block in row.vision_blocks
        ],
        portrait=image_ref(row.portrait_media, row.portrait_alt),
    )


async def get_site(session: AsyncSession) -> schemas.SiteBundle:
    async with session.begin():
        settings, profile = await repository.site_singletons(session)
        return schemas.SiteBundle(
            generated_at=datetime.now(UTC),
            settings=_public_settings(settings),
            profile=_public_profile(profile),
        )


# ---------------------------------------------------------------------------------------------- case studies


async def list_case_studies(session: AsyncSession, *, featured: bool | None) -> list[schemas.CaseStudySummary]:
    async with session.begin():
        rows = await repository.published_case_studies(session, featured_only=featured is True)
        return [_case_study_summary(row) for row in rows]


async def get_case_study(session: AsyncSession, slug: str) -> schemas.CaseStudyDetail:
    if not is_valid_slug(slug):
        raise NotFoundError("Case study not found.")
    async with session.begin():
        row = await repository.published_case_study_by_slug(session, slug)
        if row is None:
            raise NotFoundError("Case study not found.")
        ordered = await repository.published_case_studies(session)
        summary = _case_study_summary(row)
        return schemas.CaseStudyDetail(
            **summary.model_dump(),
            client_industry=row.client_industry,
            year=row.year,
            timeline=row.timeline,
            channels=list(row.channels),
            goals=list(row.goals),
            problem_html=row.problem_html,
            solution_html=row.solution_html,
            results=[
                schemas.CaseStudyResult(
                    id=result.id,
                    metric_label=result.metric_label,
                    value=result.value,
                    before_value=result.before_value,
                    change_text=result.change_text,
                    period=result.period,
                    is_sample=result.is_sample,
                )
                for result in row.results
            ],
            images=[
                schemas.CaseStudyImage(
                    id=image.id,
                    layout="half" if image.layout == "half" else "full",
                    image=_required_image(image_ref(image.media, image.alt)),
                    caption=image.caption,
                )
                for image in row.images
            ],
            more_work=[_case_study_summary(other) for other in more_work(ordered, row)],
        )


def _required_image(ref: ImageRef | None) -> ImageRef:
    if ref is None:  # media_id is NOT NULL with an FK, so a gallery row always has media
        raise NotFoundError("Image not found.")
    return ref


# ---------------------------------------------------------------------------------------------- writing samples


async def list_writing_samples(
    session: AsyncSession, *, writing_format: WritingFormat | None
) -> list[schemas.WritingSampleSummary]:
    async with session.begin():
        rows = await repository.published_writing_samples(session, writing_format=writing_format)
        return [schemas.WritingSampleSummary(**_writing_summary_fields(row)) for row in rows]


async def get_writing_sample(session: AsyncSession, slug: str) -> schemas.WritingSampleDetail:
    if not is_valid_slug(slug):
        raise NotFoundError("Writing sample not found.")
    async with session.begin():
        row = await repository.published_writing_sample_by_slug(session, slug)
        if row is None:
            raise NotFoundError("Writing sample not found.")
        return schemas.WritingSampleDetail(
            **_writing_summary_fields(row),
            industry=row.industry,
            tags=list(row.tags),
            body_html=row.body_html,
            word_count=row.word_count,
        )


# ---------------------------------------------------------------------------------------------- other content


async def list_services(session: AsyncSession) -> list[schemas.Service]:
    async with session.begin():
        return [
            schemas.Service(id=row.id, name=row.name, description=row.description, deliverables=list(row.deliverables))
            for row in await repository.published_services(session)
        ]


async def list_engagement_models(session: AsyncSession) -> list[schemas.EngagementModel]:
    async with session.begin():
        return [
            schemas.EngagementModel(
                id=row.id,
                name=row.name,
                description=row.description,
                features=list(row.features),
                cta_label=row.cta_label,
                cta_target="contact" if row.cta_target == "contact" else "booking",
            )
            for row in await repository.published_engagement_models(session)
        ]


async def list_testimonials(session: AsyncSession) -> list[schemas.Testimonial]:
    async with session.begin():
        return [
            schemas.Testimonial(
                id=row.id,
                quote=row.quote,
                author_name=row.author_name,
                author_role=row.author_role,
                company=row.company,
                case_study_slug=slug,
            )
            for row, slug in await repository.published_testimonials(session)
        ]


async def list_faq_groups(session: AsyncSession) -> list[schemas.FaqGroup]:
    """Published categories with at least one published FAQ, each with its published FAQs (both in order)."""
    groups: dict[Any, schemas.FaqGroup] = {}
    async with session.begin():
        for category, faq in await repository.published_faqs_with_categories(session):
            group = groups.get(category.id)
            if group is None:
                group = groups[category.id] = schemas.FaqGroup(id=category.id, name=category.name, faqs=[])
            group.faqs.append(schemas.Faq(id=faq.id, question=faq.question, answer=faq.answer))
    return list(groups.values())


async def list_faq_preview(session: AsyncSession) -> list[schemas.Faq]:
    async with session.begin():
        return [
            schemas.Faq(id=row.id, question=row.question, answer=row.answer)
            for row in await repository.published_faq_preview(session)
        ]


async def list_values(session: AsyncSession) -> list[schemas.CoreValue]:
    async with session.begin():
        return [
            schemas.CoreValue(id=row.id, title=row.title, body=row.body)
            for row in await repository.published_values(session)
        ]


async def list_process_steps(session: AsyncSession) -> list[schemas.ProcessStep]:
    async with session.begin():
        return [
            schemas.ProcessStep(id=row.id, title=row.title, body=row.body)
            for row in await repository.published_process_steps(session)
        ]
