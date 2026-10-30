"""Settings copy fields: ``site_settings.contact_promise`` and ``site_settings.footer_rights_line`` (CHG-005).

Revision ID: 0002_settings_copy_fields
Revises: 0001_initial_schema
Create Date: 2026-10-30 05:15

TS-002 / TS-013 / tech-spec section 3.2. Both columns are ``text NOT NULL`` with a server default equal to the initial
copy, so ``ADD COLUMN ... NOT NULL DEFAULT '<text>'`` fills the existing singleton row in the same statement (no
separate data step). Each gets ``CHECK (length(btrim(col)) BETWEEN 1 AND 200)``. The server defaults stay in place
(the model declares the same ``server_default``). Downgrade drops both CHECKs and both columns, nothing else.

Frozen copy: this file never imports application code. ``tests/unit/test_migration_static.py`` checks that the texts
below equal ``app.models.singletons.CONTACT_PROMISE_DEFAULT`` / ``FOOTER_RIGHTS_LINE_DEFAULT``.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "0002_settings_copy_fields"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | None = None
depends_on: str | None = None

CONTACT_PROMISE_DEFAULT = "Tell me what you're working on. I reply to every enquiry within two working days."
FOOTER_RIGHTS_LINE_DEFAULT = "All rights reserved. Words, as always, are my own."

COPY_COLUMNS: tuple[tuple[str, str], ...] = (
    ("contact_promise", CONTACT_PROMISE_DEFAULT),
    ("footer_rights_line", FOOTER_RIGHTS_LINE_DEFAULT),
)


def _literal(value: str) -> str:
    # Constant text only (never input); the single quote in the contact promise becomes ''.
    return "'" + value.replace("'", "''") + "'"


def upgrade() -> None:
    for column, default in COPY_COLUMNS:
        op.add_column(
            "site_settings",
            sa.Column(column, sa.Text(), server_default=sa.text(_literal(default)), nullable=False),
        )
        op.create_check_constraint(
            op.f(f"ck_site_settings_{column}_length"),
            "site_settings",
            f"length(btrim({column})) BETWEEN 1 AND 200",
        )


def downgrade() -> None:
    for column, _default in reversed(COPY_COLUMNS):
        op.drop_constraint(op.f(f"ck_site_settings_{column}_length"), "site_settings", type_="check")
        op.drop_column("site_settings", column)
