"""BE-013 admin case studies with nested results and images: BE-T-055..BE-T-066 through the API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.models import CaseStudy, CaseStudyImage, CaseStudyResult, MediaAsset, SiteSettings
from tests import factories

BASE = "/api/admin/case-studies"


def case_study_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "slug": "fresh-launch",
        "title": "A fictional launch",
        "client_name": "Fictional Client Co",
        "client_industry": "Retail",
        "campaign_type": "Product launch",
        "channels": ["Email", "Blog"],
        "goals": ["Grow sign-ups"],
        "summary": "A short fictional summary.",
        "problem_md": "# Problem\n\nThe old page said too much.",
        "solution_md": "We wrote **one** clear promise and a [guide](https://example.com/guide).",
        "year": 2025,
        "timeline": "6 weeks",
        "cover_media_id": None,
        "cover_alt": None,
        "is_featured": True,
        "is_published": True,
        "is_sample": True,
    }
    body.update(overrides)
    return body


def result_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "metric_label": "Open rate",
        "value": "38 %",
        "before_value": "22 %",
        "change_text": "+16 pts",
        "period": "3 months",
        "is_sample": True,
    }
    body.update(overrides)
    return body


async def changed_at(session: AsyncSession) -> datetime:
    statement = select(SiteSettings.content_changed_at).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


async def count(session: AsyncSession, model: Any, *where: Any) -> int:
    return int((await session.execute(select(func.count()).select_from(model).where(*where))).scalar_one())


@pytest.mark.be_t("BE-T-055")
async def test_create_case_study_appends_renders_and_touches(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    for position in range(3):
        await factories.case_study(db_session, position=position)
    before = await changed_at(db_session)
    response = await admin_client.post(BASE, json=case_study_body(problem_md="Raw <script>alert(1)</script> text"))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["position"] == 3
    assert "<script>" not in body["problem_html"]
    assert "&lt;script&gt;" in body["problem_html"]
    assert 'rel="noopener noreferrer nofollow"' in body["solution_html"]
    assert body["results"] == []
    assert body["images"] == []
    assert body["cover"] is None
    assert await changed_at(db_session) > before


@pytest.mark.be_t("BE-T-056")
@pytest.mark.parametrize(("slug", "status"), [("Hello World", 422), ("a" * 81, 422)])
async def test_create_case_study_rejects_bad_slugs(admin_client: httpx.AsyncClient, slug: str, status: int) -> None:
    response = await admin_client.post(BASE, json=case_study_body(slug=slug))
    assert response.status_code == status
    assert "slug" in response.json()["error"]["fields"]


@pytest.mark.be_t("BE-T-056")
async def test_create_case_study_duplicate_slug_is_409_and_nothing_saved(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await factories.case_study(db_session, slug="taken-slug")
    before = await count(db_session, CaseStudy)
    response = await admin_client.post(BASE, json=case_study_body(slug="taken-slug"))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "slug_taken"
    assert "slug" in response.json()["error"]["fields"]
    assert await count(db_session, CaseStudy) == before


@pytest.mark.be_t("BE-T-057")
@pytest.mark.parametrize(
    "extra",
    [{"position": 0}, {"id": str(uuid.uuid4())}, {"problem_html": "<p>x</p>"}, {"content_changed_at": "2020-01-01"}],
)
async def test_update_case_study_rejects_server_fields(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, extra: dict[str, Any]
) -> None:
    row = await factories.case_study(db_session, title="Unchanged title")
    response = await admin_client.put(f"{BASE}/{row.id}", json={**case_study_body(), **extra})
    assert response.status_code == 422
    assert next(iter(extra)) in response.json()["error"]["fields"]
    title = await db_session.scalar(select(CaseStudy.title).where(CaseStudy.id == row.id))
    assert title == "Unchanged title"


@pytest.mark.be_t("BE-T-058")
async def test_case_study_cover_rules(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    media = await factories.media_asset(db_session)
    blank_alt = await admin_client.post(BASE, json=case_study_body(cover_media_id=str(media.id), cover_alt="   "))
    assert blank_alt.status_code == 422
    assert set(blank_alt.json()["error"]["fields"]) == {"cover_alt"}
    unknown = await admin_client.post(BASE, json=case_study_body(cover_media_id=str(uuid.uuid4()), cover_alt="Alt"))
    assert unknown.status_code == 422
    assert set(unknown.json()["error"]["fields"]) == {"cover_media_id"}
    ok = await admin_client.post(BASE, json=case_study_body(cover_media_id=str(media.id), cover_alt="Cover"))
    assert ok.status_code == 201
    assert ok.json()["cover"]["alt"] == "Cover"
    assert ok.json()["cover"]["url"] == f"/media/{media.path}"


@pytest.mark.be_t("BE-T-059")
async def test_delete_case_study_cascades_and_keeps_media_and_testimonial(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    media = await factories.media_asset(db_session)
    row = await factories.case_study(db_session)
    await factories.case_study_result(db_session, row.id)
    await factories.case_study_image(db_session, row.id, media.id)
    testimonial = await factories.testimonial(db_session, case_study_id=row.id)
    before = await changed_at(db_session)
    response = await admin_client.delete(f"{BASE}/{row.id}")
    assert response.status_code == 204
    assert response.content == b""
    assert await count(db_session, CaseStudyResult, CaseStudyResult.case_study_id == row.id) == 0
    assert await count(db_session, CaseStudyImage, CaseStudyImage.case_study_id == row.id) == 0
    assert await count(db_session, MediaAsset, MediaAsset.id == media.id) == 1
    link = await db_session.scalar(
        select(models.Testimonial.case_study_id)
        .where(models.Testimonial.id == testimonial.id)
        .execution_options(populate_existing=True)
    )
    assert link is None
    assert await changed_at(db_session) > before
    assert (await admin_client.delete(f"{BASE}/{row.id}")).status_code == 404


@pytest.mark.be_t("BE-T-060")
async def test_results_create_update_delete_and_cross_parent_404(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    parent = await factories.case_study(db_session)
    other = await factories.case_study(db_session)
    created = await admin_client.post(f"{BASE}/{parent.id}/results", json=result_body(before_value=""))
    assert created.status_code == 201, created.text
    result = created.json()
    assert result["position"] == 0
    assert result["before_value"] is None
    item = f"{BASE}/{parent.id}/results/{result['id']}"
    updated = await admin_client.put(item, json=result_body(is_sample=False, value="41 %"))
    assert updated.status_code == 200
    assert updated.json()["is_sample"] is False
    assert updated.json()["value"] == "41 %"
    cross = await admin_client.put(f"{BASE}/{other.id}/results/{result['id']}", json=result_body())
    assert cross.status_code == 404
    assert (await admin_client.delete(f"{BASE}/{other.id}/results/{result['id']}")).status_code == 404
    assert (await admin_client.delete(item)).status_code == 204
    assert (await admin_client.post(f"{BASE}/{uuid.uuid4()}/results", json=result_body())).status_code == 404
    long_value = await admin_client.post(f"{BASE}/{parent.id}/results", json=result_body(value="x" * 31))
    assert long_value.status_code == 422
    assert "value" in long_value.json()["error"]["fields"]


@pytest.mark.be_t("BE-T-061")
async def test_gallery_image_rules(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    parent = await factories.case_study(db_session)
    media = await factories.media_asset(
        db_session, variants=[{"width": 480, "path": "uploads/2026/10/a-480.webp"}], alt="Default alt"
    )
    url = f"{BASE}/{parent.id}/images"
    base = {"media_id": str(media.id), "alt": "Campaign visual", "caption": None, "layout": "full"}
    blank = await admin_client.post(url, json={**base, "alt": "  "})
    assert blank.status_code == 422
    assert set(blank.json()["error"]["fields"]) == {"alt"}
    wide = await admin_client.post(url, json={**base, "layout": "wide"})
    assert wide.status_code == 422
    assert set(wide.json()["error"]["fields"]) == {"layout"}
    unknown = await admin_client.post(url, json={**base, "media_id": str(uuid.uuid4())})
    assert unknown.status_code == 422
    assert set(unknown.json()["error"]["fields"]) == {"media_id"}
    ok = await admin_client.post(url, json={**base, "caption": "Hero"})
    assert ok.status_code == 201, ok.text
    image = ok.json()
    assert image["image"]["alt"] == "Campaign visual"  # usage alt, not the media default
    assert image["image"]["srcset"] == [{"width": 480, "url": "/media/uploads/2026/10/a-480.webp"}]
    update = await admin_client.put(f"{url}/{image['id']}", json={**base, "layout": "half", "caption": ""})
    assert update.status_code == 200
    assert update.json()["layout"] == "half"
    assert update.json()["caption"] is None
    other = await factories.case_study(db_session)
    assert (await admin_client.put(f"{BASE}/{other.id}/images/{image['id']}", json=base)).status_code == 404
    assert (await admin_client.delete(f"{BASE}/{other.id}/images/{image['id']}")).status_code == 404
    assert (await admin_client.delete(f"{url}/{image['id']}")).status_code == 204
    assert await count(db_session, MediaAsset, MediaAsset.id == media.id) == 1


@pytest.mark.be_t("BE-T-062")
async def test_get_case_study_embeds_ordered_results_and_images(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    media = await factories.media_asset(db_session)
    row = await factories.case_study(db_session, is_published=False)
    second = await factories.case_study_result(db_session, row.id, metric_label="Second", position=1)
    first = await factories.case_study_result(db_session, row.id, metric_label="First", position=0)
    image_b = await factories.case_study_image(db_session, row.id, media.id, position=5)
    image_a = await factories.case_study_image(db_session, row.id, media.id, position=2)
    response = await admin_client.get(f"{BASE}/{row.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["is_published"] is False
    assert [r["id"] for r in body["results"]] == [str(first.id), str(second.id)]
    assert [i["id"] for i in body["images"]] == [str(image_a.id), str(image_b.id)]
    assert (await admin_client.get(f"{BASE}/{uuid.uuid4()}")).status_code == 404
    assert (await admin_client.get(f"{BASE}/not-a-uuid")).status_code == 422

    listing = (await admin_client.get(BASE)).json()
    assert [item["id"] for item in listing] == [str(row.id)]
    assert listing[0]["is_published"] is False


@pytest.mark.be_t("BE-T-063")
async def test_clearing_sample_flags_shows_in_admin_and_public(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    created = (await admin_client.post(BASE, json=case_study_body(slug="flagged"))).json()
    result = (await admin_client.post(f"{BASE}/{created['id']}/results", json=result_body())).json()
    cs = await admin_client.put(f"{BASE}/{created['id']}", json=case_study_body(slug="flagged", is_sample=False))
    assert cs.status_code == 200
    assert cs.json()["is_sample"] is False
    res = await admin_client.put(f"{BASE}/{created['id']}/results/{result['id']}", json=result_body(is_sample=False))
    assert res.json()["is_sample"] is False
    public = (await admin_client.get("/api/public/case-studies/flagged")).json()
    assert public["is_sample"] is False
    assert [r["is_sample"] for r in public["results"]] == [False]


@pytest.mark.be_t("BE-T-064")
async def test_reorder_case_studies_via_api(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    rows = [await factories.case_study(db_session, position=i) for i in range(3)]
    ids = [str(row.id) for row in rows]
    new_order = [ids[2], ids[0], ids[1]]
    before = await changed_at(db_session)
    ok = await admin_client.put(f"{BASE}/order", json={"ids": new_order})
    assert ok.status_code == 204
    assert [item["id"] for item in (await admin_client.get(BASE)).json()] == new_order
    assert await changed_at(db_session) > before
    for bad in ([ids[0], ids[1]], [*ids, str(uuid.uuid4())], [ids[0], ids[0], ids[1], ids[2]]):
        response = await admin_client.put(f"{BASE}/order", json={"ids": bad})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "order_mismatch"
    assert [item["id"] for item in (await admin_client.get(BASE)).json()] == new_order


@pytest.mark.be_t("BE-T-065")
async def test_reorder_nested_with_foreign_ids_is_mismatch(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    media = await factories.media_asset(db_session)
    a = await factories.case_study(db_session)
    b = await factories.case_study(db_session)
    a_results = [await factories.case_study_result(db_session, a.id, position=i) for i in range(2)]
    b_result = await factories.case_study_result(db_session, b.id, position=0)
    a_images = [await factories.case_study_image(db_session, a.id, media.id, position=i) for i in range(2)]
    b_image = await factories.case_study_image(db_session, b.id, media.id, position=0)

    foreign = await admin_client.put(
        f"{BASE}/{a.id}/results/order", json={"ids": [str(a_results[0].id), str(b_result.id)]}
    )
    assert foreign.status_code == 422
    assert foreign.json()["error"]["code"] == "order_mismatch"
    foreign_images = await admin_client.put(
        f"{BASE}/{a.id}/images/order", json={"ids": [str(a_images[1].id), str(b_image.id)]}
    )
    assert foreign_images.json()["error"]["code"] == "order_mismatch"

    reversed_results = [str(a_results[1].id), str(a_results[0].id)]
    assert (await admin_client.put(f"{BASE}/{a.id}/results/order", json={"ids": reversed_results})).status_code == 204
    reversed_images = [str(a_images[1].id), str(a_images[0].id)]
    assert (await admin_client.put(f"{BASE}/{a.id}/images/order", json={"ids": reversed_images})).status_code == 204
    detail = (await admin_client.get(f"{BASE}/{a.id}")).json()
    assert [r["id"] for r in detail["results"]] == reversed_results
    assert [i["id"] for i in detail["images"]] == reversed_images
    missing = await admin_client.put(f"{BASE}/{uuid.uuid4()}/results/order", json={"ids": reversed_results})
    assert missing.status_code == 404


@pytest.mark.be_t("BE-T-066")
async def test_unpublishing_removes_from_public_list(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    created = (await admin_client.post(BASE, json=case_study_body(slug="soon-hidden"))).json()
    assert [cs["slug"] for cs in (await admin_client.get("/api/public/case-studies")).json()] == ["soon-hidden"]
    before = await changed_at(db_session)
    hidden = await admin_client.put(
        f"{BASE}/{created['id']}", json=case_study_body(slug="soon-hidden", is_published=False)
    )
    assert hidden.status_code == 200
    assert (await admin_client.get("/api/public/case-studies")).json() == []
    assert await changed_at(db_session) > before


async def test_update_case_study_slug_rules_and_unknown_id(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    await factories.case_study(db_session, slug="other-slug")
    row = await factories.case_study(db_session, slug="own-slug")
    same = await admin_client.put(f"{BASE}/{row.id}", json=case_study_body(slug="own-slug"))
    assert same.status_code == 200
    taken = await admin_client.put(f"{BASE}/{row.id}", json=case_study_body(slug="other-slug"))
    assert taken.status_code == 409
    assert (await admin_client.put(f"{BASE}/{uuid.uuid4()}", json=case_study_body())).status_code == 404
