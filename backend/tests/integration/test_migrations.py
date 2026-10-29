"""Migration cycle and drift check on the test database: BE-T-005, BE-T-006 (marked ``db`` automatically)."""

from __future__ import annotations

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.config import Settings
from app.models import Base
from tests.harness import alembic_check, alembic_downgrade, alembic_upgrade

APP_TABLES = {table.name for table in Base.metadata.sorted_tables}
APP_INDEXES = {index.name for table in Base.metadata.sorted_tables for index in table.indexes}


def _snapshot(connection: Connection) -> dict[str, object]:
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    indexes = {index["name"] for table in tables for index in inspector.get_indexes(table)}
    return {"tables": tables, "indexes": indexes}


async def _state(url: str) -> dict[str, object]:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as connection:
            snapshot = await connection.run_sync(_snapshot)
            if "profile" in snapshot["tables"]:  # type: ignore[operator]
                snapshot["profile_rows"] = (await connection.execute(text("SELECT count(*) FROM profile"))).scalar()
                snapshot["settings_rows"] = (
                    await connection.execute(text("SELECT count(*) FROM site_settings"))
                ).scalar()
            return snapshot
    finally:
        await engine.dispose()


@pytest.mark.be_t("BE-T-005")
async def test_migrations_downgrade_upgrade_cycle_succeeds(db_settings: Settings, db_engine: AsyncEngine) -> None:
    url = db_settings.database_url.get_secret_value()
    await db_engine.dispose()  # no pooled connection may hold locks or cached plans on the dropped tables
    try:
        for _ in range(2):
            alembic_downgrade(url, "base")
            empty = await _state(url)
            assert APP_TABLES.isdisjoint(empty["tables"])  # type: ignore[arg-type]

            alembic_upgrade(url, "head")
            full = await _state(url)
            assert full["tables"] >= APP_TABLES  # type: ignore[operator]
            assert full["indexes"] >= APP_INDEXES  # type: ignore[operator]
            assert full["profile_rows"] == 1
            assert full["settings_rows"] == 1
    finally:
        alembic_upgrade(url, "head")
        await db_engine.dispose()


@pytest.mark.be_t("BE-T-006")
def test_alembic_check_reports_no_drift(db_settings: Settings, migrated_database: str) -> None:
    alembic_check(migrated_database)
