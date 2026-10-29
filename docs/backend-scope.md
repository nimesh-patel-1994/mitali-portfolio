# Backend Scope of Work — mitali-portfolio

> What the backend builder must deliver. Stack comes from the `SystemDesign.md` header (backend `python-fastapi`,
> database `postgresql`, auth `session-cookie`, mobile `none`, cloud `none`, ci `none`); coding standards come from the
> `stack-python-fastapi` and `stack-postgresql` profiles, with the recorded deviations SD-006 (local test database
> `mitali_portfolio_test` on port 5442, no Testcontainers) and SD-007 (server-side session cookie + CSRF, no OAuth2/JWT).
> Design detail lives in `tech-spec.md` (TS-001..TS-019) and `api-contract.yaml`; this document does not repeat it.
> Owned by the `backend-scope` skill. Status tags follow `status-tracker`: `ID [STATUS YYYY-MM-DD HH:MM]`.
> Security checks for the backend are added by `security-guidelines` in `security.md` (section "Backend"); the review
> items below are functional and structural only.
> `mobile` is `none`: no app-version backward-compatibility items are required. The contract is still kept stable
> because the frontend client is generated from it (BE-REV-004).

## 1. Scope items

All paths are relative to `backend/` unless stated. "Done when" always includes: `ruff check`, `ruff format --check`,
`mypy --strict app` clean and the linked BE-T scenarios passing.

### Foundation

- BE-001 [NEW 2026-10-29 16:06] Project skeleton, dependencies and configuration
  - Implements: REQ-072, REQ-NFR-006, REQ-NFR-008, TS-001
  - Files/modules expected: `pyproject.toml`, `uv.lock` (Python 3.12; dependencies of SD-001, SD-011 and TS-001:
    fastapi, pydantic v2, pydantic-settings, sqlalchemy[asyncio] 2.0, asyncpg, alembic, argon2-cffi, Pillow, defusedxml,
    markdown-it-py, nh3, python-multipart, email-validator; dev: pytest, pytest-asyncio, pytest-cov, httpx, ruff, mypy,
    pip-audit, bandit), `.env.example`, `alembic.ini`, `app/__init__.py`, `app/main.py` (`create_app()`),
    `app/core/config.py` (`Settings` with every key listed in TS-001, `APP_ENV` enum development|test|production),
    `app/db.py` (async engine + `async_sessionmaker`, pool size 5), `app/api/deps.py` (`get_db`, `client_ip`), empty
    package folders `api/routers/public`, `api/routers/admin`, `schemas`, `models`, `services`, `repositories`, `seed`,
    `tests/unit`, `tests/integration`; root `.gitignore` entries of TS-001 (verify, do not duplicate).
  - Done when: `uv sync` installs from the lockfile; `uv run fastapi dev app/main.py` starts on port 8000 with a valid
    `.env`; a missing `DATABASE_URL` or unreachable database makes startup fail with one clear message (no stack trace
    with credentials); `.env.example` holds every `Settings` key with placeholder values only; no `os.environ` access
    outside `core/config.py`; all dependencies are open source (REQ-NFR-008).

- BE-002 [NEW 2026-10-29 16:06] Data model and initial migration
  - Implements: REQ-002, REQ-004, REQ-006, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-020, REQ-021, REQ-023,
    REQ-030, REQ-031, REQ-040, REQ-041, REQ-042, REQ-043, REQ-052, REQ-060, REQ-061, REQ-063, REQ-064, REQ-065, REQ-066,
    REQ-067, REQ-NFR-005, TS-002
  - Files/modules expected: `app/models/` (`base.py` with naming convention for constraints and the common
    `id`/`created_at`/`updated_at` mixin, `content.py`, `faq.py`, `singletons.py`, `enquiry.py`, `media.py`, `auth.py`),
    `migrations/env.py` (async, reads `Settings`), `migrations/versions/0001_initial_schema.py`.
  - Done when: every table, column, constraint, index and FK action of tech-spec section 3 exists exactly as specified
    (`core_values` table name, single-admin unique index on `((true))`, `lower(email)` unique index, partial indexes,
    `jsonb` array CHECKs, singleton `CHECK (id = 1)` rows for `profile` and `site_settings` inserted with placeholders);
    `alembic upgrade head` works on an empty database and `alembic downgrade base` removes everything; the offline SQL
    (`alembic upgrade head --sql`) has been reviewed; `alembic check` reports no drift between models and migration.

- BE-003 [NEW 2026-10-29 16:06] Error envelope, exception handlers, pagination and request-size limits
  - Implements: REQ-042, REQ-065, REQ-066, REQ-NFR-005, TS-003
  - Files/modules expected: `app/core/errors.py` (`AppError(status, code, message, fields=None)` plus named subclasses or
    factories for every code in the contract's `Error.code` enum; handlers for `AppError`, `RequestValidationError`,
    `HTTPException`, `IntegrityError` fallback and catch-all), `app/schemas/common.py` (`ErrorEnvelope`, `Page[T]`,
    `PageParams`, `OrderRequest`), `app/core/limits.py` (body-size middleware: 1 MB JSON, media route 10 MB + 64 KB).
  - Done when: every non-2xx response, including 404 for unknown routes and 405, has the envelope
    `{ "error": { "code", "message", "fields"? } }`; validation `fields` keys are dotted paths without the `body.` /
    `query.` prefix; 500 responses carry a generic message and the request id only; pagination follows TS-003 point 3.

- BE-004 [NEW 2026-10-29 16:06] Middleware: request id, structured logging, Origin check, security headers
  - Implements: REQ-060, REQ-NFR-005, TS-003
  - Files/modules expected: `app/core/logging.py` (JSON formatter, `request_id` contextvar), `app/core/middleware.py`
    (request id + access log, Origin/Referer check for non-GET `/api/admin/*`), `app/core/headers.py` (CSP and the header
    set of TS-003 point 9; `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store` on `/api/admin/*`).
  - Done when: each request logs one JSON line (request id, method, route template, status, duration ms) and nothing from
    bodies, cookies, `X-CSRF-Token`, passwords or enquiry fields; `X-Request-ID` is returned; non-GET admin requests whose
    `Origin` (or `Referer` origin) is missing or not in `ALLOWED_ORIGINS` get 403 `origin_rejected`; no CORS middleware is
    installed; the final header values are aligned with `security.md` once it exists.

- BE-005 [NEW 2026-10-29 16:06] Health endpoint and `/media` static serving
  - Implements: REQ-071, REQ-NFR-004, REQ-NFR-006, TS-001, TS-003
  - Files/modules expected: `app/api/routers/public/health.py` (`getHealth`), `app/core/static.py` (`MediaFiles`, a
    `StaticFiles` subclass adding headers per TS-003 point 7).
  - Done when: `GET /api/health` returns 200 `{status: ok, database: ok}` after `SELECT 1`, or 503
    `service_unavailable` when the database is unreachable; `/media/uploads/*` is served with `nosniff` and
    `max-age=31536000, immutable`, `/media/seed/*` with `max-age=3600`, every `.svg` with the sandbox CSP; traversal
    attempts and the `tmp/` folder are never served (404).

### Public API

- BE-006 [NEW 2026-10-29 16:06] Public read-only content API
  - Implements: REQ-002, REQ-004, REQ-006, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-020, REQ-021, REQ-022,
    REQ-023, REQ-030, REQ-031, REQ-040, REQ-041, REQ-050, TS-004
  - Operations: `getPublicSite`, `listPublicCaseStudies`, `getPublicCaseStudy`, `listPublicWritingSamples`,
    `getPublicWritingSample`, `listPublicServices`, `listPublicEngagementModels`, `listPublicTestimonials`,
    `listPublicFaqGroups`, `listPublicFaqPreview`, `listPublicValues`, `listPublicProcessSteps`.
  - Files/modules expected: `app/api/routers/public/{site,case_studies,writing_samples,services,engagement_models,
    testimonials,faqs,values,process_steps}.py`, `app/services/content_public.py`, `app/services/image_refs.py`
    (`ImageRef` builder: root-relative `/media/...` URL, `srcset` from `variants`, alt from the usage),
    `app/repositories/*` (published-only queries with `selectinload`), `app/schemas/public.py`.
  - Done when: every query filters `is_published = true` and orders by `(position, created_at)`; `more_work` follows
    TS-004 point 2 (next 2 by position, wrapping); FAQ groups and preview follow TS-004 point 3; testimonial
    `case_study_slug` only when the linked case study is published; `getPublicSite` returns `generated_at` and never
    `notification_email`; `is_sample` flags are passed through; unknown/unpublished slug → 404 `not_found`; unknown
    `format` → 422; list endpoints run a fixed number of queries regardless of row count.

- BE-007 [NEW 2026-10-29 16:06] Contact enquiry endpoint and DB-backed rate limiter
  - Implements: REQ-042, REQ-043, REQ-NFR-005, TS-007
  - Operation: `createEnquiry`.
  - Files/modules expected: `app/api/routers/public/enquiries.py`, `app/schemas/enquiry.py` (`EnquiryCreate` with trimmed
    strings, `EmailStr`, enums, lengths, honeypot `website`), `app/services/enquiries.py`, `app/services/rate_limit.py`
    (`hit_fixed_window(bucket, raw_key, limit, window)` using one atomic `INSERT … ON CONFLICT … DO UPDATE … RETURNING`,
    keys = HMAC-SHA256 with `HASH_KEY_SECRET`; shared with BE-010), `app/repositories/enquiries.py`.
  - Done when: valid input → 201 `{received: true}` and one `enquiries` row with `status = 'new'`; invalid input → 422
    with `fields` and nothing stored or counted; honeypot non-empty → 201, nothing stored, counter incremented, log line
    "honeypot hit" without content; more than 5 counted submissions per client IP per 10 min → 429 `rate_limited` with
    `Retry-After`; no raw IP stored; no enquiry field logged.

### Admin authentication

- BE-008 [NEW 2026-10-29 16:06] Admin login, logout, me and server-side sessions
  - Implements: REQ-060, REQ-NFR-005, TS-008
  - Operations: `adminLogin`, `adminLogout`, `getAdminMe`.
  - Files/modules expected: `app/api/routers/admin/auth.py`, `app/services/auth.py`, `app/core/security.py`
    (`PasswordHasher` Argon2id with argon2-cffi defaults, module-level dummy hash for unknown emails, token generation with
    `secrets.token_urlsafe(32)`, SHA-256 hashing, `hmac.compare_digest`), `app/repositories/{admin_users,sessions}.py`,
    `app/schemas/auth.py`.
  - Done when: login follows TS-008 step 1 exactly (email normalised, verify in threadpool, identical 401 body for wrong
    email or password, rehash when needed, expired sessions of the admin removed, `last_login_at` set); cookies
    `mp_session` (`HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`, `Secure` when `SESSION_COOKIE_SECURE`) and
    `mp_csrf` (`SameSite=Strict; Path=/`, not HttpOnly) are set; only hashes of the tokens are stored; me returns
    `AdminSession` including `csrf_token`; logout deletes the session row, expires both cookies and returns 204.

- BE-009 [NEW 2026-10-29 16:06] Session and CSRF dependencies applied to every admin route
  - Implements: REQ-060, REQ-NFR-005, TS-008
  - Files/modules expected: `app/api/deps.py` (`get_current_admin`, `require_csrf`), `app/api/routers/admin/__init__.py`
    (one `APIRouter(prefix="/api/admin", dependencies=[Depends(get_current_admin)])` that all admin routers except auth
    login are included into; mutations add `Depends(require_csrf)` at router level for non-GET methods).
  - Done when: missing, unknown, idle-expired (8 h) or absolute-expired (7 d) session → 401 `unauthenticated` (expired row
    deleted); `last_seen_at` refreshed at most once per minute; every POST/PUT/PATCH/DELETE under `/api/admin` except
    login rejects a missing or mismatching `X-CSRF-Token` (header must equal `mp_csrf` cookie and hash to the session's
    `csrf_token_hash`, constant-time) with 403 `csrf_failed`; protection is deny-by-default (a new admin route is
    protected without per-route code).

- BE-010 [NEW 2026-10-29 16:06] Login throttle
  - Implements: REQ-061, TS-008, SD-010
  - Files/modules expected: `app/services/rate_limit.py` (functions `check_login_block`, `register_login_failure`,
    `reset_login_buckets`, `cleanup_old_counters`), used by `services/auth.py`.
  - Done when: buckets `login_ip` and `login_account` (HMAC keys) use a 15 min fixed window; the 5th failure in a bucket
    sets `blocked_until = now() + 15 min`; while either bucket is blocked every attempt, even with the correct password,
    gets 429 `too_many_attempts` "Too many attempts. Try again in 15 minutes." with `Retry-After`; success resets both
    buckets; rows older than 1 day are deleted opportunistically on login.

- BE-011 [NEW 2026-10-29 16:06] Admin CLI: `create-admin` and `reset-password`
  - Implements: REQ-062, TS-009
  - Files/modules expected: `app/cli.py` (`argparse` subcommands `create-admin`, `reset-password`, `seed`; `getpass`
    prompts twice; `--password-stdin` for tests), `app/services/auth.py` (`create_admin`, `reset_password`,
    `validate_password_policy`).
  - Done when: `uv run python -m app.cli create-admin --email <email>` creates the single admin only when none exists;
    the policy (12..128 chars, not equal to the email or its local part, case-insensitive) is enforced with a clear
    message and exit 1; `reset-password` updates the hash and `password_changed_at`, deletes all sessions of the admin and
    clears the `login_account` bucket; passwords are never accepted as arguments, echoed or logged; DB unreachable →
    clear message, exit 1.

### Admin content

- BE-012 [NEW 2026-10-29 16:06] Shared content services: ordering, publishing marker, slugs, sample flag
  - Implements: REQ-052, REQ-063, REQ-064, REQ-067, TS-010
  - Files/modules expected: `app/services/ordering.py` (`next_position(scope)`, `reorder(scope, ids)` with
    `SELECT … FOR UPDATE` on the scope and exact-set check → 422 `order_mismatch`), `app/services/publishing.py`
    (`touch(session)` sets `site_settings.content_changed_at = now()` in the caller's transaction), `app/services/slugs.py`
    (pattern + length validation, unique-violation → 409 `slug_taken` with `fields.slug`),
    `app/services/references.py` (media id and case-study id existence checks → 422 with the field path),
    `app/schemas/base.py` (`InputModel` with `extra="forbid"`, `str_strip_whitespace=True`).
  - Done when: create appends at `max(position) + 1` (0 when empty); reorder rewrites positions 0..n-1 in one
    transaction; `is_published` and `is_sample` are ordinary fields of the PUT inputs (REQ-067); every successful
    create/update/delete/reorder of content, profile or settings calls `touch()` in the same transaction, and enquiry
    changes and media uploads do not; `updated_at` is set by the service on update; `order` routes are registered before
    `/{id}` routes.

- BE-013 [NEW 2026-10-29 16:06] Admin CRUD: case studies with nested results and gallery images
  - Implements: REQ-063, REQ-067, REQ-023, TS-010, TS-012
  - Operations: `listAdminCaseStudies`, `createAdminCaseStudy`, `reorderAdminCaseStudies`, `getAdminCaseStudy`,
    `updateAdminCaseStudy`, `deleteAdminCaseStudy`, `createAdminCaseStudyResult`, `reorderAdminCaseStudyResults`,
    `updateAdminCaseStudyResult`, `deleteAdminCaseStudyResult`, `createAdminCaseStudyImage`,
    `reorderAdminCaseStudyImages`, `updateAdminCaseStudyImage`, `deleteAdminCaseStudyImage`.
  - Files/modules expected: `app/api/routers/admin/case_studies.py`, `app/services/case_studies.py`,
    `app/repositories/case_studies.py`, `app/schemas/case_study.py`.
  - Done when: list returns all items including unpublished in display order; `GET {id}` embeds ordered results and
    images; `problem_md`/`solution_md` are rendered and sanitized on save (BE-018); cover alt required when a cover media
    id is set, gallery alt required and non-blank, `layout` in `full|half`, referenced media must exist (422 with field
    path); duplicate slug → 409 `slug_taken`, nothing saved; nested item whose parent differs → 404; delete cascades
    results and images, sets linked testimonials' `case_study_id` to null, keeps media rows; results carry their own
    `is_sample`.

- BE-014 [NEW 2026-10-29 16:06] Admin CRUD: writing samples
  - Implements: REQ-064, REQ-067, REQ-031, REQ-030, TS-010, TS-012
  - Operations: `listAdminWritingSamples`, `createAdminWritingSample`, `reorderAdminWritingSamples`,
    `getAdminWritingSample`, `updateAdminWritingSample`, `deleteAdminWritingSample`.
  - Files/modules expected: `app/api/routers/admin/writing_samples.py`, `app/services/writing_samples.py`,
    `app/repositories/writing_samples.py`, `app/schemas/writing_sample.py`.
  - Done when: `body_html`, `word_count` and `reading_time_min` are computed from `body_md` on every save (read-only in
    the API); `format` limited to the six values; thumbnail alt required when a thumbnail is set; slug rules as BE-013.

- BE-015 [NEW 2026-10-29 16:06] Admin CRUD: services, engagement models, testimonials, values, process steps
  - Implements: REQ-064, REQ-012, REQ-013, REQ-015, REQ-040, TS-010
  - Operations: `list/create/reorder/get/update/delete` `AdminService(s)`, `AdminEngagementModel(s)`,
    `AdminTestimonial(s)`, `AdminValue(s)`, `AdminProcessStep(s)` (30 operations, see contract tag `admin-content`).
  - Files/modules expected: `app/api/routers/admin/{services,engagement_models,testimonials,values,process_steps}.py`,
    `app/services/simple_content.py` (one generic service parameterised by model, input schema and scope, so the five
    types share code), matching repositories and schemas.
  - Done when: each type supports the full CRUD + order pattern with field limits of tech-spec section 3; engagement
    `cta_target` in `booking|contact`; testimonial `case_study_id` must reference an existing case study (422
    `fields.case_study_id`) or be null; values are stored in `core_values` while the path stays `/values`.

- BE-016 [NEW 2026-10-29 16:06] Admin CRUD: FAQ categories and FAQs
  - Implements: REQ-064, REQ-006, REQ-041, TS-010
  - Operations: `listAdminFaqCategories`, `createAdminFaqCategory`, `reorderAdminFaqCategories`, `getAdminFaqCategory`,
    `updateAdminFaqCategory`, `deleteAdminFaqCategory`, `listAdminFaqs`, `createAdminFaq`, `reorderAdminFaqs`,
    `getAdminFaq`, `updateAdminFaq`, `deleteAdminFaq`.
  - Files/modules expected: `app/api/routers/admin/{faq_categories,faqs}.py`, `app/services/faqs.py`,
    `app/repositories/faqs.py`, `app/schemas/faq.py`.
  - Done when: deleting a category that still has FAQs → 409 `category_not_empty` "Move or delete the FAQs in this
    category first."; FAQ positions are scoped per category; reorder takes `{category_id, ids}`; moving an FAQ to another
    category appends it at the end of the target; `listAdminFaqs` orders by category position then FAQ position; unknown
    `category_id` → 422 `fields.category_id`; duplicate category name handled as stated in open question BQ-1.

- BE-017 [NEW 2026-10-29 16:06] Media upload pipeline
  - Implements: REQ-063, REQ-064, REQ-065, REQ-NFR-004, TS-011, SD-008
  - Operations: `uploadAdminMedia`, `listAdminMedia`, `deleteAdminMedia`.
  - Files/modules expected: `app/api/routers/admin/media.py`, `app/services/media/{upload.py,sniff.py,raster.py,svg.py,
    storage.py}`, `app/repositories/media.py`, `app/schemas/media.py`.
  - Done when: TS-011 steps 1-6 are implemented: early `Content-Length` reject and streamed byte count with abort at
    10 MB (413 `file_too_large`); type from magic bytes only (415 `unsupported_media_type`); raster decode, verify,
    40 MP limit, EXIF transpose, WebP variants 480/960/1600 (no upscaling), metadata stripped, original discarded, corrupt
    image → 422 `invalid_image`; SVG parsed with `defusedxml` and stripped per TS-011 step 4; files under
    `uploads/<yyyy>/<mm>/<uuid>…`; stored path relative and validated; Pillow and SVG work runs in the threadpool; temp
    files removed in `finally`; written files removed when the DB insert fails; list paginated newest first; delete
    refused with 409 `media_in_use` while referenced, otherwise row and files removed.

- BE-018 [NEW 2026-10-29 16:06] Markdown rendering, sanitization and preview endpoint
  - Implements: REQ-031, REQ-064, REQ-063, TS-012, SD-009
  - Operation: `previewAdminMarkdown`.
  - Files/modules expected: `app/services/markdown.py` (`render_markdown(md) -> RenderedMarkdown(html, word_count,
    reading_time_min)`; one module-level `MarkdownIt` instance and one `nh3` configuration), 
    `app/api/routers/admin/markdown.py`, `app/schemas/markdown.py`.
  - Done when: CommonMark with `html=False`, tables and strikethrough, `linkify` off; headings shifted one level;
    `nh3` allow-list exactly as TS-012 step 2 with `rel="noopener noreferrer nofollow"` on links and only
    `http`/`https`/`mailto` schemes; no `img`; `reading_time_min = max(1, ceil(words / 200))`; preview limited to
    100 000 characters (422 above); the same function is used by BE-013, BE-014, BE-023 and the preview.

### Admin site, enquiries, dashboard

- BE-019 [NEW 2026-10-29 16:06] Profile and site settings
  - Implements: REQ-065, REQ-002, REQ-004, REQ-014, REQ-040, TS-013
  - Operations: `getAdminProfile`, `updateAdminProfile`, `getAdminSettings`, `updateAdminSettings`.
  - Files/modules expected: `app/api/routers/admin/{profile,settings}.py`, `app/services/site.py`,
    `app/repositories/site.py`, `app/schemas/site.py`.
  - Done when: GET never 404s (migration rows); input validation per TS-013 (bio 1..6 paragraphs, list limits, exactly
    2 vision blocks, `booking_url` empty/null/`#`/absolute http(s), social links http(s) only, emails valid,
    portrait alt required with a portrait); invalid input → 422 with field errors and nothing saved (REQ-065);
    `content_changed_at` is read-only; both updates call `publishing.touch()`.

- BE-020 [NEW 2026-10-29 16:06] Enquiry management
  - Implements: REQ-066, REQ-NFR-005, TS-014
  - Operations: `listAdminEnquiries`, `getAdminEnquiry`, `updateAdminEnquiryStatus`, `deleteAdminEnquiry`.
  - Files/modules expected: `app/api/routers/admin/enquiries.py`, `app/services/enquiries.py` (admin part),
    `app/repositories/enquiries.py`.
  - Done when: list is paginated, newest first (`created_at DESC, id`), filterable by status using the
    `(status, created_at DESC)` index; status PATCH accepts any of the three values and sets `status_changed_at`;
    delete is a hard delete (204); no `touch()`; enquiry fields never appear in logs.

- BE-021 [NEW 2026-10-29 16:06] Admin dashboard and rebuild information
  - Implements: REQ-052, REQ-066, TS-015
  - Operation: `getAdminDashboard`.
  - Files/modules expected: `app/api/routers/admin/dashboard.py`, `app/services/dashboard.py`,
    `app/services/build_info.py` (reads `FRONTEND_DIST_DIR/build-info.json` off the event loop).
  - Done when: response contains `new_enquiries`, `content_changed_at`, `last_build` (or null when the file is missing or
    malformed, with a warning log for malformed), `needs_rebuild` (`last_build is null or content_changed_at >
    last_build.content_snapshot_at`), `rebuild_command` `"cd frontend; npm run build:site"` and per-type
    `{total, published}` counts, computed with a bounded number of queries.

### Serving, seed, setup, quality

- BE-022 [NEW 2026-10-29 16:06] Production-like serving of the pre-rendered frontend
  - Implements: REQ-001, REQ-022, REQ-050, REQ-051, REQ-NFR-004, TS-003
  - Files/modules expected: `app/core/frontend.py` (catch-all GET handler registered last, only when
    `SERVE_FRONTEND=true`).
  - Done when: TS-003 point 8 behaviour holds: file → served; directory → its `index.html`; `/admin` and `/admin/*` →
    `dist/admin/index.html` with `X-Robots-Tag: noindex, nofollow`; anything else → `dist/404.html` with status 404;
    trailing slash → 308 to the slash-less path; `build-info.json`, dot-files and paths escaping `dist` are never served
    (404); HTML `Cache-Control: no-cache`, `/assets/*` immutable; API and `/media` routes take precedence; with
    `SERVE_FRONTEND=false` unknown non-API paths return the JSON 404 envelope.

- BE-023 [NEW 2026-10-29 16:06] Seed command with generated SVG placeholders
  - Implements: REQ-070, REQ-071, REQ-023, TS-017
  - Files/modules expected: `app/seed/data.py` (original dummy content, fictional clients, `example.com` addresses,
    stable `seed_key`s), `app/seed/images.py` (standard library only, deterministic SVG templates, text escaped with
    `xml.sax.saxutils.escape`), `app/seed/runner.py` (`run_seed(reset: bool)`), `app/cli.py` `seed [--reset]`.
  - Done when: counts match TS-017 step 1 (6 case studies / 4 featured, 18 results, 6-8 images each, 12 writing samples /
    2 per format, 5 services, 3 engagement models, 5 testimonials, 4 FAQ categories, 16 FAQs / 6 preview, 4 values,
    4 process steps, profile, settings); 4 enquiries only when `APP_ENV == "development"`; case studies, results and
    writing samples `is_sample = true` and `is_published = true`; default run inserts missing rows only, `--reset`
    restores seed values, counts unchanged after repeated runs; SVGs written under `MEDIA_ROOT/seed/<kind>/` and
    registered in `media_assets` (`source = 'seed'`, upsert by path) with no external references (no `http`, no
    `xlink:href` to outside, no web fonts); one transaction ending with `publishing.touch()`; markdown via BE-018.

- BE-024 [NEW 2026-10-29 16:06] Database setup script (run by the user)
  - Implements: REQ-072, REQ-NFR-006, TS-018, SD-005
  - Files/modules expected: `scripts/setup_db.ps1`, `scripts/setup_db.sql`, `.env.example` (from BE-001).
  - Done when: the script matches TS-018 steps 1-6: psql called by full path
    `C:\Program Files\PostgreSQL\17\bin\psql.exe` with `-p 5442`; app-role password read with
    `Read-Host -AsSecureString` and passed only through the process-scoped `MP_APP_PASSWORD` (removed in `finally`);
    psql prompts for the superuser password itself; `setup_db.sql` is idempotent (role created or password updated,
    both databases created if missing with owner, `UTF8`, `template0`, connect revoked from `PUBLIC`, schema `public`
    owned by the role) and runs with `ON_ERROR_STOP=1`; the role is `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`;
    optional `.env` writing never overwrites without confirmation. **Agents never run this script, never ask for and
    never store the superuser password**; it is executed by the user (verification via BE-T-105/BE-T-106 afterwards).

- BE-025 [NEW 2026-10-29 16:06] Test harness and contract check
  - Implements: REQ-NFR-006, TS-019, SD-006
  - Files/modules expected: `tests/conftest.py` (session fixture: refuses to run unless the database name in
    `TEST_DATABASE_URL` ends in `_test`; `alembic upgrade head`; truncates all tables except the migration singletons and
    resets those to placeholders at session start; per-test connection-level transaction with
    `join_transaction_mode="create_savepoint"` rolled back; `httpx.AsyncClient` + `ASGITransport`; `admin_client`
    fixture with session cookie, `mp_csrf` cookie, `X-CSRF-Token` and an allowed `Origin`; `media_root` fixture on
    `tmp_path`; `frozen_now` helper that shifts DB timestamps instead of sleeping; `query_counter` fixture),
    `tests/factories.py`, `tests/fixtures/images/` (tiny JPEG/PNG/WebP/SVG samples generated in the fixture, plus a
    malicious SVG, a corrupt JPEG and a text file renamed `.png`), `scripts/check_contract.py`.
  - Done when: `uv run pytest --cov=app` passes against `mitali_portfolio_test` on port 5442 with no Docker;
    `uv run python scripts/check_contract.py` exits 0 (paths, methods, operationIds, status codes, schema property
    names and required lists match `docs/api-contract.yaml`); coverage target of section 5 met; `pip-audit` and
    `bandit -r app` free of high findings.

- BE-026 [NEW 2026-10-29 16:06] README backend sections
  - Implements: REQ-072, REQ-NFR-006, TS-001
  - Files/modules expected: root `README.md` (backend part only; the frontend builder adds its own part).
  - Done when: it documents, in order: prerequisites (Python 3.12, uv, PostgreSQL 17 on port 5442, no Docker), running
    `setup_db.ps1` (by the user), `uv sync`, `alembic upgrade head`, `create-admin`, `seed [--reset]`, dev run, test run
    (needs `mitali_portfolio_test`), production-like preview (`SERVE_FRONTEND=true`), `reset-password`, and a backup
    command `pg_dump -h localhost -p 5442 -U mitali_app -Fc mitali_portfolio > backup.dump` using the full psql bin path;
    no real credentials appear anywhere.

## 2. Coding standards

Base: `stack-python-fastapi` (layout, typing, Pydantic/ORM separation, DI, logging, validation commands) and
`stack-postgresql` (modelling, parameterised queries, migrations, least-privilege role). Project-specific additions:

1. **Layout.** Code lives in `backend/app/` as listed in TS-001. Routers under `api/routers/public/` and
   `api/routers/admin/` (one module per resource); business rules in `services/`; SQLAlchemy queries only in
   `repositories/`; Pydantic models only in `schemas/`; ORM models only in `models/`. CLI and seed call services, never
   repositories directly.
2. **Naming.** Python `snake_case`; schema classes `<Entity>Input`, `<Entity>Admin`, `<Entity>Public`, `<Entity>Summary`
   mirroring the contract component names so `check_contract.py` can compare them. Route functions are named after the
   contract `operationId` in snake case and declare `operation_id="<operationId>"` explicitly.
3. **Contract first.** Every route declares `response_model`, `status_code`, `responses` (error codes from the contract)
   and `operation_id`. Any deviation from `docs/api-contract.yaml` is a tech-spec change first; never edit the YAML from
   the backend side to match the code.
4. **Inputs.** All request bodies derive from `InputModel` (`extra="forbid"`, whitespace stripped). Inputs list exactly
   the editable fields; server-computed fields (`id`, `position`, `*_html`, `word_count`, `reading_time_min`,
   `content_changed_at`, `created_at`, `updated_at`) are never accepted. Length and pattern limits match tech-spec
   section 3 and the contract.
5. **Errors.** Services raise `AppError` subclasses with a contract code; routers never build error responses and never
   catch broad exceptions. `IntegrityError` is translated in the repository/service layer to the specific code
   (`slug_taken`, `category_not_empty`, `media_in_use`); an untranslated one becomes 500 via the catch-all.
6. **Transactions.** One `AsyncSession` per request from `get_db`; services own the transaction
   (`async with session.begin()`), so `publishing.touch()` and the content change commit together. No commits in
   repositories. Reorder uses `SELECT … FOR UPDATE`. The rate limiter uses a single upsert statement (no read-modify-write).
7. **Async rules.** No blocking I/O in `async def`: Argon2 hashing/verification, Pillow, `defusedxml`, file writes of
   uploads and reading `build-info.json` go through `run_in_threadpool` (or `anyio.to_thread`). Seed and CLI may be
   synchronous wrappers that call `asyncio.run`.
8. **Queries.** SQLAlchemy 2.0 `select()` style only; no raw SQL strings except in Alembic migrations, the rate-limit
   upsert (`sqlalchemy.dialects.postgresql.insert`) and the seed upserts. Relations loaded with `selectinload`; every
   list ordered explicitly by `(position, created_at)` or as the contract states.
9. **Time.** All timestamps `timestamptz`, produced by the database (`now()`) or `datetime.now(UTC)`; never naive
   datetimes. Tests shift stored timestamps rather than sleeping.
10. **Config and secrets.** Only `core/config.py` reads the environment. `HASH_KEY_SECRET`, `DATABASE_URL` and passwords are
    `SecretStr`. No secret, password or real personal data in code, fixtures, seed data or logs; seed uses fictional names
    and `example.com`.
11. **Logging.** `logging.getLogger(__name__)` with the JSON formatter; log event names and ids, never request bodies,
    cookies, tokens, passwords, emails, IP addresses or enquiry fields. Warnings for recoverable problems (malformed
    `build-info.json`, honeypot hit), errors only with the request id.
12. **Files.** All paths built from `Settings.media_root` / `Settings.frontend_dist_dir` with `pathlib`, resolved and
    checked to stay inside their root; generated names are UUIDs; client file names are never used as paths.
13. **Database access for agents.** Agents use only the app role from `backend/.env`; psql is called by its full path
    `C:\Program Files\PostgreSQL\17\bin\psql.exe -h localhost -p 5442`. Agents never request, read or store the
    PostgreSQL superuser password and never run `setup_db.ps1` (the user does, SD-005).
14. **Tests.** Names `test_<unit>_<scenario>_<expected>`; each test docstring or marker names its `BE-T-nnn` ID
    (`@pytest.mark.be_t("BE-T-042")`) so the tester can map results. Unit tests under `tests/unit` must not touch the
    database; integration tests under `tests/integration` use the fixtures of BE-025.

## 3. Technical flow

**Request lifecycle (API).**
1. Middleware (outermost first): request id → access log timer → body-size limit (413) → security headers → Origin
   check for non-GET `/api/admin/*` (403 `origin_rejected`).
2. Routing: `/api/health`, `/api/public/*`, `/api/admin/auth/*`, `/api/admin/*` (router-level `get_current_admin`, plus
   `require_csrf` on mutations), `/media/*` static, and (only with `SERVE_FRONTEND=true`) the frontend catch-all last.
3. Dependencies resolve: `get_db` (session), `client_ip`, `get_current_admin` (cookie → SHA-256 → session row → expiry
   checks → admin), `require_csrf` (header == cookie, hash == session `csrf_token_hash`).
4. FastAPI validates the body and query against the `InputModel`; failures go to the 422 handler.
5. The router calls one service function with typed arguments and returns its result (no logic, no DB access).
6. The service opens the transaction, applies business rules (slugs, alt-text rules, references, ordering, markdown
   rendering, `publishing.touch()`), calls repositories and raises `AppError` on rule violations.
7. Repositories run SQLAlchemy statements; integrity errors are translated into `AppError`s.
8. The response model serialises the result; exception handlers produce the error envelope for everything else.
9. Access log line written with status and duration.

**Write flow for admin content** (BE-012..BE-016, BE-019): validate input → check references (media, category, case
study) → render markdown (if any) → insert/update/delete with position rules → `touch()` → commit → return the
admin representation. A rebuilt site picks up the change (frontend `build:site`); the dashboard (BE-021) shows
`needs_rebuild` until then.

**Upload flow** (BE-017): size gate → stream to `MEDIA_ROOT/tmp` → sniff → threadpool processing (raster variants or
SVG sanitize) → move into `uploads/<yyyy>/<mm>/` → insert `media_assets` → commit (on failure remove written files) →
201; temp file removed in `finally`. The client then references the `media_id` in a content PUT/POST.

**Public flow** (BE-006): read-only GET → published-only repository queries → `ImageRef` mapping → response. Used by the
pre-renderer at build time and by Vite in development; the deployed public pages never call it at runtime except
`createEnquiry` (BE-007: validate → rate-limit upsert → honeypot check → insert → 201).

**Auth flow** (BE-008..BE-010): see tech-spec sequence diagram 4.3. CLI (BE-011) and seed (BE-023) bypass HTTP and call
the same services with their own session and transaction.

## 4. Code review guidelines
- BE-REV-001 Routers are thin: no SQLAlchemy imports, no queries, no business rules and no try/except in
  `app/api/routers/**`; logic is in `services/`, data access in `repositories/`.
- BE-REV-002 Every route declares `operation_id`, `response_model` (or 204), explicit `status_code` and its documented
  error `responses`; `scripts/check_contract.py` exits 0.
- BE-REV-003 Every route under `/api/admin` other than `adminLogin` is mounted on the protected admin router (session
  dependency), and every non-GET admin route has `require_csrf`; no per-route opt-out exists.
- BE-REV-004 No change to `docs/api-contract.yaml` was made by the builder; any needed change is raised as a tech-spec
  question. Field names and status codes in code match the contract (the generated frontend client depends on them).
- BE-REV-005 All request bodies inherit `InputModel` (`extra="forbid"`); no server-computed field is writable; Pydantic
  schemas and ORM models are separate classes (no `from_attributes` on input models, no `**body.model_dump()` straight
  into ORM constructors without the explicit field list).
- BE-REV-006 All errors use `AppError` codes from the contract enum; no bare `except`, no `except Exception` outside the
  catch-all handler and the CLI entry point; no new error codes without a tech-spec change.
- BE-REV-007 No blocking calls in `async def` paths: Argon2, Pillow, `defusedxml`, file I/O and `build-info.json` reads use
  the threadpool; no `time.sleep`.
- BE-REV-008 Transactions are owned by services; `publishing.touch()` is called in the same transaction for every content,
  profile and settings mutation (including reorder and delete), and not for enquiries or media.
- BE-REV-009 Public repository queries all filter `is_published = true` (and the parent's publish state for FAQs and
  testimonial links); none returns `notification_email`, enquiry data or admin data.
- BE-REV-010 Lists are explicitly ordered and use `selectinload` for relations; no N+1 (checked by the query-count tests);
  paginated lists respect `page_size ≤ 100`.
- BE-REV-011 Migration `0001_initial_schema` matches tech-spec section 3 exactly (names, types, CHECKs, FK actions,
  indexes, singleton rows); the offline SQL was read; `alembic check` shows no drift; downgrade works.
- BE-REV-012 Reorder implementations lock the scope (`FOR UPDATE`), verify the exact id set and rewrite 0..n-1; `/order`
  routes are declared before `/{id}` routes.
- BE-REV-013 Nested resources (results, images, FAQs in categories) verify the parent id on every read and write; a
  mismatching parent yields 404, never a cross-parent update.
- BE-REV-014 Markdown is rendered only through `services/markdown.render_markdown`; the stored `*_html` is never built any
  other way; the allow-list in code equals TS-012 step 2.
- BE-REV-015 Upload handling sniffs magic bytes (never trusts the filename or client content type), enforces the 10 MB and
  40 MP limits while streaming, stores only UUID-based relative paths, cleans temp files in `finally` and removes written
  files on DB failure.
- BE-REV-016 Logging: no request bodies, cookies, `X-CSRF-Token`, passwords, emails, IPs or enquiry fields in any log
  call (grep `logger.` and `print(` in `app/`); `print` only in `app/cli.py` for user messages.
- BE-REV-017 Configuration only via `core/config.py`; no `os.environ`/`os.getenv` elsewhere; secrets typed `SecretStr`;
  `.env.example` contains placeholders only and every `Settings` field.
- BE-REV-018 The CLI never accepts a password as an argument, never echoes it, enforces the policy in the service (shared
  with tests) and `reset-password` deletes sessions and clears the account throttle bucket.
- BE-REV-019 Seed: original fictional content only (no reference-site text, names, images or URLs; `example.com` emails);
  SVGs contain no external references; every row has a `seed_key`; enquiries only in development; idempotent upserts.
- BE-REV-020 `setup_db.ps1` never takes a password as a parameter, never writes the superuser password anywhere, clears
  `MP_APP_PASSWORD` in `finally`, uses the psql full path and port 5442; `setup_db.sql` is idempotent and grants no
  superuser or `CREATEDB` rights.
- BE-REV-021 Paths for media and frontend files are resolved with `pathlib` and checked to stay under their root; the
  frontend catch-all never serves `build-info.json`, dot-files or anything outside `dist`.
- BE-REV-022 Tests: every `BE-T-*` ID in section 5 maps to at least one test marked with it; the test session refuses to
  run against a database whose name does not end in `_test`; no test depends on wall-clock sleeps or on seeded data.
- BE-REV-023 Quality gates pass: `ruff check .`, `ruff format --check .`, `mypy --strict app`,
  `pytest --cov=app` (target met), `pip-audit`, `bandit -r app` (no high findings).
- Security items: see `security.md` sections 2 and 3 (`SEC-*`, `SEC-BE-*`). Security review items:
  - BE-REV-024 [NEW 2026-10-29 16:06] Auth: Argon2id parameters, dummy hash and rehash; CLI-only account changes; session
    token hashing, new token per login, cookie flags and the production `Secure` startup guard; throttle checked before
    Argon2 (SEC-BE-001, SEC-BE-002, SEC-BE-003, SEC-BE-006, SEC-002).
  - BE-REV-025 [NEW 2026-10-29 16:06] Attack surface: Origin check incl. login with exact `ALLOWED_ORIGINS`, JSON
    content type kept strict, deny-by-default admin router, GET-only public routers except `createEnquiry`, `/docs` and
    `/openapi.json` off outside development, `TrustedHostMiddleware`, no subprocess/shell use (SEC-BE-004, SEC-BE-005,
    SEC-BE-016, SEC-BE-017).
  - BE-REV-026 [NEW 2026-10-29 16:06] Input and personal data: control-character/NUL rejection, bound parameters only,
    honeypot and contact limit as specified, no trusted proxy headers, enquiry fields never logged or public
    (SEC-BE-007, SEC-BE-008, SEC-BE-009, SEC-011).
  - BE-REV-027 [NEW 2026-10-29 16:06] Files: magic-byte sniff, size and pixel caps with `DecompressionBombWarning` as
    error, metadata-free re-encode, allow-list SVG sanitiser, root confinement incl. Windows path forms
    (SEC-BE-010, SEC-BE-011, SEC-BE-012).
  - BE-REV-028 [NEW 2026-10-29 16:06] Content: single `render_markdown` + `nh3` allow-list; settings URLs http/https
    only with no userinfo; 308 redirect stays same-origin (SEC-BE-013, SEC-BE-014).
  - BE-REV-029 [NEW 2026-10-29 16:06] Headers, errors, logs, limits: header set exactly as the `security.md` SEC-010
    table per response type; `debug=False`; uvicorn access log and `Server` header off; audit event names only;
    `statement_timeout` set (SEC-010, SEC-BE-015, SEC-008, SEC-009, SEC-BE-018).
  - BE-REV-030 [NEW 2026-10-29 16:06] Secrets, setup and supply chain: `HASH_KEY_SECRET` length check, `.gitignore`
    covers `*.dump`/`*.backup` and TS-001 paths, README uses `--host 127.0.0.1` for `fastapi run`, superuser password
    never handled, `pip-audit`/`bandit` clean, seed/test safety (SEC-001, SEC-003, SEC-004, SEC-005, SEC-BE-019).

## 5. Unit and integration test scenarios
"U" = unit test (no database), "I" = integration test (test database, `httpx.AsyncClient`), "C" = CLI test
(subprocess or direct `main(argv)` call against the test database).

| ID | Type | Target | Scenario | Expected | Covers |
|----|------|--------|----------|----------|--------|
| BE-T-001 | U | `Settings` | All keys present in env | Values parsed: `ALLOWED_ORIGINS` list, `SERVE_FRONTEND` bool, secrets as `SecretStr` | BE-001 |
| BE-T-002 | U | `Settings` / startup | `DATABASE_URL` missing; `APP_ENV=staging` | Startup raises one clear configuration error naming the key; no secret in the message | BE-001 |
| BE-T-003 | I | app startup | Database port unreachable (URL pointing at a closed port) | Startup fails fast with "database unreachable on localhost:<port>" message; no credentials printed | BE-001 |
| BE-T-004 | U | `.env.example` | Compare keys with `Settings` fields | Same key set; values are placeholders (no real-looking password, secret ≥ placeholder marker) | BE-001, BE-024 |
| BE-T-005 | I | migration | `downgrade base` → `upgrade head` → `downgrade base` → `upgrade head` on the test DB | All succeed; tables, indexes and singleton rows exist after upgrade; nothing left after downgrade | BE-002 |
| BE-T-006 | I | migration | `alembic check` after upgrade | No differences between models and schema | BE-002 |
| BE-T-007 | I | constraints | Duplicate slug, slug `Bad Slug`, slug of 81 chars, `year` 1999, `cover_media_id` set with blank `cover_alt`, non-array `channels` | Each raises `IntegrityError` at the DB level | BE-002 |
| BE-T-008 | I | constraints | Insert a second `admin_users` row; insert `profile` row with `id = 2`; media `path` with `..` or leading `/` | Rejected by unique index / CHECK | BE-002 |
| BE-T-009 | I | FK actions | Delete case study with results, images and a linked testimonial; delete referenced media; delete FAQ category with FAQs | Results/images cascade; testimonial `case_study_id` null; media and category deletes raise (RESTRICT) | BE-002 |
| BE-T-010 | I | error handler | POST invalid body (missing field, wrong nested type `results.0.value`) | 422 `validation_error`, `fields` keys `name`, `results.0.value` (no `body.` prefix) | BE-003 |
| BE-T-011 | I | error handler | Route that raises an unexpected `RuntimeError`; unknown route; wrong method | 500 `internal_error` with generic message and no traceback; 404 `not_found` envelope; 405 envelope | BE-003 |
| BE-T-012 | I | body limit | JSON body of 1 MB + 1 byte to an admin PUT; exactly 1 MB | 413 `payload_too_large`; exactly 1 MB passes to validation | BE-003 |
| BE-T-013 | I | pagination | `page=0`, `page_size=0`, `page_size=101`, `page=999` on enquiries | 422, 422, 422, 200 with `items: []` and correct `total` | BE-003, BE-020 |
| BE-T-014 | I | Origin check | Admin POST with no Origin and no Referer; with `Origin: https://evil.example`; with Referer from an allowed origin; GET without Origin | 403 `origin_rejected`, 403, passes, passes | BE-004 |
| BE-T-015 | I | headers | GET public endpoint; GET admin endpoint | CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options` on both; admin also `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`; `X-Request-ID` present | BE-004 |
| BE-T-016 | I | logging | Capture logs during login (correct and wrong password), contact submission and a CSRF failure | Access lines present; no password, email, enquiry text, IP, cookie value or CSRF token in any record | BE-004, BE-007, BE-008 |
| BE-T-017 | I | `getHealth` | DB up; engine replaced by one pointing at a closed port | 200 `{status: ok, database: ok}`; 503 `service_unavailable` | BE-005 |
| BE-T-018 | I | `/media` | Upload variant, seed SVG, `/media/../.env`, `/media/%2e%2e/app/main.py`, `/media/tmp/x` | Upload: `nosniff` + immutable cache; SVG: sandbox CSP + 1 h cache; traversal and `tmp` → 404 | BE-005 |
| BE-T-019 | I | public lists | 3 case studies (positions 2, 0, 1; one unpublished) and same pattern for every other public list | Only published, ordered by position then `created_at` | BE-006 |
| BE-T-020 | I | `getPublicCaseStudy` | Unpublished slug; unknown slug | 404 `not_found` for both | BE-006 |
| BE-T-021 | I | `getPublicCaseStudy` | Detail with results and images out of insert order | Results and images ordered by position; `problem_html` returned; `is_sample` flags present | BE-006 |
| BE-T-022 | I | `more_work` | 1, 2, 3 and 5 published case studies; detail of the last by position | 0, 1, 2, 2 items; wraps to the first ones; never includes the current or unpublished items | BE-006 |
| BE-T-023 | I | `listPublicCaseStudies` | `featured=true` with featured unpublished and unfeatured published items | Only featured and published, ordered | BE-006 |
| BE-T-024 | I | `listPublicWritingSamples` | `format=email`; `format=video` | Only email samples; 422 `validation_error` | BE-006 |
| BE-T-025 | I | FAQ groups / preview | Unpublished category with published FAQs; published empty category; preview flags across 2 categories | Groups omit both categories; preview ordered by category position then FAQ position and excludes FAQs in unpublished categories | BE-006 |
| BE-T-026 | I | `listPublicTestimonials` | Testimonial linked to a published and one to an unpublished case study | `case_study_slug` set only for the published link | BE-006 |
| BE-T-027 | I | `getPublicSite` | Settings with `notification_email` set | Response has `generated_at`, profile, public settings; no `notification_email` key | BE-006 |
| BE-T-028 | I | `ImageRef` | Raster media with 3 variants; SVG media; usage alt vs. media default alt | `url` root-relative `/media/...`, `srcset` with 3 widths (empty for SVG), alt from the usage | BE-006 |
| BE-T-029 | I | query count | List case studies with 2 vs 10 rows (each with cover, results) | Same number of SQL statements | BE-006 |
| BE-T-030 | I | `createEnquiry` | Valid input including optional fields | 201 `{received: true}`; one row `status = 'new'` | BE-007 |
| BE-T-031 | I | `createEnquiry` | Missing name; malformed email; message 5001 chars; invalid `enquiry_type`; blank message after trim | 422 with `fields` for each; no row stored; counter not incremented | BE-007 |
| BE-T-032 | I | honeypot | `website` filled | 201 `{received: true}`; no row; counter incremented | BE-007 |
| BE-T-033 | I | contact rate limit | 5 valid submissions from one IP, then the 6th; 6th from another IP; window start shifted back 10 min then retry | 5 × 201, then 429 `rate_limited` with `Retry-After`; other IP 201; after window 201 | BE-007 |
| BE-T-034 | I | rate limiter | Inspect `rate_limit_counters` after submissions | `key_hash` is a 64-char hex HMAC; raw IP not stored anywhere | BE-007 |
| BE-T-035 | I | rate limiter | 10 concurrent submissions from one IP (`asyncio.gather`, separate sessions) | Exactly 5 accepted, 5 rejected with 429 | BE-007 |
| BE-T-036 | I | `createEnquiry` | Repository insert raises `OperationalError` (monkeypatched) | 500 `internal_error` envelope; no enquiry text in logs | BE-007 |
| BE-T-037 | I | `adminLogin` | Correct credentials (email in different case and with spaces) | 200 `AdminSession`; `mp_session` HttpOnly, SameSite=Strict, Path=/, Max-Age 604800, no Secure when flag false, Secure when true; `mp_csrf` not HttpOnly; DB holds only hashes; `last_login_at` set | BE-008 |
| BE-T-038 | I | `adminLogin` | Wrong password; unknown email | Both 401 `invalid_credentials` with identical bodies; Argon2 verify called once in both cases (spy) | BE-008 |
| BE-T-039 | I | `getAdminMe` | With valid cookie; without cookie; with a random token | 200 with `csrf_token`; 401 `unauthenticated`; 401 | BE-008, BE-009 |
| BE-T-040 | I | `adminLogout` | Logout, then `getAdminMe` and an admin PUT with the old cookie | 204 with both cookies expired; session row gone; then 401 | BE-008 |
| BE-T-041 | I | session expiry | `last_seen_at` 8 h 1 min ago; `absolute_expires_at` in the past; `last_seen_at` 30 s ago and 2 min ago | 401 and row deleted for both expired cases; 30 s: not updated; 2 min: updated | BE-009 |
| BE-T-042 | I | rehash | Admin hash created with weaker Argon2 parameters, then login | Login succeeds; stored hash now uses current parameters | BE-008 |
| BE-T-043 | I | CSRF | Admin PUT without header; header ≠ cookie; header = cookie but token belongs to another session; valid | 403 `csrf_failed` × 3; 200 | BE-009 |
| BE-T-044 | I | route protection | Iterate every route in `app.routes` under `/api/admin` except login: call without cookie; call non-GET with cookie but no CSRF | All 401 without cookie; all non-GET 403 `csrf_failed` without header (logout included) | BE-009 |
| BE-T-045 | I | login throttle | 5 wrong passwords for the admin email from IP A, then the correct password | 5 × 401, then 429 `too_many_attempts` with `Retry-After` | BE-010 |
| BE-T-046 | I | login throttle | 5 wrong attempts with 5 different emails from IP A, then the correct admin login from IP A; same from IP B | IP A 429; IP B 200 (unless account blocked) | BE-010 |
| BE-T-047 | I | login throttle | Block set; `blocked_until` shifted into the past; correct login | 200; both buckets reset | BE-010 |
| BE-T-048 | I | login throttle boundary | 4 wrong attempts, then correct, then 4 wrong again | No block at any point (counters reset by success) | BE-010 |
| BE-T-049 | I | counter cleanup | Counter rows with `updated_at` 2 days ago, then a login | Old rows deleted; recent rows kept | BE-010 |
| BE-T-050 | C | `create-admin` | Empty DB, 12-char password via `--password-stdin` | Exit 0; login with that password returns 200 | BE-011 |
| BE-T-051 | C | `create-admin` policy | 11 chars; 129 chars; equal to the email; equal to the local part in upper case | Exit 1 with reason; no row created | BE-011 |
| BE-T-052 | C | `create-admin` | Admin already exists | Exit 1 "an admin already exists"; row unchanged | BE-011 |
| BE-T-053 | C | `reset-password` | Two active sessions and a blocked `login_account` bucket; reset | Exit 0; sessions deleted (old cookies 401); bucket cleared; old password 401, new password 200; `password_changed_at` updated | BE-011 |
| BE-T-054 | C | CLI | DB unreachable; check captured stdout/stderr | Exit 1 with clear message; the password never appears in output | BE-011 |
| BE-T-055 | I | `createAdminCaseStudy` | Valid input into a scope with positions 0..2 | 201; `position = 3`; `problem_html` sanitized; `content_changed_at` advanced | BE-012, BE-013 |
| BE-T-056 | I | `createAdminCaseStudy` | Duplicate slug; slug `Hello World`; slug 81 chars | 409 `slug_taken` with `fields.slug`, nothing saved; 422; 422 | BE-012, BE-013 |
| BE-T-057 | I | `updateAdminCaseStudy` | Body containing `position`, `id`, `problem_html` or `content_changed_at` | 422 `validation_error` (extra fields forbidden); row unchanged | BE-012, BE-013 |
| BE-T-058 | I | case-study media | `cover_media_id` set with blank `cover_alt`; unknown `cover_media_id` | 422 `fields.cover_alt`; 422 `fields.cover_media_id` | BE-013 |
| BE-T-059 | I | `deleteAdminCaseStudy` | Case study with results, images, linked testimonial | 204; results and images gone; testimonial kept with null link; media rows and files kept; `content_changed_at` advanced | BE-013 |
| BE-T-060 | I | results | Create, update (`is_sample` false), delete a result; update a result via another case study's id | 201/200/204; cross-parent → 404 | BE-013 |
| BE-T-061 | I | images | Create image with blank alt; `layout: "wide"`; valid image | 422 `fields.alt`; 422 `fields.layout`; 201 | BE-013 |
| BE-T-062 | I | `getAdminCaseStudy` | Unpublished case study with results and images | 200 with embedded, ordered results and images; unknown id → 404 | BE-013 |
| BE-T-063 | I | sample flag | PUT case study with `is_sample: false`, PUT each result with `is_sample: false`; then public detail | Flags false in admin and public responses | BE-012, BE-013 |
| BE-T-064 | I | reorder | `reorderAdminCaseStudies` with the exact set; with one id missing; with an unknown id; with a duplicate id | 204 and positions 0..n-1 in the new order; 422 `order_mismatch` × 3 and no change | BE-012 |
| BE-T-065 | I | reorder nested | Reorder results / images of case study A with ids from case study B | 422 `order_mismatch`; nothing changed | BE-012, BE-013 |
| BE-T-066 | I | publish | Unpublish a published item via PUT; public list after | Item absent from the public list; `content_changed_at` advanced | BE-012, BE-006 |
| BE-T-067 | I | change marker | Create/update/delete/reorder content, update profile and settings; vs. change enquiry status and upload media | `content_changed_at` advances for the first group only | BE-012 |
| BE-T-068 | I | `createAdminWritingSample` | Markdown body with heading, list, link, raw `<script>` | `body_html` with `h2`, escaped script text, link with `rel="noopener noreferrer nofollow"`; `word_count` and `reading_time_min` correct | BE-014, BE-018 |
| BE-T-069 | I | writing samples | `format: "podcast"`; thumbnail id without alt; duplicate slug; delete | 422; 422 `fields.thumbnail_alt`; 409 `slug_taken`; 204 | BE-014 |
| BE-T-070 | I | simple types (parametrised × 5) | list, create, get, update, reorder, delete happy path for services, engagement models, testimonials, values, process steps | 200/201/200/200/204/204; positions and `content_changed_at` as specified | BE-015 |
| BE-T-071 | I | simple types (parametrised) | Field over its limit (e.g. `name` 81 chars, `quote` 601); unknown id GET/PUT/DELETE | 422 with field path; 404 `not_found` | BE-015 |
| BE-T-072 | I | engagement models / testimonials | `cta_target: "phone"`; testimonial with unknown `case_study_id` | 422 `fields.cta_target`; 422 `fields.case_study_id` | BE-015 |
| BE-T-073 | I | values | Create a value via `/api/admin/values` | Row in `core_values`; returned by `listPublicValues` when published | BE-015 |
| BE-T-074 | I | `deleteAdminFaqCategory` | Category with 1 FAQ; empty category | 409 `category_not_empty` with the TS-010 message; 204 | BE-016 |
| BE-T-075 | I | FAQs | Move FAQ to a category with positions 0..2 via PUT `category_id` | FAQ position 3 in the target; source scope keeps its order | BE-016 |
| BE-T-076 | I | `reorderAdminFaqs` | `{category_id, ids}` exact; ids including an FAQ of another category | 204; 422 `order_mismatch` | BE-016, BE-012 |
| BE-T-077 | I | FAQs | Unknown `category_id` on create; duplicate category name | 422 `fields.category_id`; behaviour per open question BQ-1 (default 422 `fields.name`) | BE-016 |
| BE-T-078 | I | `uploadAdminMedia` | Valid 2000 px JPEG with EXIF GPS and orientation 6 | 201; WebP variants 480/960/1600; rotation applied; no EXIF in outputs; original not kept; row `source = 'upload'` | BE-017 |
| BE-T-079 | I | `uploadAdminMedia` | 300 px PNG with alpha; WebP input | One variant at original width (no upscaling), alpha kept; WebP accepted | BE-017 |
| BE-T-080 | I | upload size | `Content-Length` 11 MB; chunked body exceeding 10 MB without a length header; exactly 10 MB | 413 `file_too_large` (early); 413 after streaming and temp file removed; 10 MB accepted | BE-017 |
| BE-T-081 | I | upload type | Text file named `photo.png`; GIF; PDF with `image/jpeg` content type | 415 `unsupported_media_type` for each | BE-017 |
| BE-T-082 | I | upload decode | Truncated JPEG; PNG declaring 50 MP | 422 `invalid_image`; 422 `invalid_image`; no files left in `uploads/` or `tmp/` | BE-017 |
| BE-T-083 | U | SVG sanitizer | SVG with `<script>`, `onload`, `foreignObject`, external `xlink:href`, `style="background:url(http://x)"`, `<!DOCTYPE` with entity | Script, handlers, foreignObject, external href and url() style removed; input with a DTD/entity fails the `defusedxml` parse and is rejected with 415 `unsupported_media_type` | BE-017 |
| BE-T-084 | I | upload storage failure | DB insert raises after files are written (monkeypatched); disk write raises `OSError` | 500 envelope; no orphan files under `uploads/` and `tmp/` | BE-017 |
| BE-T-085 | I | media list / delete | 25 uploads, `page_size=20`; delete media used as a cover; delete unused media | Newest first, `total=25`; 409 `media_in_use`; 204 and files removed | BE-017 |
| BE-T-086 | U | `render_markdown` | `# Title`, table, `~~del~~`, `[x](javascript:alert(1))`, `![img](http://x/a.png)`, raw `<iframe>` | `h2`, table tags, `del`; javascript link removed; no `img`; iframe escaped as text | BE-018 |
| BE-T-087 | U | `render_markdown` | Empty string; 1 word; 201 words | `reading_time_min` 1, 1, 2; word counts 0, 1, 201 | BE-018 |
| BE-T-088 | I | `previewAdminMarkdown` | 100 000 chars; 100 001 chars; without session | 200 same HTML as `render_markdown`; 422; 401 | BE-018 |
| BE-T-089 | I | profile / settings | GET on a fresh DB; valid PUT of each | 200 placeholders; 200 updated; `content_changed_at` advanced and not writable | BE-019 |
| BE-T-090 | I | `updateAdminSettings` | `contact_email: "not-an-email"`; `booking_url: "ftp://x"`; `booking_url: "javascript:alert(1)"`; social link `http://` vs `mailto:`; `booking_url: "#"` and null | 422 with field path and nothing saved for invalid ones; `#` and null accepted | BE-019 |
| BE-T-091 | I | `updateAdminProfile` | 7 bio paragraphs; 3 vision blocks; 31 skills; portrait id without alt; `years_experience` 61 | 422 for each with field path; nothing saved | BE-019 |
| BE-T-092 | I | `listAdminEnquiries` | 3 `new` and 1 `archived` with different `created_at`; filter `status=new`; no filter; `status=spam` | 3 items newest first; 4 items; 422 | BE-020 |
| BE-T-093 | I | enquiry status | PATCH `replied`, then `new`; PATCH `deleted`; unknown id | 200 with `status_changed_at` set; 422; 404 | BE-020 |
| BE-T-094 | I | `deleteAdminEnquiry` | Delete existing; delete again | 204; 404; `content_changed_at` unchanged | BE-020 |
| BE-T-095 | I | `getAdminDashboard` | No `build-info.json`; file with `content_snapshot_at` before and after `content_changed_at`; malformed JSON | `last_build` null + `needs_rebuild` true; true/false respectively; malformed → null + true + warning logged | BE-021 |
| BE-T-096 | I | `getAdminDashboard` | 2 new + 1 replied enquiries; published/unpublished items per type | `new_enquiries = 2`; correct `{total, published}` per type; `rebuild_command` exact string | BE-021 |
| BE-T-097 | I | frontend serving | Temp `dist` with `index.html`, `work/x/index.html`, `assets/a.js`, `404.html`, `admin/index.html`, `build-info.json`; requests `/`, `/work/x`, `/work/x/`, `/work/unknown`, `/admin/case-studies`, `/assets/a.js`, `/build-info.json`, `/../backend/.env` | 200; 200; 308 to `/work/x`; 404 with `404.html` body; admin shell with noindex header; immutable cache; 404; 404 | BE-022 |
| BE-T-098 | I | frontend serving | `SERVE_FRONTEND=false`, GET `/work`; with `true`, GET `/api/public/services` and `/media/...` | JSON 404 envelope; API and media routes still answered by their handlers | BE-022 |
| BE-T-099 | I | seed | `APP_ENV=development`, run seed on an empty DB | Counts per TS-017 (6/4 featured, 18, 6-8 per case study, 12/2 per format, 5, 3, 5, 4, 16/6 preview, 4, 4), 4 enquiries; case studies, results, writing samples `is_sample` and `is_published` true | BE-023 |
| BE-T-100 | I | seed idempotency | Run seed twice; edit a seeded title, run default seed, then `--reset` | Counts unchanged; edit kept after default run; restored after `--reset` | BE-023 |
| BE-T-101 | I | seed environment | `APP_ENV=test` and `production` | No enquiries seeded; other counts as BE-T-099 | BE-023 |
| BE-T-102 | I | seed images | After seed: every `media_assets.path` and every referenced media id | Each file exists under `MEDIA_ROOT/seed/`; SVGs parse with `defusedxml`; contain no `http`, `https`, `@import` or external `href`; two runs produce byte-identical files | BE-023 |
| BE-T-103 | I | seed failure | Inject an error mid-seed (monkeypatched insert raises) | Exit 1; transaction rolled back; record counts as before the run | BE-023 |
| BE-T-104 | U | seed content | Scan `seed/data.py` strings | Emails only `@example.com`; no URL other than `example.com` or `#`; slugs valid; `seed_key`s unique | BE-023 |
| BE-T-105 | I | DB setup (post-run, app role only) | After the user ran `setup_db.ps1`: query `pg_database` / `pg_roles` with the app role | Both databases exist, owner is the app role, encoding UTF8; app role `rolsuper`, `rolcreatedb`, `rolcreaterole` all false | BE-024 |
| BE-T-106 | U | `setup_db` files | Static checks on `setup_db.ps1` / `.sql` | psql full path and port 5442 present; no `-Password`/plain-text password parameter; `MP_APP_PASSWORD` removed in `finally`; SQL uses `IF NOT EXISTS`/`\gexec` guards and `ON_ERROR_STOP` | BE-024 |
| BE-T-107 | I | test harness safety | `TEST_DATABASE_URL` pointing at `mitali_portfolio` | Session fixture aborts before any migration or truncation | BE-025 |
| BE-T-108 | U | `check_contract.py` | Current app; app with a route's status code changed (fixture app) | Exit 0; non-zero with a readable diff | BE-025, BE-002 |
| BE-T-109 | U | README | Required commands present (`setup_db.ps1`, `alembic upgrade head`, `create-admin`, `seed`, `pg_dump -p 5442`) and no credential-like strings | Pass | BE-026 |

Coverage target: **≥ 90 % line and branch coverage** on `app/services/` and `app/core/` (auth, rate limiting, media,
markdown, errors and frontend serving carry the risk), **≥ 85 % lines** on `app/` overall, measured with
`uv run pytest --cov=app --cov-branch`. Every `BE-T-*` row maps to at least one test marked with its ID. Scenarios that
need the user's action (BE-T-105 after `setup_db.ps1`) are reported as "pending user run" until the user has run the
script; they are never reported as passed without it.

## 6. Open questions (backend)
| # | Question | Default used in this scope |
|---|----------|----------------------------|
| BQ-1 | `faq_categories.name` is UNIQUE, but the contract has no `name_taken` code. Which code should a duplicate category name return? | 422 `validation_error` with `fields.name` "A category with this name already exists." (no contract change needed); a dedicated 409 code would need a tech-spec change |
| BQ-2 | Pytest and Playwright E2E share `mitali_portfolio_test`. The pytest session truncates tables at start (BE-025), so E2E must re-run `seed` before its run. Acceptable, or should E2E get a third database (`mitali_portfolio_e2e`, would need the user to extend `setup_db.sql`)? | Shared DB; E2E setup runs `alembic upgrade head` + `seed` first |
| BQ-3 | Tech-spec open questions that change backend work if answered differently: OQ-1 (PNG `og:image` from the seed), OQ-3 (sample flag on testimonials, SD-013 change), OQ-6 (extra `unlock-login` CLI command), OQ-7 (seed re-creates deleted seeded rows). | As the tech-spec defaults |
