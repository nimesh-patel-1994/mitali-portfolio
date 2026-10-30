"""BE-020 enquiry management: BE-T-092..BE-T-094 and the enquiry part of BE-T-013 (pagination)."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Enquiry, SiteSettings
from app.schemas.common import MAX_OFFSET, PageParams
from tests import factories

URL = "/api/admin/enquiries"
START = datetime(2026, 3, 1, 9, 0, tzinfo=UTC)


async def enquiry(session: AsyncSession, minutes: int, status: str = "new", **overrides: Any) -> Enquiry:
    values: dict[str, Any] = {
        "name": "Sam Example",
        "email": "sam@example.com",
        "company": None,
        "enquiry_type": "copywriting",
        "budget_range": None,
        "message": "A fictional message about website copy.",
        "status": status,
        "created_at": START + timedelta(minutes=minutes),
    }
    values.update(overrides)
    row = Enquiry(**values)
    session.add(row)
    await session.flush()
    return row


async def changed_at(session: AsyncSession) -> datetime:
    statement = select(SiteSettings.content_changed_at).execution_options(populate_existing=True)
    return (await session.execute(statement)).scalar_one()


@pytest.mark.be_t("BE-T-092")
async def test_list_enquiries_newest_first_and_status_filter(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    new = [await enquiry(db_session, minutes) for minutes in (1, 3, 2)]
    archived = await enquiry(db_session, 4, status="archived")
    only_new = (await admin_client.get(URL, params={"status": "new"})).json()
    assert [item["id"] for item in only_new["items"]] == [str(new[1].id), str(new[2].id), str(new[0].id)]
    assert only_new["total"] == 3
    everything = (await admin_client.get(URL)).json()
    assert everything["total"] == 4
    assert everything["items"][0]["id"] == str(archived.id)
    assert set(everything["items"][0]) == {"id", "name", "email", "company", "enquiry_type", "status", "created_at"}
    spam = await admin_client.get(URL, params={"status": "spam"})
    assert spam.status_code == 422
    assert "status" in spam.json()["error"]["fields"]


@pytest.mark.be_t("BE-T-013")
async def test_enquiry_pagination_bounds(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    for minutes in range(3):
        await enquiry(db_session, minutes)
    for params in ({"page": 0}, {"page_size": 0}, {"page_size": 101}):
        assert (await admin_client.get(URL, params=params)).status_code == 422, params
    beyond = (await admin_client.get(URL, params={"page": 999})).json()
    assert beyond == {"items": [], "total": 3, "page": 999, "page_size": 20}
    second = (await admin_client.get(URL, params={"page": 2, "page_size": 2})).json()
    assert len(second["items"]) == 1
    assert second["total"] == 3


@pytest.mark.be_t("BE-T-013")
@pytest.mark.parametrize("url", [URL, "/api/admin/media"])
async def test_huge_page_number_is_an_empty_page_not_a_500(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, url: str
) -> None:
    """Review m5: page=10**18 (offset beyond a bigint) answers an empty page; the offset never reaches asyncpg."""
    await enquiry(db_session, 0)
    await factories.media_asset(db_session)
    for page, page_size in ((10**18, 100), (10**30, 20), (2, 20)):
        response = await admin_client.get(url, params={"page": page, "page_size": page_size})
        assert response.status_code == 200, (page, response.text)
        body = response.json()
        assert body["items"] == []
        assert body["total"] == 1
        assert (body["page"], body["page_size"]) == (page, page_size)
    assert PageParams(page=10**18, page_size=100).offset == MAX_OFFSET


@pytest.mark.be_t("BE-T-093")
async def test_enquiry_status_changes(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    row = await enquiry(db_session, 1, company="Example Bakery", budget_range="1000_3000")
    detail = (await admin_client.get(f"{URL}/{row.id}")).json()
    assert detail["message"].startswith("A fictional message")
    assert detail["budget_range"] == "1000_3000"
    assert detail["status_changed_at"] is None
    replied = await admin_client.patch(f"{URL}/{row.id}", json={"status": "replied"})
    assert replied.status_code == 200
    assert replied.json()["status"] == "replied"
    first_change = replied.json()["status_changed_at"]
    assert first_change is not None
    back = await admin_client.patch(f"{URL}/{row.id}", json={"status": "new"})
    assert back.json()["status"] == "new"
    assert back.json()["status_changed_at"] >= first_change
    deleted = await admin_client.patch(f"{URL}/{row.id}", json={"status": "deleted"})
    assert deleted.status_code == 422
    extra = await admin_client.patch(f"{URL}/{row.id}", json={"status": "new", "message": "x"})
    assert extra.status_code == 422
    assert (await admin_client.patch(f"{URL}/{uuid.uuid4()}", json={"status": "new"})).status_code == 404
    assert (await admin_client.get(f"{URL}/{uuid.uuid4()}")).status_code == 404


@pytest.mark.be_t("BE-T-094")
async def test_delete_enquiry_is_hard_and_does_not_touch_marker(
    admin_client: httpx.AsyncClient, db_session: AsyncSession, caplog: pytest.LogCaptureFixture
) -> None:
    row = await enquiry(db_session, 1, name="Unique Fictional Sender", email="unique-sender@example.com")
    before = await changed_at(db_session)
    with caplog.at_level(logging.DEBUG):
        await admin_client.patch(f"{URL}/{row.id}", json={"status": "archived"})
        assert (await admin_client.delete(f"{URL}/{row.id}")).status_code == 204
    assert (await admin_client.delete(f"{URL}/{row.id}")).status_code == 404
    gone = await db_session.scalar(select(Enquiry.id).where(Enquiry.id == row.id))
    assert gone is None
    assert await changed_at(db_session) == before
    logged = "\n".join(record.getMessage() + str(getattr(record, "fields", "")) for record in caplog.records)
    assert "Unique Fictional Sender" not in logged
    assert "unique-sender@example.com" not in logged
