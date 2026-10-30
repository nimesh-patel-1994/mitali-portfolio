"""BE-016 FAQ categories and FAQs: BE-T-074..BE-T-077."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import CategoryNotEmptyError, ValidationFailedError
from app.models import Faq
from app.repositories import faqs as faq_repository
from app.schemas.faq import FaqCategoryInput
from app.services import faqs as faq_service
from tests import factories

CATEGORIES = "/api/admin/faq-categories"
FAQS = "/api/admin/faqs"


def faq_body(category_id: uuid.UUID | str, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "category_id": str(category_id),
        "question": "A fictional question?",
        "answer": "A fictional answer.\n\nSecond paragraph.",
        "show_in_preview": False,
        "is_published": True,
    }
    body.update(overrides)
    return body


@pytest.mark.be_t("BE-T-074")
async def test_delete_category_with_faqs_is_409_and_empty_is_204(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    full = await factories.faq_category(db_session)
    await factories.faq(db_session, full.id)
    empty = await factories.faq_category(db_session)
    refused = await admin_client.delete(f"{CATEGORIES}/{full.id}")
    assert refused.status_code == 409
    assert refused.json()["error"] == {
        "code": "category_not_empty",
        "message": "Move or delete the FAQs in this category first.",
    }
    assert (await admin_client.delete(f"{CATEGORIES}/{empty.id}")).status_code == 204
    assert (await admin_client.delete(f"{CATEGORIES}/{empty.id}")).status_code == 404


@pytest.mark.be_t("BE-T-075")
async def test_moving_faq_appends_to_target_category(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    source = await factories.faq_category(db_session)
    target = await factories.faq_category(db_session)
    moving = await factories.faq(db_session, source.id, position=0)
    staying = [await factories.faq(db_session, source.id, position=i) for i in (1, 2)]
    for position in range(3):
        await factories.faq(db_session, target.id, position=position)
    response = await admin_client.put(f"{FAQS}/{moving.id}", json=faq_body(target.id))
    assert response.status_code == 200, response.text
    assert response.json()["category_id"] == str(target.id)
    assert response.json()["position"] == 3
    in_source = (await admin_client.get(FAQS, params={"category_id": str(source.id)})).json()
    assert [faq["id"] for faq in in_source] == [str(row.id) for row in staying]
    same_category = await admin_client.put(f"{FAQS}/{moving.id}", json=faq_body(target.id, question="Edited?"))
    assert same_category.json()["position"] == 3


@pytest.mark.be_t("BE-T-076")
async def test_reorder_faqs_within_category(admin_client: httpx.AsyncClient, db_session: AsyncSession) -> None:
    category = await factories.faq_category(db_session)
    other = await factories.faq_category(db_session)
    rows = [await factories.faq(db_session, category.id, position=i) for i in range(3)]
    foreign = await factories.faq(db_session, other.id, position=0)
    ids = [str(row.id) for row in rows]
    order = [ids[1], ids[2], ids[0]]
    ok = await admin_client.put(f"{FAQS}/order", json={"category_id": str(category.id), "ids": order})
    assert ok.status_code == 204
    listed = (await admin_client.get(FAQS, params={"category_id": str(category.id)})).json()
    assert [faq["id"] for faq in listed] == order
    mixed = await admin_client.put(
        f"{FAQS}/order", json={"category_id": str(category.id), "ids": [*order, str(foreign.id)]}
    )
    assert mixed.status_code == 422
    assert mixed.json()["error"]["code"] == "order_mismatch"
    unknown = await admin_client.put(f"{FAQS}/order", json={"category_id": str(uuid.uuid4()), "ids": order})
    assert unknown.status_code == 404


@pytest.mark.be_t("BE-T-077")
async def test_unknown_category_and_duplicate_category_name(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    unknown = await admin_client.post(FAQS, json=faq_body(uuid.uuid4()))
    assert unknown.status_code == 422
    assert set(unknown.json()["error"]["fields"]) == {"category_id"}
    created = await admin_client.post(CATEGORIES, json={"name": "Pricing", "is_published": True})
    assert created.status_code == 201
    assert created.json()["faq_count"] == 0
    duplicate = await admin_client.post(CATEGORIES, json={"name": "Pricing", "is_published": False})
    assert duplicate.status_code == 422
    assert duplicate.json()["error"]["fields"] == {"name": "A category with this name already exists."}
    other = await admin_client.post(CATEGORIES, json={"name": "Process", "is_published": True})
    renamed = await admin_client.put(
        f"{CATEGORIES}/{other.json()['id']}", json={"name": "Pricing", "is_published": True}
    )
    assert renamed.status_code == 422
    moving_existing = await factories.faq(db_session, uuid.UUID(other.json()["id"]))
    bad_move = await admin_client.put(f"{FAQS}/{moving_existing.id}", json=faq_body(uuid.uuid4()))
    assert set(bad_move.json()["error"]["fields"]) == {"category_id"}


async def test_category_and_faq_crud_listing_order_and_counts(
    admin_client: httpx.AsyncClient, db_session: AsyncSession
) -> None:
    second = (await admin_client.post(CATEGORIES, json={"name": "Second", "is_published": True})).json()
    first = (await admin_client.post(CATEGORIES, json={"name": "First", "is_published": False})).json()
    order = [first["id"], second["id"]]
    assert (await admin_client.put(f"{CATEGORIES}/order", json={"ids": order})).status_code == 204
    in_second = (await admin_client.post(FAQS, json=faq_body(second["id"], question="In second?"))).json()
    in_first = (await admin_client.post(FAQS, json=faq_body(first["id"], show_in_preview=True))).json()
    assert in_first["position"] == 0
    assert in_second["position"] == 0
    listed = (await admin_client.get(FAQS)).json()
    assert [faq["id"] for faq in listed] == [in_first["id"], in_second["id"]]  # category position first
    categories = (await admin_client.get(CATEGORIES)).json()
    assert [(c["id"], c["faq_count"]) for c in categories] == [(first["id"], 1), (second["id"], 1)]
    got = (await admin_client.get(f"{CATEGORIES}/{first['id']}")).json()
    assert got["faq_count"] == 1
    assert got["is_published"] is False
    renamed = await admin_client.put(f"{CATEGORIES}/{first['id']}", json={"name": "Renamed", "is_published": True})
    assert renamed.json()["name"] == "Renamed"
    assert renamed.json()["faq_count"] == 1
    assert (await admin_client.get(f"{FAQS}/{in_first['id']}")).json()["show_in_preview"] is True
    assert (await admin_client.delete(f"{FAQS}/{in_first['id']}")).status_code == 204
    assert (await admin_client.get(f"{FAQS}/{in_first['id']}")).status_code == 404
    assert (await admin_client.delete(f"{FAQS}/{in_first['id']}")).status_code == 404
    assert (await admin_client.get(f"{CATEGORIES}/{uuid.uuid4()}")).status_code == 404
    unknown_put = await admin_client.put(f"{CATEGORIES}/{uuid.uuid4()}", json={"name": "X", "is_published": True})
    assert unknown_put.status_code == 404
    assert (await admin_client.put(f"{FAQS}/{uuid.uuid4()}", json=faq_body(second["id"]))).status_code == 404
    assert (await admin_client.get(FAQS, params={"category_id": "nope"})).status_code == 422


async def test_category_integrity_errors_are_translated(
    db_session: AsyncSession, db_session_factory: Callable[[], AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Writes that slip past the pre-checks (concurrent admin tabs) still map to the contract codes: the unique
    violation on the name to 422 ``fields.name`` and the FK ``RESTRICT`` violation to 409 ``category_not_empty``."""
    category = await factories.faq_category(db_session, name="Taken")
    await factories.faq(db_session, category.id)
    await db_session.commit()  # releases the session; the per-test outer transaction still rolls everything back

    async def no_conflict(*_args: object, **_kwargs: object) -> bool:
        return False

    async def no_faqs(*_args: object, **_kwargs: object) -> int:
        return 0

    monkeypatch.setattr(faq_repository, "category_name_in_use", no_conflict)
    monkeypatch.setattr(faq_repository, "count_faqs", no_faqs)

    async with db_session_factory() as session:
        with pytest.raises(ValidationFailedError) as name_error:
            await faq_service.create_category(session, FaqCategoryInput(name="Taken", is_published=True))
    assert name_error.value.fields == {"name": "A category with this name already exists."}

    async with db_session_factory() as session:
        with pytest.raises(CategoryNotEmptyError):
            await faq_service.delete_category(session, category.id)
    async with db_session_factory() as session:
        remaining = await session.scalar(select(Faq.id).where(Faq.category_id == category.id))
    assert remaining is not None
