"""Seed orchestration (BE-023, TS-017, REQ-070, REQ-071, REQ-023, SEC-BE-019).

1. Generate the placeholder SVGs (stdlib only, deterministic) and write them under ``MEDIA_ROOT/seed/<kind>/`` in the
   threadpool. Files written before a failed transaction are harmless: the next run rewrites identical bytes.
2. Render every Markdown body through ``render_markdown`` (BE-018), the same function used on save.
3. In **one transaction**: upsert ``media_assets`` by path (``source = 'seed'``), upsert content by ``seed_key``
   (default: insert missing rows only; ``reset``: restore seed values), update the singletons only with ``reset`` or
   while they still hold the migration placeholders, add the four enquiries only when ``APP_ENV == development``,
   and finish with ``publishing.touch()``.

Case studies, results and writing samples are seeded with ``is_sample = true`` and ``is_published = true``. The seed
never creates an admin, a password or a session.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import AppEnv
from app.models import (
    CaseStudy,
    CaseStudyImage,
    CaseStudyResult,
    CoreValue,
    EngagementModel,
    Enquiry,
    Faq,
    FaqCategory,
    MediaAsset,
    ProcessStep,
    Profile,
    Service,
    SiteSettings,
    Testimonial,
    WritingSample,
)
from app.models.singletons import PROFILE_PLACEHOLDER, SETTINGS_PLACEHOLDER
from app.repositories import seed as repository
from app.seed import data, images
from app.seed.images import GeneratedSvg
from app.services import publishing
from app.services.markdown import RenderedMarkdown, render_markdown

SEED_FOLDER: Final = "seed"
HALF_LAYOUT_KINDS: Final = frozenset({"email", "social", "social-alt", "landing"})
PROFILE_SEED_KEY: Final = "profile"
SETTINGS_SEED_KEY: Final = "settings"
ALT_MAX: Final = 250

COUNTED_TABLES: Final[dict[str, Any]] = {
    "case_studies": CaseStudy,
    "case_study_results": CaseStudyResult,
    "case_study_images": CaseStudyImage,
    "writing_samples": WritingSample,
    "services": Service,
    "engagement_models": EngagementModel,
    "testimonials": Testimonial,
    "faq_categories": FaqCategory,
    "faqs": Faq,
    "core_values": CoreValue,
    "process_steps": ProcessStep,
    "enquiries": Enquiry,
    "media_assets": MediaAsset,
}


@dataclass(frozen=True, slots=True)
class PlannedImage:
    relative_path: str  # below MEDIA_ROOT, e.g. "seed/covers/cs-verdant-loop.svg"
    svg: GeneratedSvg
    alt: str


@dataclass(frozen=True, slots=True)
class SeedSummary:
    reset: bool
    enquiries_seeded: bool
    images_written: int
    counts: dict[str, int]


def file_stem(seed_key: str) -> str:
    return seed_key.replace(":", "-")


def _clip(text: str, limit: int = ALT_MAX) -> str:
    return text if len(text) <= limit else text[: limit - 3].rstrip() + "..."


def _gallery_svg(case_study: data.SeedCaseStudy, kind: str) -> tuple[GeneratedSvg, str, str | None]:
    """``(svg, alt, caption)`` for one gallery image kind."""
    name, palette = case_study.client_name, case_study.palette
    if kind == "key-visual":
        alt = f"{name} campaign key visual with the line '{case_study.tagline}' (placeholder illustration)"
        return images.cover(name, case_study.tagline, palette), alt, "Campaign key visual"
    if kind == "email":
        return images.email_mockup(name, palette), f"Email layout mock-up for {name} (placeholder)", "Email layout"
    if kind in {"social", "social-alt"}:
        variant = 1 if kind == "social-alt" else 0
        alt = f"Grid of nine social posts for {name} (placeholder illustration)"
        return images.social_grid(name, palette, variant), alt, "Social post grid"
    if kind == "blog":
        return images.blog_wireframe(name, palette), f"Blog article wireframe for {name} (placeholder)", None
    if kind == "landing":
        return images.landing_wireframe(name, palette), f"Landing page wireframe for {name} (placeholder)", None
    if kind == "chart":
        rows = [(result.metric_label, result.value, result.chart_value) for result in case_study.results]
        described = "; ".join(f"{label} {value}" for label, value, _ in rows)
        alt = f"Bar chart of {name} sample results: {described}"
        return images.results_chart(name, palette, rows), alt, "Sample data"
    if kind == "pillars":
        alt = f"Messaging pillars for {name}: {', '.join(case_study.pillars)}"
        return images.pillars_board(name, palette, case_study.pillars), alt, "Messaging pillars"
    raise ValueError(f"unknown gallery kind {kind!r}")


def plan_images() -> dict[str, PlannedImage]:
    """Every placeholder image keyed by its owner (``cover:<cs key>``, ``<image seed key>``, ``thumb:<ws key>``,
    ``portrait``). Pure and deterministic."""
    planned: dict[str, PlannedImage] = {}
    for case_study in data.CASE_STUDIES:
        stem = file_stem(case_study.seed_key)
        cover_alt = f"{case_study.client_name} campaign cover: {case_study.tagline} (placeholder illustration)"
        planned[f"cover:{case_study.seed_key}"] = PlannedImage(
            f"{SEED_FOLDER}/covers/{stem}.svg",
            images.cover(case_study.client_name, case_study.tagline, case_study.palette),
            _clip(cover_alt),
        )
        for index, kind in enumerate(case_study.gallery, start=1):
            key = f"{case_study.seed_key}:image:{index}"
            svg, alt, _caption = _gallery_svg(case_study, kind)
            planned[key] = PlannedImage(f"{SEED_FOLDER}/gallery/{file_stem(key)}.svg", svg, _clip(alt))
    for index, sample in enumerate(data.WRITING_SAMPLES):
        planned[f"thumb:{sample.seed_key}"] = PlannedImage(
            f"{SEED_FOLDER}/thumbnails/{file_stem(sample.seed_key)}.svg",
            images.writing_thumbnail(sample.title, sample.format, dark=index % 2 == 1),
            _clip(f"Placeholder thumbnail for the {sample.format.replace('_', ' ')} sample '{sample.title}'"),
        )
    planned["portrait"] = PlannedImage(
        f"{SEED_FOLDER}/portraits/{PROFILE_SEED_KEY}.svg", images.portrait(), data.PROFILE.portrait_alt
    )
    return planned


def write_images(media_root: Path, planned: dict[str, PlannedImage]) -> int:
    """Write the SVG files (blocking; threadpool). Paths are fixed strings below ``MEDIA_ROOT/seed``."""
    root = media_root.resolve()
    for image in planned.values():
        target = (root / image.relative_path).resolve()
        if not target.is_relative_to(root / SEED_FOLDER):
            raise ValueError("seed image path escapes MEDIA_ROOT/seed")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(image.svg.markup)
    return len(planned)


def render_bodies() -> dict[str, RenderedMarkdown]:
    rendered: dict[str, RenderedMarkdown] = {}
    for case_study in data.CASE_STUDIES:
        rendered[f"{case_study.seed_key}:problem"] = render_markdown(case_study.problem_md)
        rendered[f"{case_study.seed_key}:solution"] = render_markdown(case_study.solution_md)
    for sample in data.WRITING_SAMPLES:
        rendered[sample.seed_key] = render_markdown(sample.body_md)
    return rendered


# ---------------------------------------------------------------------------------------------- transaction steps


async def _media(session: AsyncSession, planned: dict[str, PlannedImage]) -> dict[str, Any]:
    ids: dict[str, Any] = {}
    for key, image in planned.items():
        ids[key] = await repository.upsert_media(
            session,
            {
                "path": image.relative_path,
                "variants": [],
                "mime": "image/svg+xml",
                "width": image.svg.width,
                "height": image.svg.height,
                "bytes": len(image.svg.markup),
                "original_filename": None,
                "alt": image.alt,
                "source": "seed",
            },
        )
    return ids


async def _case_studies(
    session: AsyncSession,
    planned: dict[str, PlannedImage],
    media_ids: dict[str, Any],
    rendered: dict[str, RenderedMarkdown],
    *,
    reset: bool,
    now: datetime,
) -> dict[str, Any]:
    ids: dict[str, Any] = {}
    for position, cs in enumerate(data.CASE_STUDIES):
        cover_key = f"cover:{cs.seed_key}"
        case_study_id = await repository.upsert_by_seed_key(
            session,
            CaseStudy,
            {
                "seed_key": cs.seed_key,
                "slug": cs.slug,
                "title": cs.title,
                "client_name": cs.client_name,
                "client_industry": cs.client_industry,
                "campaign_type": cs.campaign_type,
                "channels": list(cs.channels),
                "goals": list(cs.goals),
                "summary": cs.summary,
                "problem_md": cs.problem_md,
                "solution_md": cs.solution_md,
                "problem_html": rendered[f"{cs.seed_key}:problem"].html,
                "solution_html": rendered[f"{cs.seed_key}:solution"].html,
                "year": cs.year,
                "timeline": cs.timeline,
                "cover_media_id": media_ids[cover_key],
                "cover_alt": planned[cover_key].alt,
                "is_featured": cs.is_featured,
                "is_published": True,
                "is_sample": True,
                "position": position,
            },
            reset=reset,
            now=now,
        )
        ids[cs.slug] = case_study_id
        for index, result in enumerate(cs.results, start=1):
            await repository.upsert_by_seed_key(
                session,
                CaseStudyResult,
                {
                    "seed_key": f"{cs.seed_key}:result:{index}",
                    "case_study_id": case_study_id,
                    "metric_label": result.metric_label,
                    "value": result.value,
                    "before_value": result.before_value,
                    "change_text": result.change_text,
                    "period": result.period,
                    "is_sample": True,
                    "position": index - 1,
                },
                reset=reset,
                now=now,
            )
        for index, kind in enumerate(cs.gallery, start=1):
            key = f"{cs.seed_key}:image:{index}"
            _svg, _alt, caption = _gallery_svg(cs, kind)
            await repository.upsert_by_seed_key(
                session,
                CaseStudyImage,
                {
                    "seed_key": key,
                    "case_study_id": case_study_id,
                    "media_id": media_ids[key],
                    "alt": planned[key].alt,
                    "caption": caption,
                    "layout": "half" if kind in HALF_LAYOUT_KINDS else "full",
                    "position": index - 1,
                },
                reset=reset,
                now=now,
            )
    return ids


async def _writing_samples(
    session: AsyncSession,
    planned: dict[str, PlannedImage],
    media_ids: dict[str, Any],
    rendered: dict[str, RenderedMarkdown],
    *,
    reset: bool,
    now: datetime,
) -> None:
    for position, sample in enumerate(data.WRITING_SAMPLES):
        body = rendered[sample.seed_key]
        thumb_key = f"thumb:{sample.seed_key}"
        await repository.upsert_by_seed_key(
            session,
            WritingSample,
            {
                "seed_key": sample.seed_key,
                "slug": sample.slug,
                "title": sample.title,
                "format": sample.format,
                "client_name": sample.client_name,
                "industry": sample.industry,
                "excerpt": sample.excerpt,
                "body_md": sample.body_md,
                "body_html": body.html,
                "word_count": body.word_count,
                "reading_time_min": body.reading_time_min,
                "published_on": sample.published_on,
                "tags": list(sample.tags),
                "thumbnail_media_id": media_ids[thumb_key],
                "thumbnail_alt": planned[thumb_key].alt,
                "is_featured": sample.is_featured,
                "is_published": True,
                "is_sample": True,
                "position": position,
            },
            reset=reset,
            now=now,
        )


async def _simple(session: AsyncSession, case_study_ids: dict[str, Any], *, reset: bool, now: datetime) -> None:
    groups: tuple[tuple[Any, tuple[data.SeedSimple, ...]], ...] = (
        (Service, data.SERVICES),
        (EngagementModel, data.ENGAGEMENT_MODELS),
        (CoreValue, data.VALUES),
        (ProcessStep, data.PROCESS_STEPS),
    )
    for model, items in groups:
        for position, item in enumerate(items):
            values = {"seed_key": item.key, **item.fields, "is_published": True, "position": position}
            await repository.upsert_by_seed_key(session, model, values, reset=reset, now=now)
    for position, testimonial in enumerate(data.TESTIMONIALS):
        await repository.upsert_by_seed_key(
            session,
            Testimonial,
            {
                "seed_key": testimonial.key,
                "quote": testimonial.quote,
                "author_name": testimonial.author_name,
                "author_role": testimonial.author_role,
                "company": testimonial.company,
                "case_study_id": case_study_ids.get(testimonial.case_study_slug or ""),
                "is_published": True,
                "position": position,
            },
            reset=reset,
            now=now,
        )
    for category_position, category in enumerate(data.FAQ_CATEGORIES):
        category_id = await repository.upsert_by_seed_key(
            session,
            FaqCategory,
            {
                "seed_key": f"faq-category:{category.key}",
                "name": category.name,
                "is_published": True,
                "position": category_position,
            },
            reset=reset,
            now=now,
        )
        for index, (question, answer, preview) in enumerate(category.faqs, start=1):
            await repository.upsert_by_seed_key(
                session,
                Faq,
                {
                    "seed_key": f"faq:{category.key}:{index}",
                    "category_id": category_id,
                    "question": question,
                    "answer": answer,
                    "show_in_preview": preview,
                    "is_published": True,
                    "position": index - 1,
                },
                reset=reset,
                now=now,
            )


async def _singletons(session: AsyncSession, portrait_id: Any, portrait_alt: str, *, reset: bool) -> None:
    profile = await repository.get_profile(session)
    profile_is_placeholder = (
        profile.seed_key is None
        and profile.name == PROFILE_PLACEHOLDER["name"]
        and profile.headline == PROFILE_PLACEHOLDER["headline"]
    )
    if reset or profile_is_placeholder:
        seed_profile = data.PROFILE
        await repository.update_singleton(
            session,
            Profile,
            {
                "seed_key": PROFILE_SEED_KEY,
                "name": seed_profile.name,
                "headline": seed_profile.headline,
                "bio": list(seed_profile.bio),
                "skills": list(seed_profile.skills),
                "tools": list(seed_profile.tools),
                "years_experience": seed_profile.years_experience,
                "origin_statement": seed_profile.origin_statement,
                "vision_blocks": [{"heading": heading, "body": body} for heading, body in seed_profile.vision_blocks],
                "portrait_media_id": portrait_id,
                "portrait_alt": portrait_alt,
            },
        )
    settings = await repository.get_settings(session)
    settings_is_placeholder = (
        settings.seed_key is None
        and settings.contact_email == SETTINGS_PLACEHOLDER["contact_email"]
        and settings.footer_signoff == SETTINGS_PLACEHOLDER["footer_signoff"]
    )
    if reset or settings_is_placeholder:
        seed_settings = data.SETTINGS
        await repository.update_singleton(
            session,
            SiteSettings,
            {
                "seed_key": SETTINGS_SEED_KEY,
                "contact_email": seed_settings.contact_email,
                "booking_url": seed_settings.booking_url,
                "social_links": [{"label": label, "url": url} for label, url in seed_settings.social_links],
                "footer_signoff": seed_settings.footer_signoff,
                "contact_promise": seed_settings.contact_promise,
                "footer_rights_line": seed_settings.footer_rights_line,
                "notification_email": seed_settings.notification_email,
            },
        )


async def _enquiries(session: AsyncSession, *, reset: bool, now: datetime) -> None:
    for enquiry in data.ENQUIRIES:
        await repository.upsert_by_seed_key(
            session,
            Enquiry,
            {
                "seed_key": enquiry.key,
                "name": enquiry.name,
                "email": enquiry.email,
                "company": enquiry.company,
                "enquiry_type": enquiry.enquiry_type,
                "budget_range": enquiry.budget_range,
                "message": enquiry.message,
                "status": enquiry.status,
                "status_changed_at": None if enquiry.status == "new" else now,
            },
            reset=reset,
            now=now,
        )


async def seed_content(session: AsyncSession, *, reset: bool, app_env: AppEnv, media_root: Path) -> SeedSummary:
    planned = plan_images()
    written = await run_in_threadpool(write_images, media_root, planned)
    rendered = await run_in_threadpool(render_bodies)
    now = datetime.now(UTC)
    with_enquiries = app_env is AppEnv.DEVELOPMENT
    async with session.begin():
        media_ids = await _media(session, planned)
        case_study_ids = await _case_studies(session, planned, media_ids, rendered, reset=reset, now=now)
        await _writing_samples(session, planned, media_ids, rendered, reset=reset, now=now)
        await _simple(session, case_study_ids, reset=reset, now=now)
        await _singletons(session, media_ids["portrait"], planned["portrait"].alt, reset=reset)
        if with_enquiries:
            await _enquiries(session, reset=reset, now=now)
        await publishing.touch(session, now=now)
        counts = {name: await repository.count_rows(session, model) for name, model in COUNTED_TABLES.items()}
    return SeedSummary(reset=reset, enquiries_seeded=with_enquiries, images_written=written, counts=counts)
