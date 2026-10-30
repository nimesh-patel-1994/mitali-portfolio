"""BE-014 admin writing samples: BE-T-068, BE-T-069 (plus list/filter, update and reorder paths)."""

from __future__ import annotations

import uuid
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.markdown import render_markdown
from tests import factories

BASE = "/api/admin/writing-samples"


def writing_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "slug": "sample-guide",
        "title": "A fictional guide",
        "format": "blog",
        "client_name": "Fictional Client Co",
        "industry": "Retail",
        "excerpt": "A short fictional excerpt.",
        "body_md": "Some words here.",
        "published_on": "2026-01-15",
        "tags": ["Planning"],
        "thumbnail_media_id": None,
        "thumbnail_alt": None,
        "is_featured": False,
        "is_published": True,
        "is_sample": True,
    }
    body.update(overrides)
    return body


@pytest.mark.be_t("BE-T-068")
async def test_create_writing_sample_renders_markdown_and_counts(admin_client: httpx.AsyncClient) -> None:
    markdown = (
        "# Heading\n\n- first item\n- second item\n\n"
        "[a link](https://example.com/page)\n\n<script>alert(1)</script>\n\n" + "word " * 201
    )
    response = await admin_client.post(BASE, json=writing_body(body_md=markdown))
    assert response.status_code == 201, response.text
    body = response.json()
    assert "<h2>Heading</h2>" in body["body_html"]
    assert "<li>first item</li>" in body["body_html"]
    assert "<script>" not in body["body_html"]
    assert "&lt;script&gt;" in body["body_html"]
    assert 'rel="noopener noreferrer nofollow"' in body["body_html"]
    rendered = render_markdown(markdown)
    assert body["body_html"] == rendered.html
    assert body["word_count"] == rendered.word_count
    assert body["word_count"] > 201
    assert body["reading_time_min"] == 2
    assert body["position"] == 0


@pytest.mark.be_t("BE-T-068")
async def test_writing_sample_computed_fields_are_not_writable(admin_client: httpx.AsyncClient) -> None:
    for extra in ({"body_html": "<p>x</p>"}, {"word_count": 5}, {"reading_time_min": 9}):
        response = await admin_client.post(BASE, json={**writing_body(), **extra})
        assert response.status_code == 422
        assert next(iter(extra)) in response.json()["error"]["fields"]


@pytest.mark.be_t("BE-T-069")
async def test_writing_sample_validation_slug_and_delete(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    podcast = await admin_client.post(BASE, json=writing_body(format="podcast"))
    assert podcast.status_code == 422
    assert "format" in podcast.json()["error"]["fields"]
    media = await factories.media_asset(db_session)
    no_alt = await admin_client.post(BASE, json=writing_body(thumbnail_media_id=str(media.id)))
    assert no_alt.status_code == 422
    assert set(no_alt.json()["error"]["fields"]) == {"thumbnail_alt"}
    unknown = await admin_client.post(
        BASE, json=writing_body(thumbnail_media_id=str(uuid.uuid4()), thumbnail_alt="Alt")
    )
    assert set(unknown.json()["error"]["fields"]) == {"thumbnail_media_id"}
    created = await admin_client.post(
        BASE, json=writing_body(thumbnail_media_id=str(media.id), thumbnail_alt="Thumb", client_name="")
    )
    assert created.status_code == 201
    assert created.json()["thumbnail"]["alt"] == "Thumb"
    assert created.json()["client_name"] is None
    duplicate = await admin_client.post(BASE, json=writing_body())
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "slug_taken"
    sample_id = created.json()["id"]
    assert (await admin_client.delete(f"{BASE}/{sample_id}")).status_code == 204
    assert (await admin_client.delete(f"{BASE}/{sample_id}")).status_code == 404
    assert (await admin_client.get(f"{BASE}/{sample_id}")).status_code == 404


async def test_writing_sample_list_filter_update_and_reorder(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    blog = await factories.writing_sample(db_session, format="blog", position=0, is_published=False)
    email = await factories.writing_sample(db_session, format="email", position=1)
    listing = (await admin_client.get(BASE)).json()
    assert [item["id"] for item in listing] == [str(blog.id), str(email.id)]
    assert listing[0]["is_published"] is False
    only_email = (await admin_client.get(BASE, params={"format": "email"})).json()
    assert [item["id"] for item in only_email] == [str(email.id)]
    assert (await admin_client.get(BASE, params={"format": "video"})).status_code == 422

    updated = await admin_client.put(f"{BASE}/{blog.id}", json=writing_body(slug=blog.slug, body_md="One two three"))
    assert updated.status_code == 200
    assert updated.json()["word_count"] == 3
    taken = await admin_client.put(f"{BASE}/{blog.id}", json=writing_body(slug=email.slug))
    assert taken.status_code == 409
    assert (await admin_client.put(f"{BASE}/{uuid.uuid4()}", json=writing_body(slug="x-y"))).status_code == 404
    detail = (await admin_client.get(f"{BASE}/{blog.id}")).json()
    assert detail["body_md"] == "One two three"

    order = [str(email.id), str(blog.id)]
    assert (await admin_client.put(f"{BASE}/order", json={"ids": order})).status_code == 204
    assert [item["id"] for item in (await admin_client.get(BASE)).json()] == order
    mismatch = await admin_client.put(f"{BASE}/order", json={"ids": [str(email.id)]})
    assert mismatch.json()["error"]["code"] == "order_mismatch"
