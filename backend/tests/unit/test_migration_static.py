"""Static checks of migration ``0001_initial_schema`` against the models (BE-002) without a database.

The migration is rendered to SQL offline (``alembic upgrade head --sql``) and every table, index and named
constraint of ``Base.metadata`` must appear in it; the downgrade must drop every table. The live checks (upgrade /
downgrade cycle, ``alembic check``) are in ``tests/integration/test_migrations.py`` (BE-T-005, BE-T-006).
"""

from __future__ import annotations

import importlib.util
import io
import re

import pytest
from alembic import command
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, UniqueConstraint

from app.models import Base
from app.models.singletons import (
    CONTACT_PROMISE_DEFAULT,
    FOOTER_RIGHTS_LINE_DEFAULT,
    PROFILE_PLACEHOLDER,
    SETTINGS_PLACEHOLDER,
)
from tests.harness import BACKEND_DIR, alembic_config

OFFLINE_URL = "postgresql+asyncpg://offline:offline@localhost:5442/offline_render_test"


def _render(*, downgrade: bool = False) -> str:
    buffer = io.StringIO()
    config = alembic_config(OFFLINE_URL)
    config.output_buffer = buffer
    if downgrade:
        command.downgrade(config, "0001_initial_schema:base", sql=True)
    else:
        command.upgrade(config, "head", sql=True)
    return buffer.getvalue()


@pytest.fixture(scope="module")
def upgrade_sql() -> str:
    return _render()


@pytest.mark.be_t("BE-T-005")
def test_migration_offline_sql_creates_every_model_table_index_and_constraint(upgrade_sql: str) -> None:
    for table in Base.metadata.sorted_tables:
        assert re.search(rf"CREATE TABLE {table.name} \(", upgrade_sql), table.name
        for index in table.indexes:
            assert f"INDEX {index.name} ON {table.name}" in upgrade_sql, index.name
        for constraint in table.constraints:
            if isinstance(constraint, CheckConstraint | UniqueConstraint | ForeignKeyConstraint):
                assert f"CONSTRAINT {constraint.name} " in upgrade_sql, constraint.name


def test_migration_offline_sql_has_spec_details(upgrade_sql: str) -> None:
    assert "CREATE UNIQUE INDEX uq_admin_users_single_admin ON admin_users ((true))" in upgrade_sql
    assert "CREATE UNIQUE INDEX uq_admin_users_lower_email ON admin_users (lower(email))" in upgrade_sql
    assert "ON case_studies (position) WHERE is_featured AND is_published" in upgrade_sql
    assert "ON faqs (category_id, position) WHERE show_in_preview AND is_published" in upgrade_sql
    assert "ON enquiries (status, created_at DESC)" in upgrade_sql
    assert "CHECK (id = 1)" in upgrade_sql
    assert "CREATE TABLE core_values" in upgrade_sql
    assert "REFERENCES case_studies (id) ON DELETE SET NULL" in upgrade_sql
    assert "REFERENCES faq_categories (id) ON DELETE RESTRICT" in upgrade_sql
    assert upgrade_sql.count("INSERT INTO profile") == 1
    assert upgrade_sql.count("INSERT INTO site_settings") == 1
    assert "gen_random_uuid()" in upgrade_sql
    assert "CREATE EXTENSION" not in upgrade_sql


@pytest.mark.be_t("BE-T-005")
def test_migration_offline_downgrade_drops_every_table() -> None:
    downgrade_sql = _render(downgrade=True)
    for table in Base.metadata.sorted_tables:
        assert f"DROP TABLE {table.name};" in downgrade_sql, table.name


def test_migration_singleton_placeholders_equal_model_constants() -> None:
    path = BACKEND_DIR / "migrations" / "versions" / "0001_initial_schema.py"
    spec = importlib.util.spec_from_file_location("migration_0001", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.PROFILE_PLACEHOLDER == PROFILE_PLACEHOLDER
    assert module.SETTINGS_PLACEHOLDER == SETTINGS_PLACEHOLDER
    assert "example.com" in SETTINGS_PLACEHOLDER["contact_email"]


def _load_migration(file_name: str) -> object:
    path = BACKEND_DIR / "migrations" / "versions" / file_name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.be_t("BE-T-110")
def test_migration_0002_frozen_defaults_equal_model_constants() -> None:
    module = _load_migration("0002_settings_copy_fields.py")
    assert module.CONTACT_PROMISE_DEFAULT == CONTACT_PROMISE_DEFAULT  # type: ignore[attr-defined]
    assert module.FOOTER_RIGHTS_LINE_DEFAULT == FOOTER_RIGHTS_LINE_DEFAULT  # type: ignore[attr-defined]
    assert module.down_revision == "0001_initial_schema"  # type: ignore[attr-defined]


@pytest.mark.be_t("BE-T-110")
def test_migration_0002_offline_sql_escapes_quote_and_adds_checks(upgrade_sql: str) -> None:
    assert (
        "ALTER TABLE site_settings ADD COLUMN contact_promise TEXT DEFAULT "
        "'Tell me what you''re working on. I reply to every enquiry within two working days.' NOT NULL"
    ) in upgrade_sql
    assert (
        "ALTER TABLE site_settings ADD COLUMN footer_rights_line TEXT DEFAULT "
        "'All rights reserved. Words, as always, are my own.' NOT NULL"
    ) in upgrade_sql
    assert "CHECK (length(btrim(contact_promise)) BETWEEN 1 AND 200)" in upgrade_sql
    assert "CHECK (length(btrim(footer_rights_line)) BETWEEN 1 AND 200)" in upgrade_sql


@pytest.mark.be_t("BE-T-110")
def test_migration_0002_offline_downgrade_drops_only_the_copy_fields() -> None:
    buffer = io.StringIO()
    config = alembic_config(OFFLINE_URL)
    config.output_buffer = buffer
    command.downgrade(config, "0002_settings_copy_fields:0001_initial_schema", sql=True)
    sql = buffer.getvalue()
    statements = [line for line in sql.splitlines() if line.startswith("ALTER TABLE")]
    assert statements == [
        "ALTER TABLE site_settings DROP CONSTRAINT ck_site_settings_footer_rights_line_length;",
        "ALTER TABLE site_settings DROP COLUMN footer_rights_line;",
        "ALTER TABLE site_settings DROP CONSTRAINT ck_site_settings_contact_promise_length;",
        "ALTER TABLE site_settings DROP COLUMN contact_promise;",
    ]
