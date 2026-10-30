"""BE-015 services, engagement models, testimonials, values and process steps: BE-T-070..BE-T-073."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CoreValue, SiteSettings
from tests import factories

TYPES: dict[str, dict[str, Any]] = {
    "services": {
        "name": "Copywriting",
        "description": "Pages that are easy to read.",
        "deliverables": ["Website pages"],
        "is_published": True,
    },
    "engagement-models": {
        "name": "Retainer",
        "description": "A steady monthly rhythm.",
        "features": ["Monthly plan"],
        "cta_label": "Book a call",
        "cta_target": "booking",
        "is_published": True,
    },
    "testimonials": {
        "quote": "A fictional quote about clear writing.",
        "author_name": "Alex Example",
        "author_role": "Founder",
        "company": "Example Ltd",
        "case_study_id": None,
        "is_published": True,
    },
    "values": {"title": "Clarity", "body": "Plain words first.", "is_published": True},
    "process-steps": {"title": "Listen", "body": "Start with questions.", "is_published": True},
}

# A field per type with its limit (BE-T-071).
LIMITS: dict[str, tuple[str, int]] = {
    "services": ("name", 80),
    "engagement-models": ("cta_label", 40),
    "testimonials": ("quote", 600),
    "values": ("title", 80),
    "process-steps": ("body", 600),
}


async def changed_at(session: AsyncSession) -> datetime:
    statement = select(SiteSettings.content_changed_at).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


@pytest.mark.be_t("BE-T-070")
@pytest.mark.parametrize("path", list(TYPES))
async def test_simple_type_full_crud_and_order(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, path: str
) -> None:
    base = f"/api/admin/{path}"
    payload = TYPES[path]
    assert (await admin_client.get(base)).json() == []

    marker = await changed_at(db_session)
    first = await admin_client.post(base, json=payload)
    assert first.status_code == 201, first.text
    second = await admin_client.post(base, json={**payload, "is_published": False})
    assert [first.json()["position"], second.json()["position"]] == [0, 1]
    assert await changed_at(db_session) > marker
    for key, value in payload.items():
        assert first.json()[key] == value

    first_id, second_id = first.json()["id"], second.json()["id"]
    listing = await admin_client.get(base)
    assert listing.status_code == 200
    assert [item["id"] for item in listing.json()] == [first_id, second_id]

    got = await admin_client.get(f"{base}/{first_id}")
    assert got.status_code == 200
    assert got.json()["id"] == first_id

    marker = await changed_at(db_session)
    updated = await admin_client.put(f"{base}/{first_id}", json={**payload, "is_published": False})
    assert updated.status_code == 200
    assert updated.json()["is_published"] is False
    assert updated.json()["updated_at"] >= first.json()["updated_at"]
    assert await changed_at(db_session) > marker

    marker = await changed_at(db_session)
    reorder = await admin_client.put(f"{base}/order", json={"ids": [second_id, first_id]})
    assert reorder.status_code == 204
    assert [item["position"] for item in (await admin_client.get(base)).json()] == [0, 1]
    assert [item["id"] for item in (await admin_client.get(base)).json()] == [second_id, first_id]
    assert await changed_at(db_session) > marker

    marker = await changed_at(db_session)
    assert (await admin_client.delete(f"{base}/{first_id}")).status_code == 204
    assert [item["id"] for item in (await admin_client.get(base)).json()] == [second_id]
    assert await changed_at(db_session) > marker


@pytest.mark.be_t("BE-T-071")
@pytest.mark.parametrize("path", list(TYPES))
async def test_simple_type_limits_and_unknown_ids(admin_client: httpx.AsyncClient, path: str) -> None:
    base = f"/api/admin/{path}"
    field, limit = LIMITS[path]
    too_long = await admin_client.post(base, json={**TYPES[path], field: "x" * (limit + 1)})
    assert too_long.status_code == 422
    assert field in too_long.json()["error"]["fields"]
    extra = await admin_client.post(base, json={**TYPES[path], "position": 3})
    assert extra.status_code == 422
    unknown = uuid.uuid4()
    for method in ("GET", "PUT", "DELETE"):
        body = TYPES[path] if method == "PUT" else None
        response = await admin_client.request(method, f"{base}/{unknown}", json=body)
        assert response.status_code == 404, method
        assert response.json()["error"]["code"] == "not_found"


@pytest.mark.be_t("BE-T-072")
async def test_engagement_cta_target_and_testimonial_case_study_reference(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    phone = await admin_client.post(
        "/api/admin/engagement-models", json={**TYPES["engagement-models"], "cta_target": "phone"}
    )
    assert phone.status_code == 422
    assert set(phone.json()["error"]["fields"]) == {"cta_target"}

    unknown = await admin_client.post(
        "/api/admin/testimonials", json={**TYPES["testimonials"], "case_study_id": str(uuid.uuid4())}
    )
    assert unknown.status_code == 422
    assert set(unknown.json()["error"]["fields"]) == {"case_study_id"}

    case_study = await factories.case_study(db_session, is_published=True)
    linked = await admin_client.post(
        "/api/admin/testimonials", json={**TYPES["testimonials"], "case_study_id": str(case_study.id)}
    )
    assert linked.status_code == 201
    assert linked.json()["case_study_id"] == str(case_study.id)
    relinked = await admin_client.put(
        f"/api/admin/testimonials/{linked.json()['id']}",
        json={**TYPES["testimonials"], "case_study_id": str(uuid.uuid4())},
    )
    assert relinked.status_code == 422
    public = (await admin_client.get("/api/public/testimonials")).json()
    assert public[0]["case_study_slug"] == case_study.slug


@pytest.mark.be_t("BE-T-073")
async def test_values_are_stored_in_core_values(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    created = await admin_client.post("/api/admin/values", json=TYPES["values"])
    assert created.status_code == 201
    rows = (await db_session.execute(select(func.count()).select_from(CoreValue))).scalar_one()
    assert rows == 1
    public = (await admin_client.get("/api/public/values")).json()
    assert [value["id"] for value in public] == [created.json()["id"]]
