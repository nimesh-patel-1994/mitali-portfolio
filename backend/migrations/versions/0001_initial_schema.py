"""Initial schema: content, singletons, enquiries, media, auth and rate limits (TS-002, tech-spec section 3).

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-10-29 17:20

Frozen copy of the schema: this file never imports application code. The singleton rows ``profile`` and
``site_settings`` (``id = 1``) are inserted with placeholders; ``tests/unit/test_migration_static.py`` checks they equal
``app.models.singletons.PROFILE_PLACEHOLDER`` / ``SETTINGS_PLACEHOLDER``.
"""

from __future__ import annotations

import json
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None

PROFILE_PLACEHOLDER: dict[str, Any] = {
    "name": "Your name",
    "headline": "Add your headline in the admin",
    "bio": ["Add a short bio in the admin."],
    "skills": [],
    "tools": [],
    "years_experience": None,
    "origin_statement": "Add your origin statement in the admin.",
    "vision_blocks": [
        {"heading": "Vision", "body": "Add your vision in the admin."},
        {"heading": "Mission", "body": "Add your mission in the admin."},
    ],
}

SETTINGS_PLACEHOLDER: dict[str, Any] = {
    "contact_email": "hello@example.com",
    "booking_url": None,
    "social_links": [],
    "footer_signoff": "Add a footer sign-off in the admin",
    "notification_email": None,
}


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admin_users")),
    )
    op.create_index("uq_admin_users_lower_email", "admin_users", [sa.literal_column("lower(email)")], unique=True)
    op.create_index("uq_admin_users_single_admin", "admin_users", [sa.literal_column("(true)")], unique=True)
    op.create_table(
        "core_values",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("char_length(body) <= 600", name=op.f("ck_core_values_body_length")),
        sa.CheckConstraint("char_length(title) <= 80", name=op.f("ck_core_values_title_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_core_values")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_core_values_seed_key")),
    )
    op.create_table(
        "engagement_models",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("features", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("cta_label", sa.Text(), server_default=sa.text("'Book a call'"), nullable=False),
        sa.Column("cta_target", sa.Text(), server_default=sa.text("'booking'"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "cta_target IN ('booking', 'contact')", name=op.f("ck_engagement_models_cta_target_allowed")
        ),
        sa.CheckConstraint("jsonb_typeof(features) = 'array'", name=op.f("ck_engagement_models_features_is_array")),
        sa.CheckConstraint("char_length(cta_label) <= 40", name=op.f("ck_engagement_models_cta_label_length")),
        sa.CheckConstraint("char_length(description) <= 600", name=op.f("ck_engagement_models_description_length")),
        sa.CheckConstraint("char_length(name) <= 80", name=op.f("ck_engagement_models_name_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_engagement_models")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_engagement_models_seed_key")),
    )
    op.create_table(
        "enquiries",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("company", sa.Text(), nullable=True),
        sa.Column("enquiry_type", sa.Text(), nullable=False),
        sa.Column("budget_range", sa.Text(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default=sa.text("'new'"), nullable=False),
        sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "budget_range IN ('under_1000', '1000_3000', '3000_7500', '7500_15000', 'over_15000', 'not_sure')",
            name=op.f("ck_enquiries_budget_range_allowed"),
        ),
        sa.CheckConstraint(
            "enquiry_type IN ('content_strategy', 'copywriting', 'seo_content', 'brand_messaging', 'campaign_planning', 'other')",
            name=op.f("ck_enquiries_enquiry_type_allowed"),
        ),
        sa.CheckConstraint("status IN ('new', 'replied', 'archived')", name=op.f("ck_enquiries_status_allowed")),
        sa.CheckConstraint("char_length(company) <= 120", name=op.f("ck_enquiries_company_length")),
        sa.CheckConstraint("char_length(email) <= 254", name=op.f("ck_enquiries_email_length")),
        sa.CheckConstraint("char_length(message) <= 5000", name=op.f("ck_enquiries_message_length")),
        sa.CheckConstraint("char_length(name) <= 120", name=op.f("ck_enquiries_name_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_enquiries")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_enquiries_seed_key")),
    )
    op.create_index("ix_enquiries_created_at", "enquiries", [sa.literal_column("created_at DESC")], unique=False)
    op.create_index(
        "ix_enquiries_status_created_at",
        "enquiries",
        ["status", sa.literal_column("created_at DESC")],
        unique=False,
    )
    op.create_table(
        "faq_categories",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("char_length(name) <= 80", name=op.f("ck_faq_categories_name_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faq_categories")),
        sa.UniqueConstraint("name", name=op.f("uq_faq_categories_name")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_faq_categories_seed_key")),
    )
    op.create_table(
        "media_assets",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("variants", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("mime", sa.Text(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.Text(), nullable=True),
        sa.Column("alt", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("jsonb_typeof(variants) = 'array'", name=op.f("ck_media_assets_variants_is_array")),
        sa.CheckConstraint("mime IN ('image/webp', 'image/svg+xml')", name=op.f("ck_media_assets_mime_allowed")),
        sa.CheckConstraint(
            "path ~ '^[A-Za-z0-9_][A-Za-z0-9_./-]*$' AND strpos(path, '..') = 0",
            name=op.f("ck_media_assets_path_relative"),
        ),
        sa.CheckConstraint("source IN ('upload', 'seed')", name=op.f("ck_media_assets_source_allowed")),
        sa.CheckConstraint("char_length(alt) <= 250", name=op.f("ck_media_assets_alt_length")),
        sa.CheckConstraint(
            "char_length(original_filename) <= 200", name=op.f("ck_media_assets_original_filename_length")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_media_assets")),
        sa.UniqueConstraint("path", name=op.f("uq_media_assets_path")),
    )
    op.create_index("ix_media_assets_created_at", "media_assets", [sa.literal_column("created_at DESC")], unique=False)
    op.create_table(
        "process_steps",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("char_length(body) <= 600", name=op.f("ck_process_steps_body_length")),
        sa.CheckConstraint("char_length(title) <= 80", name=op.f("ck_process_steps_title_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_process_steps")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_process_steps_seed_key")),
    )
    op.create_table(
        "rate_limit_counters",
        sa.Column("bucket", sa.Text(), nullable=False),
        sa.Column("key_hash", sa.Text(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("blocked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "bucket IN ('contact_ip', 'login_ip', 'login_account')",
            name=op.f("ck_rate_limit_counters_bucket_allowed"),
        ),
        sa.CheckConstraint("key_hash ~ '^[0-9a-f]{64}$'", name=op.f("ck_rate_limit_counters_key_hash_hex")),
        sa.PrimaryKeyConstraint("bucket", "key_hash", name=op.f("pk_rate_limit_counters")),
    )
    op.create_index("ix_rate_limit_counters_updated_at", "rate_limit_counters", ["updated_at"], unique=False)
    op.create_table(
        "services",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("deliverables", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("jsonb_typeof(deliverables) = 'array'", name=op.f("ck_services_deliverables_is_array")),
        sa.CheckConstraint("char_length(description) <= 600", name=op.f("ck_services_description_length")),
        sa.CheckConstraint("char_length(name) <= 80", name=op.f("ck_services_name_length")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_services")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_services_seed_key")),
    )
    op.create_index("ix_services_is_published_position", "services", ["is_published", "position"], unique=False)
    op.create_table(
        "site_settings",
        sa.Column("id", sa.SmallInteger(), server_default=sa.text("1"), autoincrement=False, nullable=False),
        sa.Column("contact_email", sa.Text(), nullable=False),
        sa.Column("booking_url", sa.Text(), nullable=True),
        sa.Column("social_links", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("footer_signoff", sa.Text(), nullable=False),
        sa.Column("notification_email", sa.Text(), nullable=True),
        sa.Column("content_changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("jsonb_typeof(social_links) = 'array'", name=op.f("ck_site_settings_social_links_is_array")),
        sa.CheckConstraint("char_length(footer_signoff) <= 120", name=op.f("ck_site_settings_footer_signoff_length")),
        sa.CheckConstraint("id = 1", name=op.f("ck_site_settings_singleton")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_site_settings")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_site_settings_seed_key")),
    )
    op.create_table(
        "case_studies",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("client_name", sa.Text(), nullable=False),
        sa.Column("client_industry", sa.Text(), nullable=False),
        sa.Column("campaign_type", sa.Text(), nullable=False),
        sa.Column("channels", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("goals", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("problem_md", sa.Text(), nullable=False),
        sa.Column("solution_md", sa.Text(), nullable=False),
        sa.Column("problem_html", sa.Text(), nullable=False),
        sa.Column("solution_html", sa.Text(), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("timeline", sa.Text(), nullable=False),
        sa.Column("cover_media_id", sa.UUID(), nullable=True),
        sa.Column("cover_alt", sa.Text(), nullable=True),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "cover_media_id IS NULL OR char_length(btrim(coalesce(cover_alt, ''))) > 0",
            name=op.f("ck_case_studies_cover_alt_required"),
        ),
        sa.CheckConstraint("jsonb_typeof(channels) = 'array'", name=op.f("ck_case_studies_channels_is_array")),
        sa.CheckConstraint("jsonb_typeof(goals) = 'array'", name=op.f("ck_case_studies_goals_is_array")),
        sa.CheckConstraint("slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name=op.f("ck_case_studies_slug_format")),
        sa.CheckConstraint("char_length(campaign_type) <= 60", name=op.f("ck_case_studies_campaign_type_length")),
        sa.CheckConstraint("char_length(client_industry) <= 80", name=op.f("ck_case_studies_client_industry_length")),
        sa.CheckConstraint("char_length(client_name) <= 120", name=op.f("ck_case_studies_client_name_length")),
        sa.CheckConstraint("char_length(slug) <= 80", name=op.f("ck_case_studies_slug_length")),
        sa.CheckConstraint("char_length(summary) <= 600", name=op.f("ck_case_studies_summary_length")),
        sa.CheckConstraint("char_length(timeline) <= 40", name=op.f("ck_case_studies_timeline_length")),
        sa.CheckConstraint("char_length(title) BETWEEN 1 AND 120", name=op.f("ck_case_studies_title_length")),
        sa.CheckConstraint("year BETWEEN 2000 AND 2100", name=op.f("ck_case_studies_year_range")),
        sa.ForeignKeyConstraint(
            ["cover_media_id"],
            ["media_assets.id"],
            name=op.f("fk_case_studies_cover_media_id_media_assets"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_case_studies")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_case_studies_seed_key")),
        sa.UniqueConstraint("slug", name=op.f("uq_case_studies_slug")),
    )
    op.create_index(
        "ix_case_studies_featured_position",
        "case_studies",
        ["position"],
        unique=False,
        postgresql_where=sa.text("is_featured AND is_published"),
    )
    op.create_index("ix_case_studies_is_published_position", "case_studies", ["is_published", "position"], unique=False)
    op.create_table(
        "faqs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("show_in_preview", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("char_length(answer) <= 2000", name=op.f("ck_faqs_answer_length")),
        sa.CheckConstraint("char_length(question) <= 200", name=op.f("ck_faqs_question_length")),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["faq_categories.id"],
            name=op.f("fk_faqs_category_id_faq_categories"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faqs")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_faqs_seed_key")),
    )
    op.create_index("ix_faqs_category_id_position", "faqs", ["category_id", "position"], unique=False)
    op.create_index(
        "ix_faqs_preview_category_id_position",
        "faqs",
        ["category_id", "position"],
        unique=False,
        postgresql_where=sa.text("show_in_preview AND is_published"),
    )
    op.create_table(
        "profile",
        sa.Column("id", sa.SmallInteger(), server_default=sa.text("1"), autoincrement=False, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("headline", sa.Text(), nullable=False),
        sa.Column("bio", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("skills", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("tools", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("years_experience", sa.SmallInteger(), nullable=True),
        sa.Column("origin_statement", sa.Text(), nullable=False),
        sa.Column("vision_blocks", postgresql.JSONB(), nullable=False),
        sa.Column("portrait_media_id", sa.UUID(), nullable=True),
        sa.Column("portrait_alt", sa.Text(), nullable=True),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "CASE WHEN jsonb_typeof(vision_blocks) = 'array' THEN jsonb_array_length(vision_blocks) = 2 ELSE false END",
            name=op.f("ck_profile_vision_blocks_two"),
        ),
        sa.CheckConstraint("jsonb_typeof(bio) = 'array'", name=op.f("ck_profile_bio_is_array")),
        sa.CheckConstraint("jsonb_typeof(skills) = 'array'", name=op.f("ck_profile_skills_is_array")),
        sa.CheckConstraint("jsonb_typeof(tools) = 'array'", name=op.f("ck_profile_tools_is_array")),
        sa.CheckConstraint(
            "portrait_media_id IS NULL OR char_length(btrim(coalesce(portrait_alt, ''))) > 0",
            name=op.f("ck_profile_portrait_alt_required"),
        ),
        sa.CheckConstraint("char_length(headline) <= 160", name=op.f("ck_profile_headline_length")),
        sa.CheckConstraint("char_length(origin_statement) <= 600", name=op.f("ck_profile_origin_statement_length")),
        sa.CheckConstraint("id = 1", name=op.f("ck_profile_singleton")),
        sa.CheckConstraint("years_experience BETWEEN 0 AND 60", name=op.f("ck_profile_years_experience_range")),
        sa.ForeignKeyConstraint(
            ["portrait_media_id"],
            ["media_assets.id"],
            name=op.f("fk_profile_portrait_media_id_media_assets"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_profile")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_profile_seed_key")),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("admin_user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("csrf_token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["admin_user_id"],
            ["admin_users.id"],
            name=op.f("fk_sessions_admin_user_id_admin_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sessions_token_hash")),
    )
    op.create_index("ix_sessions_absolute_expires_at", "sessions", ["absolute_expires_at"], unique=False)
    op.create_index("ix_sessions_admin_user_id", "sessions", ["admin_user_id"], unique=False)
    op.create_table(
        "writing_samples",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
        sa.Column("client_name", sa.Text(), nullable=True),
        sa.Column("industry", sa.Text(), nullable=True),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=False),
        sa.Column("word_count", sa.Integer(), nullable=False),
        sa.Column("reading_time_min", sa.SmallInteger(), nullable=False),
        sa.Column("published_on", sa.Date(), nullable=False),
        sa.Column("tags", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("thumbnail_media_id", sa.UUID(), nullable=True),
        sa.Column("thumbnail_alt", sa.Text(), nullable=True),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "format IN ('blog', 'web_copy', 'email', 'social', 'landing_page', 'newsletter')",
            name=op.f("ck_writing_samples_format_allowed"),
        ),
        sa.CheckConstraint("jsonb_typeof(tags) = 'array'", name=op.f("ck_writing_samples_tags_is_array")),
        sa.CheckConstraint("slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name=op.f("ck_writing_samples_slug_format")),
        sa.CheckConstraint(
            "thumbnail_media_id IS NULL OR char_length(btrim(coalesce(thumbnail_alt, ''))) > 0",
            name=op.f("ck_writing_samples_thumbnail_alt_required"),
        ),
        sa.CheckConstraint("char_length(excerpt) <= 600", name=op.f("ck_writing_samples_excerpt_length")),
        sa.CheckConstraint("char_length(slug) <= 80", name=op.f("ck_writing_samples_slug_length")),
        sa.CheckConstraint("char_length(title) BETWEEN 1 AND 120", name=op.f("ck_writing_samples_title_length")),
        sa.CheckConstraint("reading_time_min >= 1", name=op.f("ck_writing_samples_reading_time_min_positive")),
        sa.CheckConstraint("word_count >= 0", name=op.f("ck_writing_samples_word_count_non_negative")),
        sa.ForeignKeyConstraint(
            ["thumbnail_media_id"],
            ["media_assets.id"],
            name=op.f("fk_writing_samples_thumbnail_media_id_media_assets"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_writing_samples")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_writing_samples_seed_key")),
        sa.UniqueConstraint("slug", name=op.f("uq_writing_samples_slug")),
    )
    op.create_index(
        "ix_writing_samples_is_published_format_position",
        "writing_samples",
        ["is_published", "format", "position"],
        unique=False,
    )
    op.create_index(
        "ix_writing_samples_is_published_position",
        "writing_samples",
        ["is_published", "position"],
        unique=False,
    )
    op.create_table(
        "case_study_images",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("case_study_id", sa.UUID(), nullable=False),
        sa.Column("media_id", sa.UUID(), nullable=False),
        sa.Column("alt", sa.Text(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("layout", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("layout IN ('full', 'half')", name=op.f("ck_case_study_images_layout_allowed")),
        sa.CheckConstraint("char_length(alt) <= 250", name=op.f("ck_case_study_images_alt_length")),
        sa.CheckConstraint("char_length(btrim(alt)) > 0", name=op.f("ck_case_study_images_alt_not_blank")),
        sa.CheckConstraint("char_length(caption) <= 200", name=op.f("ck_case_study_images_caption_length")),
        sa.ForeignKeyConstraint(
            ["case_study_id"],
            ["case_studies.id"],
            name=op.f("fk_case_study_images_case_study_id_case_studies"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["media_id"],
            ["media_assets.id"],
            name=op.f("fk_case_study_images_media_id_media_assets"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_case_study_images")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_case_study_images_seed_key")),
    )
    op.create_index(
        "ix_case_study_images_case_study_id_position",
        "case_study_images",
        ["case_study_id", "position"],
        unique=False,
    )
    op.create_table(
        "case_study_results",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("case_study_id", sa.UUID(), nullable=False),
        sa.Column("metric_label", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("before_value", sa.Text(), nullable=True),
        sa.Column("change_text", sa.Text(), nullable=True),
        sa.Column("period", sa.Text(), nullable=True),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("char_length(before_value) <= 30", name=op.f("ck_case_study_results_before_value_length")),
        sa.CheckConstraint("char_length(change_text) <= 30", name=op.f("ck_case_study_results_change_text_length")),
        sa.CheckConstraint("char_length(metric_label) <= 80", name=op.f("ck_case_study_results_metric_label_length")),
        sa.CheckConstraint("char_length(period) <= 40", name=op.f("ck_case_study_results_period_length")),
        sa.CheckConstraint("char_length(value) <= 30", name=op.f("ck_case_study_results_value_length")),
        sa.ForeignKeyConstraint(
            ["case_study_id"],
            ["case_studies.id"],
            name=op.f("fk_case_study_results_case_study_id_case_studies"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_case_study_results")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_case_study_results_seed_key")),
    )
    op.create_index(
        "ix_case_study_results_case_study_id_position",
        "case_study_results",
        ["case_study_id", "position"],
        unique=False,
    )
    op.create_table(
        "testimonials",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("author_name", sa.Text(), nullable=False),
        sa.Column("author_role", sa.Text(), nullable=False),
        sa.Column("company", sa.Text(), nullable=False),
        sa.Column("case_study_id", sa.UUID(), nullable=True),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("seed_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("char_length(author_name) <= 80", name=op.f("ck_testimonials_author_name_length")),
        sa.CheckConstraint("char_length(author_role) <= 80", name=op.f("ck_testimonials_author_role_length")),
        sa.CheckConstraint("char_length(company) <= 120", name=op.f("ck_testimonials_company_length")),
        sa.CheckConstraint("char_length(quote) <= 600", name=op.f("ck_testimonials_quote_length")),
        sa.ForeignKeyConstraint(
            ["case_study_id"],
            ["case_studies.id"],
            name=op.f("fk_testimonials_case_study_id_case_studies"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_testimonials")),
        sa.UniqueConstraint("seed_key", name=op.f("uq_testimonials_seed_key")),
    )
    # ### end Alembic commands ###

    _insert_singletons()


def _insert_singletons() -> None:
    """Insert the two singleton rows. JSON values are cast explicitly so online and ``--sql`` modes both work."""
    for table_name, values in (("profile", PROFILE_PLACEHOLDER), ("site_settings", SETTINGS_PLACEHOLDER)):
        columns = [sa.column("id", sa.SmallInteger())]
        row: dict[str, Any] = {"id": 1}
        for key, value in values.items():
            if value is None:
                # Omitted so the column takes its NULL default; a typed NULL literal would be bound as VARCHAR.
                continue
            if isinstance(value, list | dict):
                columns.append(sa.column(key, postgresql.JSONB()))
                row[key] = sa.cast(sa.literal(json.dumps(value), sa.Text()), postgresql.JSONB())
            elif isinstance(value, int):
                columns.append(sa.column(key, sa.SmallInteger()))
                row[key] = value
            else:
                columns.append(sa.column(key, sa.Text()))
                row[key] = value
        op.execute(sa.table(table_name, *columns).insert().values(**row))


def downgrade() -> None:
    # Children before parents; dropping a table drops its indexes and constraints.
    op.drop_table("testimonials")
    op.drop_table("case_study_results")
    op.drop_table("case_study_images")
    op.drop_table("writing_samples")
    op.drop_table("sessions")
    op.drop_table("profile")
    op.drop_table("faqs")
    op.drop_table("case_studies")
    op.drop_table("site_settings")
    op.drop_table("services")
    op.drop_table("rate_limit_counters")
    op.drop_table("process_steps")
    op.drop_table("media_assets")
    op.drop_table("faq_categories")
    op.drop_table("enquiries")
    op.drop_table("engagement_models")
    op.drop_table("core_values")
    op.drop_table("admin_users")
