"""BE-006 public content API: BE-T-019..BE-T-029 (and the public side of BE-T-066)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CaseStudy, SiteSettings
from tests import factories

T0 = datetime(2026, 1, 1, tzinfo=UTC)

Factory = Callable[..., Awaitable[Any]]


async def _faq_with_category(session: AsyncSession, **overrides: Any) -> Any:
    category = await factories.faq_category(session, is_published=True, position=0)
    return await factories.faq(session, category.id, **overrides)


LISTS: list[tuple[str, Factory, str, str]] = [
    ("/api/public/case-studies", factories.case_study, "slug", "slug"),
    ("/api/public/writing-samples", factories.writing_sample, "slug", "slug"),
    ("/api/public/services", factories.service, "id", "id"),
    ("/api/public/engagement-models", factories.engagement_model, "id", "id"),
    ("/api/public/testimonials", factories.testimonial, "id", "id"),
    ("/api/public/values", factories.core_value, "id", "id"),
    ("/api/public/process-steps", factories.process_step, "id", "id"),
    ("/api/public/faqs/preview", _faq_with_category, "id", "id"),
]


@pytest.mark.be_t("BE-T-019")
@pytest.mark.parametrize(("path", "factory", "row_key", "json_key"), LISTS, ids=[item[0] for item in LISTS])
async def test_public_lists_only_published_in_position_then_created_order(
    db_client: httpx.AsyncClient,
    db_session: AsyncSession,
    path: str,
    factory: Factory,
    row_key: str,
    json_key: str,
) -> None:
    extra: dict[str, Any] = {"show_in_preview": True} if "faqs" in path else {}
    second = await factory(db_session, position=2, is_published=True, created_at=T0, **extra)
    first = await factory(db_session, position=0, is_published=True, created_at=T0, **extra)
    await factory(db_session, position=1, is_published=False, created_at=T0, **extra)
    tie_later = await factory(db_session, position=2, is_published=True, created_at=T0 + timedelta(seconds=5), **extra)

    response = await db_client.get(path)
    assert response.status_code == 200, response.text
    keys = [item[json_key] for item in response.json()]
    assert keys == [str(getattr(row, row_key)) for row in (first, second, tie_later)]


@pytest.mark.be_t("BE-T-020")
@pytest.mark.parametrize("kind", ["case-studies", "writing-samples"])
async def test_public_detail_unpublished_unknown_or_malformed_slug_is_404(
    db_client: httpx.AsyncClient, db_session: AsyncSession, kind: str
) -> None:
    factory = factories.case_study if kind == "case-studies" else factories.writing_sample
    await factory(db_session, slug="hidden-item", is_published=False)
    for slug in ("hidden-item", "no-such-item", "Bad%20Slug", "a%00b", "x" * 81):
        response = await db_client.get(f"/api/public/{kind}/{slug}")
        assert response.status_code == 404, slug
        assert response.json()["error"]["code"] == "not_found"


@pytest.mark.be_t("BE-T-021")
async def test_public_case_study_detail_orders_results_and_images(
    db_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    media = await factories.media_asset(db_session)
    study = await factories.case_study(
        db_session, slug="detail-case", is_published=True, is_sample=True, problem_html="<p>Problem <em>x</em></p>"
    )
    r2 = await factories.case_study_result(db_session, study.id, position=1, metric_label="Second", is_sample=True)
    r1 = await factories.case_study_result(db_session, study.id, position=0, metric_label="First", is_sample=False)
    i2 = await factories.case_study_image(db_session, study.id, media.id, position=5, alt="Second image")
    i1 = await factories.case_study_image(db_session, study.id, media.id, position=1, alt="First image", layout="half")

    response = await db_client.get("/api/public/case-studies/detail-case")
    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["id"] for item in body["results"]] == [str(r1.id), str(r2.id)]
    assert [item["is_sample"] for item in body["results"]] == [False, True]
    assert [item["id"] for item in body["images"]] == [str(i1.id), str(i2.id)]
    assert body["images"][0]["layout"] == "half"
    assert body["images"][0]["image"]["alt"] == "First image"
    assert body["problem_html"] == "<p>Problem <em>x</em></p>"
    assert body["is_sample"] is True
    assert body["more_work"] == []


@pytest.mark.be_t("BE-T-022")
@pytest.mark.parametrize(("published", "expected"), [(1, 0), (2, 1), (3, 2), (5, 2)])
async def test_public_more_work_wraps_and_excludes_current_and_unpublished(
    db_client: httpx.AsyncClient, db_session: AsyncSession, published: int, expected: int
) -> None:
    rows = [
        await factories.case_study(db_session, slug=f"mw-{i}", position=i * 2, is_published=True)
        for i in range(published)
    ]
    await factories.case_study(db_session, slug="mw-hidden", position=1, is_published=False)
    last = rows[-1]
    response = await db_client.get(f"/api/public/case-studies/{last.slug}")
    assert response.status_code == 200
    slugs = [item["slug"] for item in response.json()["more_work"]]
    assert slugs == [row.slug for row in rows[:expected]]
    assert last.slug not in slugs
    assert "mw-hidden" not in slugs


@pytest.mark.be_t("BE-T-023")
async def test_public_featured_filter(db_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    b = await factories.case_study(db_session, slug="feat-b", position=3, is_featured=True, is_published=True)
    a = await factories.case_study(db_session, slug="feat-a", position=1, is_featured=True, is_published=True)
    await factories.case_study(db_session, slug="feat-hidden", position=0, is_featured=True, is_published=False)
    await factories.case_study(db_session, slug="plain", position=2, is_featured=False, is_published=True)

    featured = await db_client.get("/api/public/case-studies", params={"featured": "true"})
    assert [item["slug"] for item in featured.json()] == [a.slug, b.slug]
    everything = await db_client.get("/api/public/case-studies", params={"featured": "false"})
    assert [item["slug"] for item in everything.json()] == ["feat-a", "plain", "feat-b"]
    invalid = await db_client.get("/api/public/case-studies", params={"featured": "maybe"})
    assert invalid.status_code == 422


@pytest.mark.be_t("BE-T-024")
async def test_public_writing_format_filter(db_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    email = await factories.writing_sample(db_session, format="email", is_published=True, position=0)
    await factories.writing_sample(db_session, format="blog", is_published=True, position=1)
    await factories.writing_sample(db_session, format="email", is_published=False, position=2)

    response = await db_client.get("/api/public/writing-samples", params={"format": "email"})
    assert [item["slug"] for item in response.json()] == [email.slug]
    invalid = await db_client.get("/api/public/writing-samples", params={"format": "video"})
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "validation_error"
    assert "format" in invalid.json()["error"]["fields"]


async def test_public_writing_sample_detail(db_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    sample = await factories.writing_sample(
        db_session, slug="post-one", is_published=True, is_sample=True, tags=["Email"], word_count=3
    )
    response = await db_client.get("/api/public/writing-samples/post-one")
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == sample.slug
    assert body["body_html"] == "<p>Body.</p>"
    assert body["tags"] == ["Email"]
    assert body["is_sample"] is True
    assert body["thumbnail"] is None


@pytest.mark.be_t("BE-T-025")
async def test_public_faq_groups_and_preview(db_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    hidden_category = await factories.faq_category(db_session, name="Hidden", is_published=False, position=0)
    await factories.faq(db_session, hidden_category.id, is_published=True, show_in_preview=True)
    await factories.faq_category(db_session, name="Empty", is_published=True, position=1)
    second = await factories.faq_category(db_session, name="Second", is_published=True, position=3)
    first = await factories.faq_category(db_session, name="First", is_published=True, position=2)
    s1 = await factories.faq(db_session, second.id, position=0, is_published=True, show_in_preview=True)
    f2 = await factories.faq(db_session, first.id, position=1, is_published=True, show_in_preview=True)
    f1 = await factories.faq(db_session, first.id, position=0, is_published=True, show_in_preview=False)
    await factories.faq(db_session, first.id, position=2, is_published=False, show_in_preview=True)

    groups = (await db_client.get("/api/public/faqs")).json()
    assert [group["name"] for group in groups] == ["First", "Second"]
    assert [faq["id"] for faq in groups[0]["faqs"]] == [str(f1.id), str(f2.id)]
    assert [faq["id"] for faq in groups[1]["faqs"]] == [str(s1.id)]

    preview = (await db_client.get("/api/public/faqs/preview")).json()
    assert [faq["id"] for faq in preview] == [str(f2.id), str(s1.id)]


@pytest.mark.be_t("BE-T-026")
async def test_public_testimonial_slug_only_for_published_case_study(
    db_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    published = await factories.case_study(db_session, slug="linked-live", is_published=True)
    unpublished = await factories.case_study(db_session, slug="linked-draft", is_published=False)
    await factories.testimonial(db_session, case_study_id=published.id, is_published=True, position=0)
    await factories.testimonial(db_session, case_study_id=unpublished.id, is_published=True, position=1)
    await factories.testimonial(db_session, case_study_id=None, is_published=True, position=2)

    body = (await db_client.get("/api/public/testimonials")).json()
    assert [item["case_study_slug"] for item in body] == ["linked-live", None, None]


@pytest.mark.be_t("BE-T-027")
async def test_public_site_bundle_has_generated_at_and_no_notification_email(
    db_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await db_session.execute(
        update(SiteSettings).values(
            notification_email="owner@example.com",
            booking_url="#",
            social_links=[{"label": "In", "url": "https://example.com/in"}],
        )
    )
    before = datetime.now(UTC)
    response = await db_client.get("/api/public/site")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"generated_at", "settings", "profile"}
    assert datetime.fromisoformat(body["generated_at"]) >= before - timedelta(seconds=1)
    assert set(body["settings"]) == {"contact_email", "booking_url", "social_links", "footer_signoff"}
    assert "notification_email" not in response.text
    assert "owner@example.com" not in response.text
    assert body["settings"]["social_links"] == [{"label": "In", "url": "https://example.com/in"}]
    assert body["profile"]["portrait"] is None
    assert len(body["profile"]["vision_blocks"]) == 2


@pytest.mark.be_t("BE-T-028")
async def test_public_image_refs_root_relative_srcset_and_usage_alt(
    db_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    raster = await factories.media_asset(
        db_session,
        path="uploads/2026/10/cover-1600.webp",
        variants=[
            {"width": 960, "path": "uploads/2026/10/cover-960.webp"},
            {"width": 480, "path": "uploads/2026/10/cover-480.webp"},
            {"width": 1600, "path": "uploads/2026/10/cover-1600.webp"},
        ],
        width=1600,
        height=1000,
        alt="default alt from the media library",
    )
    svg = await factories.media_asset(
        db_session, path="seed/thumbnails/t.svg", mime="image/svg+xml", variants=[], source="seed", alt="default"
    )
    await factories.case_study(
        db_session, slug="with-cover", is_published=True, cover_media_id=raster.id, cover_alt="Cover alt"
    )
    await factories.writing_sample(
        db_session, slug="with-thumb", is_published=True, thumbnail_media_id=svg.id, thumbnail_alt="Thumb alt"
    )

    cover = (await db_client.get("/api/public/case-studies")).json()[0]["cover"]
    assert cover["url"] == "/media/uploads/2026/10/cover-1600.webp"
    assert [source["width"] for source in cover["srcset"]] == [480, 960, 1600]
    assert all(source["url"].startswith("/media/uploads/") for source in cover["srcset"])
    assert cover["alt"] == "Cover alt"
    assert cover["mime"] == "image/webp"
    thumb = (await db_client.get("/api/public/writing-samples/with-thumb")).json()["thumbnail"]
    assert thumb["srcset"] == []
    assert thumb["mime"] == "image/svg+xml"
    assert thumb["alt"] == "Thumb alt"


@pytest.mark.be_t("BE-T-029")
async def test_public_lists_use_a_fixed_number_of_queries(
    db_client: httpx.AsyncClient, db_session: AsyncSession, query_counter: Callable[[], Any]
) -> None:
    async def add(count: int) -> None:
        for _ in range(count):
            media = await factories.media_asset(db_session)
            study = await factories.case_study(
                db_session, is_published=True, cover_media_id=media.id, cover_alt="Cover"
            )
            await factories.case_study_result(db_session, study.id)
            await factories.writing_sample(
                db_session, is_published=True, thumbnail_media_id=media.id, thumbnail_alt="T"
            )

    counts: list[tuple[int, int]] = []
    for batch in (2, 8):
        await add(batch)
        with query_counter() as studies:
            assert (await db_client.get("/api/public/case-studies")).status_code == 200
        with query_counter() as samples:
            assert (await db_client.get("/api/public/writing-samples")).status_code == 200
        counts.append((studies.count, samples.count))
    assert counts[0] == counts[1]


@pytest.mark.be_t("BE-T-066")
async def test_unpublished_item_disappears_from_public_list(
    db_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    study = await factories.case_study(db_session, slug="soon-hidden", is_published=True)
    assert [item["slug"] for item in (await db_client.get("/api/public/case-studies")).json()] == ["soon-hidden"]
    await db_session.execute(update(CaseStudy).where(CaseStudy.id == study.id).values(is_published=False))
    assert (await db_client.get("/api/public/case-studies")).json() == []
    assert (await db_client.get("/api/public/case-studies/soon-hidden")).status_code == 404
