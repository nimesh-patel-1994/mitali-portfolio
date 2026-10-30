"""BE-T-110: migration ``0002_settings_copy_fields`` online on the test database (CHG-005).

Starts from ``0001`` with a customised singleton row, upgrades, checks the copied texts, runs ``alembic check``,
downgrades to ``0001`` (only the two columns and their CHECKs go) and upgrades again. The database is left at head
with the singleton reset to the placeholders afterwards.
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import Settings
from app.models.singletons import CONTACT_PROMISE_DEFAULT, FOOTER_RIGHTS_LINE_DEFAULT, SETTINGS_PLACEHOLDER
from tests.harness import alembic_check, alembic_downgrade, alembic_upgrade

COPY_COLUMNS = {"contact_promise", "footer_rights_line"}
COPY_CHECKS = {"ck_site_settings_contact_promise_length", "ck_site_settings_footer_rights_line_length"}


def _shape(connection: Connection) -> dict[str, Any]:
    inspector = inspect(connection)
    columns = {column["name"]: column for column in inspector.get_columns("site_settings")}
    checks = {check["name"] for check in inspector.get_check_constraints("site_settings")}
    return {"columns": columns, "checks": checks}


async def _run(url: str, statement: str, **params: Any) -> list[Any]:
    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            result = await connection.execute(text(statement), params)
            return list(result.all()) if result.returns_rows else []
    finally:
        await engine.dispose()


async def _shape_of(url: str) -> dict[str, Any]:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as connection:
            return await connection.run_sync(_shape)
    finally:
        await engine.dispose()


@pytest.mark.be_t("BE-T-110")
async def test_migration_0002_upgrade_check_downgrade_upgrade(db_settings: Settings, db_engine: AsyncEngine) -> None:
    url = db_settings.database_url.get_secret_value()
    await db_engine.dispose()
    try:
        alembic_downgrade(url, "0001_initial_schema")
        at_0001 = await _shape_of(url)
        assert COPY_COLUMNS.isdisjoint(at_0001["columns"])
        await _run(
            url,
            "UPDATE site_settings SET contact_email = :email, footer_signoff = :signoff",
            email="custom@example.com",
            signoff="Custom sign-off",
        )
        other_before = await _run(
            url, "SELECT contact_email, footer_signoff, booking_url, social_links FROM site_settings"
        )

        alembic_upgrade(url, "head")
        upgraded = await _shape_of(url)
        for column in COPY_COLUMNS:
            assert upgraded["columns"][column]["nullable"] is False
        assert upgraded["checks"] >= COPY_CHECKS
        rows = await _run(url, "SELECT contact_promise, footer_rights_line FROM site_settings")
        assert rows == [(CONTACT_PROMISE_DEFAULT, FOOTER_RIGHTS_LINE_DEFAULT)]
        assert "you're" in rows[0][0]  # apostrophe intact
        other_after = await _run(
            url, "SELECT contact_email, footer_signoff, booking_url, social_links FROM site_settings"
        )
        assert other_after == other_before
        with pytest.raises(Exception, match="ck_site_settings_contact_promise_length"):
            await _run(url, "UPDATE site_settings SET contact_promise = '   '")

        alembic_check(url)

        alembic_downgrade(url, "0001_initial_schema")
        downgraded = await _shape_of(url)
        assert COPY_COLUMNS.isdisjoint(downgraded["columns"])
        assert COPY_CHECKS.isdisjoint(downgraded["checks"])
        assert set(downgraded["columns"]) == set(at_0001["columns"])
        assert downgraded["checks"] == at_0001["checks"]

        alembic_upgrade(url, "head")
        assert (await _shape_of(url))["columns"].keys() >= COPY_COLUMNS
    finally:
        alembic_upgrade(url, "head")
        placeholder = SETTINGS_PLACEHOLDER
        await _run(
            url,
            "UPDATE site_settings SET contact_email = :email, footer_signoff = :signoff",
            email=placeholder["contact_email"],
            signoff=placeholder["footer_signoff"],
        )
        await db_engine.dispose()
