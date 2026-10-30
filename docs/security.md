# Security Guidelines — mitali-portfolio

> Per-layer security requirements. Written after `backend-scope.md` and `ui-scope.md` (no mobile scope: `mobile: none`;
> no cloud scope: `cloud: none`), and feeds review criteria back into them (`BE-REV-024..030`, `UI-REV-021..025`).
> Owned by the `security-guidelines` skill. Status tags: `ID [STATUS YYYY-MM-DD HH:MM]` (see `status-tracker`).
> Stack (SystemDesign header): backend `python-fastapi`, frontend `react` (one app: pre-rendered public site + client
> `/admin`), database `postgresql` 17 on port 5442, auth `session-cookie` (SD-007), cloud/iac/ci `none` (SD-012).
> Design sources: SD-005, SD-007..SD-010, TS-003, TS-005, TS-007..TS-014, TS-018. This document owns the final security
> header list referenced by TS-003 point 9 and BE-004.
> Verification references use existing `BE-T-*` / `UI-T-*` scenarios where they exist. Checks marked **new test** are
> not yet rows in the scope test tables; until the scope owners add rows, the builder writes them marked with the SEC ID
> (`@pytest.mark.sec("SEC-BE-011")`, Vitest/Playwright `describe("SEC-UI-003 …")`) so the tester can map results.

## 1. Threat model summary

### 1.1 Context
Local-only system on the user's Windows machine (SD-012). One admin (Mitali), anonymous visitors, no cloud, no CI.
The realistic attackers today are: (a) a malicious web page open in the same browser (CSRF, DNS rebinding, cross-port
cookie tricks on `localhost`), (b) malicious or malformed content entering through uploads, Markdown, settings URLs or the
contact form, (c) accidental leakage (secrets or personal data committed to git, printed in chat or logs), and
(d) vulnerable dependencies. Network attackers matter only if a service is bound beyond loopback (SEC-001) and become
the main concern once hosting arrives (section 6).

### 1.2 Assets
| Asset | Where | Sensitivity |
|-------|-------|-------------|
| Admin credentials (email + Argon2id hash) | `admin_users` | High: full control of public content |
| Session and CSRF tokens | browser cookies; SHA-256 hashes in `sessions` | High while valid (8 h idle / 7 d absolute) |
| Enquiries (name, email, company, budget, message) | `enquiries`, admin UI, `pg_dump` backups | Personal data (REQ-NFR-005) |
| Secrets: app-role DB password, `HASH_KEY_SECRET`, PostgreSQL superuser password | `backend/.env` (git-ignored); superuser password only in the user's head / psql prompt | High |
| Public content and media | DB, `backend/media/`, `frontend/dist/` | Integrity (defacement, stored XSS) |
| Repository on GitHub (`origin`) | git | Must never contain secrets, `.env`, backups or reference-site material |

### 1.3 Trust boundaries
1. Visitor browser → pre-rendered static files (`frontend/dist`) and `POST /api/public/enquiries` (only runtime write).
2. Admin browser → `/api/admin/*` (session cookie + CSRF token + Origin check).
3. Build process (`npm run build:site`) → `GET /api/public/*` → writes HTML/JSON that every visitor executes.
4. Uploaded files → Pillow / `defusedxml` → `backend/media/uploads/` → served at `/media/*`.
5. Backend → PostgreSQL 17 (app role `mitali_app`, loopback).
6. User terminal → CLI (`create-admin`, `reset-password`, `seed`) and `setup_db.ps1` (superuser via psql prompt).
7. Agents → repository and test database (app role only; never the superuser; never `.env` contents in chat).

### 1.4 Threats (STRIDE) and mitigations
| # | Threat | Boundary | Mitigation (SEC IDs) |
|---|--------|----------|----------------------|
| T1 | Spoofing: password guessing / credential stuffing on `/admin/login` | 2 | Argon2id, throttle per IP and account (SEC-BE-001, SEC-BE-006) |
| T2 | Spoofing: session theft or fixation | 2 | HttpOnly/SameSite=Strict cookie, hashed tokens, new token per login, expiry (SEC-BE-003, SEC-UI-006) |
| T3 | Tampering: CSRF against admin mutations or login | 2 | SameSite=Strict + Origin check + session-bound double-submit token (SEC-BE-004) |
| T4 | Tampering / elevation: stored XSS via Markdown, SVG, settings URLs, hydration data, head tags | 3, 4 | Single sanitisation points, React escaping, JSON escaping, URL scheme allow-list, CSP (SEC-BE-011, SEC-BE-013, SEC-BE-014, SEC-UI-001..004, SEC-010) |
| T5 | Tampering: malicious upload (polyglot, decompression bomb, XXE, path traversal) | 4 | Magic-byte sniff, size and pixel caps, Pillow re-encode, `defusedxml`, UUID paths (SEC-BE-010..012) |
| T6 | Repudiation: no trace of admin logins | 2 | Auth audit events without personal data (SEC-008) |
| T7 | Information disclosure: enquiry PII or secrets in logs, git, chat, public API, backups | all | SEC-003, SEC-004, SEC-008, SEC-011, SEC-BE-009, SEC-UI-008 |
| T8 | Information disclosure: unpublished content reachable | 1, 3 | Published-only queries, no file for unpublished slugs (SEC-BE-005, SEC-BE-012) |
| T9 | Denial of service: contact spam, login lock-out, large bodies, image bombs | 1, 2, 4 | Honeypot + rate limit, body/upload/pixel caps, throttle check before Argon2 (SEC-BE-006, SEC-BE-008, SEC-BE-018); lock-out trade-off accepted locally |
| T10 | Elevation: unprotected admin route, open redirect after login, DNS rebinding | 2 | Deny-by-default router, `next` validation, Host allow-list (SEC-BE-005, SEC-UI-005, SEC-BE-016) |
| T11 | Supply chain: vulnerable or malicious package, third-party script | build | Lockfiles, audits, no runtime third-party resources (SEC-005, SEC-006, SEC-UI-010) |
| T12 | Exposure beyond the machine: services bound to all interfaces over plain http | 5, all | Loopback binding, pg_hba loopback-only (SEC-001, SEC-002) |

## 2. Cross-cutting

- SEC-001 [NEW 2026-10-29 16:06] Local deployment boundary: everything listens on loopback only
  - FastAPI is started with `--host 127.0.0.1` in every mode. `fastapi dev` defaults to 127.0.0.1, but **`fastapi run`
    (production-like preview, TS-001 step 4) defaults to `0.0.0.0`**, so the README and any script must pass
    `--host 127.0.0.1` explicitly. The Vite dev server keeps its default `localhost` binding (never `--host` /
    `server.host: true`).
  - PostgreSQL 17 on port 5442 accepts connections only from `127.0.0.1/32` and `::1/128` with `scram-sha-256` in
    `pg_hba.conf` (the EDB installer sets `listen_addresses = '*'`; `pg_hba.conf` is what blocks remote clients). This is
    the user's configuration; agents never edit it.
  - No port forwarding, tunnels (ngrok etc.) or LAN sharing of the admin while it runs over plain http.
  - Verify: review of README and `package.json` scripts (BE-REV-030, UI-REV-025); README check extends BE-T-109 (must
    contain `--host 127.0.0.1` for `fastapi run`); user check: `pg_hba.conf` host lines are loopback-only and
    `SHOW password_encryption` returns `scram-sha-256` (section 8.2).

- SEC-002 [NEW 2026-10-29 16:06] Transport: plain http on loopback only; HTTPS is mandatory before any non-local use
  - Locally the browser talks to `http://localhost:5173` (Vite proxy) or `http://127.0.0.1:8000` (preview). Credentials
    and session cookies cross only the loopback interface, which is accepted for local development.
  - The moment the site is reachable from another machine, TLS 1.2+ (HTTPS only), HSTS and `Secure` cookies become
    mandatory (section 6, items H-1 and H-2). SEC-BE-003 enforces this at startup for `APP_ENV=production`.
  - Verify: review; startup test of SEC-BE-003.

- SEC-003 [NEW 2026-10-29 16:06] Secrets and configuration handling
  - Secrets (`DATABASE_URL`/`TEST_DATABASE_URL` passwords, `HASH_KEY_SECRET`) live only in git-ignored `backend/.env`,
    read only by `core/config.py` (`pydantic-settings`), typed `SecretStr`, never logged or included in error messages.
    `backend/.env.example` and `frontend/.env.example` hold placeholders only.
  - `HASH_KEY_SECRET` is at least 32 random bytes (generated by `setup_db.ps1` with a CSPRNG or by
    `python -c "import secrets; print(secrets.token_urlsafe(48))"`); startup refuses a missing, short (< 32 chars) or
    placeholder value.
  - Frontend: only `VITE_SITE_URL` is a `VITE_*` variable (bundled into public JS, so never a secret); `API_BASE_URL` is a
    build-time value used by the pre-render script and contains no credentials.
  - Agents never print, paste or quote `.env` values, connection strings with passwords, session tokens or CSRF tokens
    into chat, docs, test output, commit messages or logs. They use the app role through the application's own config.
  - Before any commit the user asks for: `git status` / `git ls-files` show no `.env`, `*.dump`, `media/uploads/`,
    `media/seed/` or `.dev-pipeline/reference/screenshots/` content. `.gitignore` must additionally list `*.dump` and
    `*.backup` (pg_dump output contains enquiries and the admin hash) and the TS-001 paths (`backend/media/uploads/`,
    `backend/media/seed/`, `frontend/dist-ssr/`).
  - Verify: BE-T-001, BE-T-002, BE-T-004; **new test** startup rejects short/placeholder `HASH_KEY_SECRET`; review
    BE-REV-017, BE-REV-030; pre-commit check above (manual, by the agent asked to commit).

- SEC-004 [NEW 2026-10-29 16:06] Database setup and credentials (user-run, least privilege)
  - The PostgreSQL superuser password is never requested in chat, never written to a file, script parameter,
    environment variable or log, and never typed by an agent. Only the user runs `backend/scripts/setup_db.ps1`; psql
    prompts for the superuser password itself (SD-005, TS-018, REQ-072).
  - The app-role password is read with `Read-Host -AsSecureString`, passed to psql only through the process-scoped
    `MP_APP_PASSWORD` (removed in `finally`), never on the command line, and written only into `backend/.env` when the
    user confirms.
  - App role `mitali_app`: `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`; owns only `mitali_portfolio` and
    `mitali_portfolio_test`; `CONNECT` revoked from `PUBLIC` on both. Agents connect only as this role (psql by full path
    `C:\Program Files\PostgreSQL\17\bin\psql.exe -h localhost -p 5442`).
  - Verify: BE-T-105 (after the user's run), BE-T-106, BE-REV-020; user check of `pg_hba.conf` (section 8.2).

- SEC-005 [NEW 2026-10-29 16:06] Dependency and supply-chain hygiene
  - Lockfiles committed and used: `uv.lock` (`uv sync --locked`), `package-lock.json` (`npm ci`). Versions pinned for
    security-relevant libraries (`react-router`, `argon2-cffi`, `Pillow`, `defusedxml`, `nh3`, `markdown-it-py`,
    `python-multipart`, `vite`).
  - Scans before every review round and before any commit the user requests: `uv run pip-audit` (no known
    vulnerabilities, or each one listed with a justification in the review report), `uv run bandit -r app -ll` (no
    medium or high findings without an inline `# nosec <id>` plus reason), `npm audit --audit-level=high` (no high or
    critical). Pillow, `python-multipart`, Vite and React Router have a history of advisories; keep them current.
  - A new dependency needs: open-source licence (REQ-NFR-008), active maintenance, no install scripts that download
    binaries from unknown hosts, and a line in the review report saying why it is needed.
  - Verify: BE-T scan gate in BE-025 / BE-REV-023; UI validation commands (`npm audit`); review BE-REV-030, UI-REV-025.

- SEC-006 [NEW 2026-10-29 16:06] No third-party code or resources at runtime
  - No analytics, tag managers, CDNs, external fonts, embeds, iframes, chat widgets or hot-linked images on public or
    admin pages (SystemDesign section 5). Fonts are self-hosted from `frontend/public/fonts/` (REQ-NFR-007). The booking
    service and social networks are plain outbound links only.
  - FastAPI's interactive docs (`/docs`, `/redoc`) load Swagger UI / ReDoc from a CDN; they are disabled
    (`docs_url=None`, `redoc_url=None`) unless `APP_ENV=development`, and `openapi_url` likewise (the contract check calls
    `app.openapi()` directly and does not need the route).
  - Verify: CSP (SEC-010) blocks anything else; **new test** (Playwright) records every request while loading each public
    page and the admin dashboard and asserts all go to the same origin; **new test** `GET /docs` and `/openapi.json`
    return 404 with `APP_ENV=test`; review UI-REV-025.

- SEC-007 [NEW 2026-10-29 16:06] Original content only (reference-site rule, CLAUDE.md rule 11)
  - No text, image, logo, font, code or data from the reference site in code, seed data, tests, fixtures or docs;
    no hot-linking. Seed content is fictional with `example.com` addresses; placeholder images are generated locally
    (REQ-071). Logos come only from `assets/brand/` and are never edited. Reference screenshots stay in
    `.dev-pipeline/reference/screenshots/` (git-ignored).
  - Verify: BE-T-102, BE-T-104, BE-REV-019, UI-REV-012; `git ls-files .dev-pipeline/reference/screenshots` is empty.

- SEC-008 [NEW 2026-10-29 16:06] Logging, audit events and privacy in logs
  - Never logged anywhere (app logs, uvicorn logs, test output, exception messages): passwords, session or CSRF tokens,
    cookies, request bodies, enquiry fields, email addresses, IP addresses, `.env` values.
  - Uvicorn's own access log prints the client address and full request line; it is disabled (`--no-access-log` or
    `logging.getLogger("uvicorn.access")` handlers removed in `core/logging.py`) and replaced by the app's JSON access
    line (route template, status, duration, request id). Uvicorn's `Server` header is turned off (`--no-server-header`
    / `server_header=False`).
  - Audit events (event name + request id + timestamp only): `auth.login_succeeded`, `auth.login_failed`,
    `auth.login_blocked`, `auth.logout`, `auth.session_expired`, `auth.csrf_failed`, `auth.origin_rejected`,
    `cli.admin_created`, `cli.password_reset`, `contact.honeypot_hit`, `contact.rate_limited`.
  - Verify: BE-T-016 (extended to assert the audit event names and the absence of IP/email), **new test** uvicorn access
    logger has no handlers / is disabled in the app's logging config; BE-REV-016, BE-REV-029; UI-REV-019 for the browser.

- SEC-009 [NEW 2026-10-29 16:06] Error handling does not leak internals
  - FastAPI `debug=False` in every environment; 500 responses carry the generic message and request id only (no
    traceback, SQL, file paths or library versions). Auth failures use fixed messages (no hint whether the email or the
    password was wrong; identical 401 body and comparable timing).
  - Verify: BE-T-011, BE-T-038, BE-T-036.

- SEC-010 [NEW 2026-10-29 16:06] Security headers and Content Security Policy (final list, owned here)
  - Served by FastAPI on every response, including errors, static `/media`, and the pre-rendered frontend in the
    production-like preview (the Vite dev server sends no CSP; CSP is verified on the preview).

    | Header | Value | Applies to |
    |--------|-------|-----------|
    | `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` | HTML (public pages, admin shell, `404.html`) |
    | `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` | `/api/*` JSON responses |
    | `Content-Security-Policy` | `default-src 'none'; style-src 'unsafe-inline'; sandbox` | every `.svg` under `/media` (SD-008) |
    | `X-Content-Type-Options` | `nosniff` | all |
    | `Referrer-Policy` | `strict-origin-when-cross-origin` | all |
    | `X-Frame-Options` | `DENY` | all |
    | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | HTML |
    | `Cross-Origin-Opener-Policy` | `same-origin` | HTML |
    | `Cross-Origin-Resource-Policy` | `same-origin` | all (also stops other sites hot-linking `/media`) |
    | `X-Robots-Tag` | `noindex, nofollow` | `/api/admin/*`, admin shell HTML |
    | `Cache-Control` | `no-store` | `/api/admin/*`, admin shell HTML |
    | `Strict-Transport-Security` | **not sent locally**; `max-age=31536000; includeSubDomains` once HTTPS exists (H-1) | — |

  - No `'unsafe-inline'` or `'unsafe-eval'` for scripts or styles on HTML pages; hydration data is a non-executed
    `application/json` block (SEC-UI-002), so no script hash is needed.
  - Verify: BE-T-015, BE-T-018, BE-T-097 (extend to assert the table above per response type); **new test** (Playwright,
    preview) listens for `securitypolicyviolation` events and console CSP errors on every public page and the admin
    dashboard and expects none; review BE-REV-029, UI-REV-022.

- SEC-011 [NEW 2026-10-29 16:06] Personal data lifecycle (enquiries) — see section 7
  - Enquiries are collected only for replying to the sender, stored only in PostgreSQL, readable only through the
    authenticated admin API, never in the public API, build output (`dist/`, `data/*.json`), logs, fixtures or seed data
    outside development (`example.com` only). They are kept until the admin deletes them; archiving hides but does not
    delete (REQ-NFR-005). Hard delete removes the row.
  - The contact privacy note (`copy.ts`) states what is collected, why, that it is not shared, and that it is kept until
    deleted on request.
  - `pg_dump` backups contain enquiries and the admin password hash: they are kept outside the repository (git-ignored
    patterns in SEC-003) and on an encrypted disk (section 8.2).
  - Verify: BE-T-027, BE-T-094, BE-T-101, BE-REV-009; UI-T-102; review of `copy.ts` privacy note; section 8.2 user check.

## 3. Backend

- SEC-BE-001 [NEW 2026-10-29 16:06] Password hashing and verification
  - Argon2id via `argon2-cffi` `PasswordHasher` with at least the library defaults (time cost 3, memory 64 MiB,
    parallelism 4, RFC 9106 low-memory profile); `check_needs_rehash` on successful login. Unknown email verifies against
    a fixed module-level dummy hash (equal work). Verification and hashing run in the threadpool.
  - Login input `password` 1..128 characters (contract); CLI policy 12..128, not equal to the email or its local part
    (case-insensitive). Passwords never logged, echoed, stored in plain text, or returned.
  - Verify: BE-T-037, BE-T-038, BE-T-042, BE-T-050, BE-T-051, BE-T-054; review BE-REV-024.

- SEC-BE-002 [NEW 2026-10-29 16:06] Admin account lifecycle is CLI-only
  - No HTTP route creates an admin, changes the email or sets a password (no sign-up, no reset by email, REQ-062).
    `create-admin` refuses when an admin exists (plus the single-row unique index); passwords come only from `getpass`
    (twice) or `--password-stdin` (tests), never from argv. `reset-password` deletes all sessions of the admin and clears
    the `login_account` bucket.
  - Verify: BE-T-008, BE-T-050..053; **new test** route inventory: under `/api/admin/auth` only `adminLogin`,
    `adminLogout` and `getAdminMe` exist, and no route anywhere accepts a `password` or admin `email` change; review
    BE-REV-024 (and BE-REV-018).

- SEC-BE-003 [NEW 2026-10-29 16:06] Session management and cookie flags (with the local http caveat)
  - Token `secrets.token_urlsafe(32)` (256 bit); only SHA-256 hashes stored (`token_hash`, `csrf_token_hash`); lookup by
    hash. Every successful login issues a new token and ignores any session cookie sent with the login request (no
    fixation). Idle 8 h (refresh of `last_seen_at` at most once per minute), absolute 7 d; expired rows deleted on use and
    at login. Logout deletes the row and expires both cookies.
  - Cookies: `mp_session` `HttpOnly; SameSite=Strict; Path=/; Max-Age=604800` and `Secure` when
    `SESSION_COOKIE_SECURE=true`; `mp_csrf` `SameSite=Strict; Path=/` (readable by JS by design, double-submit), same
    `Secure` rule. No `Domain` attribute (host-only cookies).
  - **Local http caveat:** over `http://localhost` the `Secure` flag must be off or the browser drops the cookie, so the
    default is `SESSION_COOKIE_SECURE=false` locally. Cookies are not isolated by port: any other web app on `localhost`
    (other dev projects) can receive or overwrite these cookies. Accepted for local use; mitigations: use a dedicated
    browser profile for the admin, do not run untrusted local web apps at the same time, and rely on the Origin check and
    session-bound CSRF token (SEC-BE-004) which a cookie written by another port cannot satisfy.
  - Startup refuses `APP_ENV=production` with `SESSION_COOKIE_SECURE=false` (one clear configuration error).
  - Verify: BE-T-037, BE-T-039, BE-T-040, BE-T-041, BE-T-053; **new test** login sent with an existing valid `mp_session`
    cookie sets a new, different token (the presented token is never re-issued); **new test** startup error for
    `APP_ENV=production` without Secure; review BE-REV-024.

- SEC-BE-004 [NEW 2026-10-29 16:06] CSRF protection (three layers)
  - Layer 1: `SameSite=Strict` cookies. Layer 2: Origin check on every non-GET `/api/admin/*` request **including
    login** (blocks login CSRF): `Origin`, or failing that the `Referer` origin, must exactly match an entry of
    `ALLOWED_ORIGINS`; missing both → 403 `origin_rejected`. `ALLOWED_ORIGINS` holds exact `scheme://host:port` values;
    `*`, `null` and suffix matching are not allowed. Layer 3: `X-CSRF-Token` header equals the `mp_csrf` cookie and its
    SHA-256 equals the session's `csrf_token_hash` (`hmac.compare_digest`) on every POST/PUT/PATCH/DELETE except login.
  - JSON endpoints require `Content-Type: application/json` (FastAPI's default behaviour; never loosened), so
    cross-site `text/plain` / form posts cannot reach JSON handlers. GET handlers never change state. No CORS middleware
    (no cross-origin reads).
  - Verify: BE-T-014, BE-T-043, BE-T-044; **new test** admin POST with `Content-Type: text/plain` and a JSON-looking body →
    4xx and no change; **new test** `ALLOWED_ORIGINS` parsing rejects `*` / `null`; review BE-REV-025.

- SEC-BE-005 [NEW 2026-10-29 16:06] Authorisation deny-by-default and minimal public surface
  - Every route under `/api/admin` is mounted on the protected router (`get_current_admin` at router level; `require_csrf`
    for non-GET); `adminLogin` is the only exception. A new admin route is protected without per-route code; there is no
    opt-out flag.
  - Public routers are GET-only except `createEnquiry`; public queries return only published rows and only the fields of
    the `*Public` schemas (never `notification_email`, enquiries, media `original_filename`, admin data or unpublished
    items/links).
  - `/docs`, `/redoc`, `/openapi.json` disabled outside development (SEC-006).
  - Verify: BE-T-044 (inventory of admin routes), BE-T-019, BE-T-020, BE-T-022, BE-T-025, BE-T-026, BE-T-027; **new
    test** inventory of `/api/public` routes: methods ⊆ {GET, HEAD} except `POST /api/public/enquiries`; review
    BE-REV-003, BE-REV-009, BE-REV-025.

- SEC-BE-006 [NEW 2026-10-29 16:06] Login throttling and the lock-out trade-off
  - Buckets `login_ip` and `login_account` keyed by HMAC-SHA256(`HASH_KEY_SECRET`, value) (no raw IP or email stored);
    15 min fixed window; 5th failure sets `blocked_until = now() + 15 min`; while blocked every attempt, even correct,
    gets 429 `too_many_attempts` with `Retry-After`. The block check runs **before** Argon2 verification (a blocked
    attacker costs no hashing). Counter updates are a single atomic upsert. Success resets both buckets.
  - **Trade-off (tech-spec OQ-6):** the per-account bucket lets anyone who can reach the login form lock the admin out for
    15 minutes by guessing. Locally only loopback clients can reach it, and every request arrives from `127.0.0.1`, so the
    per-IP bucket is effectively global too. Accepted for local use; recovery is to wait 15 minutes or run
    `reset-password` (clears the account bucket). Must be revisited before hosting (H-4).
  - Verify: BE-T-045..049, BE-T-053; **new test** blocked bucket → Argon2 verify not called (spy); review BE-REV-024.

- SEC-BE-007 [NEW 2026-10-29 16:06] Input validation on every endpoint; parameterised queries only
  - All bodies inherit `InputModel` (`extra="forbid"`, whitespace stripped, explicit lengths/patterns/enums matching the
    contract); path ids typed `UUID`; query enums validated (unknown `format`/`status` → 422); pagination caps
    (`page_size ≤ 100`).
  - Every string field rejects `\x00` and other C0 control characters except `\t`, `\n`, `\r` (PostgreSQL `text` rejects
    NUL, which would otherwise surface as a 500). Single-line fields (names, labels, emails, URLs, slugs) reject `\r` and
    `\n` too.
  - JSON bodies ≤ 1 MB; SQL only through SQLAlchemy expressions with bound parameters; the few raw statements (migration,
    rate-limit upsert, seed upserts) use bound parameters, never string formatting.
  - Verify: BE-T-010, BE-T-012, BE-T-031, BE-T-057, BE-T-071, BE-T-090, BE-T-091; **new test** NUL byte in `name`,
    `message`, `title` → 422 with field path (no 500); `bandit` (B608 SQL string building); review BE-REV-005,
    BE-REV-026.

- SEC-BE-008 [NEW 2026-10-29 16:06] Contact form abuse protection (`createEnquiry`)
  - Server-side validation regardless of the browser (TS-007); honeypot `website` non-empty → the same 201 response,
    nothing stored, counter incremented, event `contact.honeypot_hit` without content; fixed-window limit 5 accepted
    submissions per 10 min per client IP (HMAC key, atomic upsert, counted only after validation) → 429 `rate_limited`
    with `Retry-After`.
  - Client IP is `request.client.host` only; `X-Forwarded-For` / `Forwarded` are ignored until a trusted proxy exists
    (H-3). Locally every client is `127.0.0.1`, so the limit is effectively global (accepted; E2E UI-T-111 relies on it).
  - No email is sent today; when notifications are added, header values must reject CR/LF and the message body must not
    be used in headers (H-9).
  - Verify: BE-T-030..035; review BE-REV-026.

- SEC-BE-009 [NEW 2026-10-29 16:06] Enquiry personal data in the backend
  - Enquiry fields are never logged (including on validation errors, honeypot hits and 500s), never returned by public
    endpoints, and served by admin endpoints with `Cache-Control: no-store`. Delete is a hard delete; status changes do
    not copy data elsewhere. Seeded enquiries exist only when `APP_ENV=development` and use `example.com`. Rate-limit
    rows hold only HMAC keys and are purged after 1 day.
  - Verify: BE-T-016, BE-T-034, BE-T-036, BE-T-049, BE-T-094, BE-T-101; review BE-REV-026.

- SEC-BE-010 [NEW 2026-10-29 16:06] Upload validation and raster re-encoding
  - Size: early reject on `Content-Length` > 10 MB + 64 KB; streamed byte count aborts at 10 MB (413) and removes the temp
    file. Type: magic bytes only (JPEG, PNG, WebP, or SVG via `defusedxml` root check); filename extension and client
    `Content-Type` are ignored (415 otherwise).
  - Raster: `Image.open` + `verify()`, reopen, `Image.MAX_IMAGE_PIXELS = 40_000_000` with `DecompressionBombWarning`
    turned into an error (`warnings.simplefilter("error", Image.DecompressionBombWarning)` in the processing function),
    first frame only for animated input, `exif_transpose`, convert, re-encode to WebP variants with **no** EXIF/ICC/XMP
    (removes GPS and camera data), original discarded. Re-encoding neutralises polyglot payloads.
  - Names: generated UUIDs under `uploads/<yyyy>/<mm>/`; `original_filename` is display-only, trimmed to 200 chars with
    control characters and path separators removed, rendered as text.
  - Verify: BE-T-078..082, BE-T-084; **new test** animated WebP → single-frame output; **new test** output WebP contains
    no EXIF/XMP chunk; review BE-REV-015, BE-REV-027.

- SEC-BE-011 [NEW 2026-10-29 16:06] SVG sanitisation and sandboxed serving
  - Parse with `defusedxml` (DTDs, entities and external references rejected → 415). Sanitise with an **allow-list**
    (not only the TS-011 step 4 removals): elements `svg, g, defs, symbol, use, title, desc, path, rect, circle, ellipse,
    line, polyline, polygon, text, tspan, linearGradient, radialGradient, stop, clipPath, mask, pattern`; presentation and
    geometry attributes only (e.g. `id, class, viewBox, width, height, x, y, x1, y1, x2, y2, cx, cy, r, rx, ry, d, points,
    transform, fill, fill-opacity, fill-rule, stroke, stroke-width, stroke-linecap, stroke-linejoin, stroke-dasharray,
    stroke-opacity, opacity, offset, stop-color, stop-opacity, gradientUnits, gradientTransform, patternUnits,
    clip-path, clip-rule, mask, font-family, font-size, font-weight, text-anchor, dominant-baseline, preserveAspectRatio,
    xmlns, xmlns:xlink, style`). Everything else is dropped, which removes `script`, `foreignObject`, `a`, `image`,
    `animate`, `animateTransform`, `set`, `style` elements, `iframe`, `embed`, `object` and all `on*` attributes.
    `href`/`xlink:href` (on `use` only) must start with `#`. `style` attribute values and `fill`/`stroke`/`clip-path`/
    `mask` values may reference only `url(#id)`; any `url(` with another target, `@import`, `expression(` or
    `javascript:` removes the attribute.
  - Re-serialised output stored as `uploads/<yyyy>/<mm>/<uuid>.svg`; served with `Content-Type: image/svg+xml`, `nosniff`
    and the sandbox CSP of SEC-010, so even a sanitiser miss cannot run script when the file is opened directly. The UI
    shows SVGs only through `<img>` (SEC-UI-009).
  - Verify: BE-T-083, BE-T-018; **new test** cases `<a href="javascript:…">`, `<animate attributeName="href"
    values="javascript:…">`, `<set>`, `<image href="https://…">`, `<use href="data:…">`, `<style>@import …</style>`,
    `fill="url(https://…)"` → all removed; review BE-REV-027. Tech-spec TS-011 step 4 should adopt the allow-list
    (open question SQ-2).

- SEC-BE-012 [NEW 2026-10-29 16:06] Path traversal and file serving confinement
  - `/media/*` served by `StaticFiles` from the resolved `MEDIA_ROOT`; `tmp/` never served. Stored paths are relative,
    without `..`, leading `/` or `\`, drive letters or `:` (DB CHECK plus service validation). Before any read, write or
    delete, the resolved path must be inside its root (`Path.resolve()` + `is_relative_to`).
  - Windows specifics: requests containing `\` or `%5C`, `:` (drive letters, alternate data streams such as
    `file::$DATA`), or reserved device names (`CON`, `NUL`, `AUX`, `COM1`…) are refused with 404.
  - The frontend catch-all (BE-022) serves only files inside `FRONTEND_DIST_DIR`, never dot-files or `build-info.json`;
    unpublished/unknown slugs have no file and get `404.html` with status 404.
  - Verify: BE-T-018, BE-T-097; **new test** `/media/uploads%5C..%5C..%5C.env`, `/media/C:/Windows/win.ini`,
    `/media/uploads/x.svg::$DATA`, `/work/CON` → 404; review BE-REV-021, BE-REV-027.

- SEC-BE-013 [NEW 2026-10-29 16:06] Markdown rendering and HTML sanitisation (single point)
  - Only `services/markdown.render_markdown` produces `*_html`: `markdown-it-py` CommonMark with `html=False`, `linkify`
    off, then `nh3` with exactly the TS-012 allow-list (no `img`, no `style`/`class`/`id` attributes, URL schemes
    `http`, `https`, `mailto` only, `rel="noopener noreferrer nofollow"` forced on links). Used on save, in the preview
    endpoint and by the seed; `*_html`, `word_count` and `reading_time_min` are never accepted from clients.
  - All other text fields (FAQ answers, testimonials, bios, summaries, results) are plain text and are never converted
    to HTML on the server; paragraphs are produced by the UI from text.
  - If the allow-list changes, all stored HTML is re-rendered (TS-012 risk).
  - Verify: BE-T-057, BE-T-068, BE-T-086, BE-T-088; **new test** `[x](JaVaScRiPt:alert(1))`, `[x](data:text/html,…)`,
    `<a href="vbscript:…">` in raw Markdown → no active link; review BE-REV-014, BE-REV-028.

- SEC-BE-014 [NEW 2026-10-29 16:06] (definition updated 2026-10-30 05:08, CHG-005: length limit aligned with the
  contract) URL and email validation for settings and links (no open redirects)
  - `booking_url`: null, `""`, `#`, or an absolute URL parsed with a real parser (`pydantic.HttpUrl` or `urllib.parse`
    plus checks) whose scheme is exactly `http` or `https`, with a host, no userinfo (`user:pass@`), no whitespace or
    control characters, ≤ 500 characters (as `SettingsInput.booking_url` and `SocialLink.url` in `api-contract.yaml`). `social_links[].url`: same rule (no `#`/empty). Everything else
    (`javascript:`, `data:`, `vbscript:`, `ftp:`, protocol-relative `//host`, relative paths) → 422.
  - `contact_email`, `notification_email`: valid email (`EmailStr`), no CR/LF, ≤ 254.
  - The backend never issues redirects to stored or client-supplied URLs (the only redirect is the 308 trailing-slash
    redirect to a same-origin path, built from the request path, never from a parameter).
  - Verify: BE-T-090, BE-T-097; **new test** `https://user:pw@example.com`, `//evil.example`, `https://exa mple.com`,
    `HTTPS://EXAMPLE.COM` (accepted, normalised); **new test** 308 `Location` for `//evil.example/` path stays
    same-origin (`/evil.example`, never `//evil.example`); review BE-REV-028.

- SEC-BE-015 [NEW 2026-10-29 16:06] Security header middleware implementation
  - One middleware (`core/headers.py`) applies SEC-010 per response type, including error responses, 404s, static
    `/media` files and frontend files; the SVG sandbox CSP comes from `MediaFiles`. Header values are constants in one
    module, not scattered per route.
  - Verify: BE-T-015, BE-T-018, BE-T-097 (extended per SEC-010); review BE-REV-029.

- SEC-BE-016 [NEW 2026-10-29 16:06] Host header allow-list (DNS-rebinding defence)
  - `TrustedHostMiddleware` (Starlette) with the host names derived from `ALLOWED_ORIGINS` (locally `localhost`,
    `127.0.0.1`); any other `Host` → 400. This stops a malicious site that rebinds its domain to 127.0.0.1 from using the
    local API through the browser. No new configuration key is needed.
  - Verify: **new test** request with `Host: evil.example` → 400; `Host: 127.0.0.1:8000` → normal; review BE-REV-025.

- SEC-BE-017 [NEW 2026-10-29 16:06] No command execution or build control from the web
  - No endpoint runs subprocesses, shell commands, the pre-render or Alembic. The dashboard returns the constant
    `rebuild_command` string only. `build-info.json` is treated as untrusted input: read with a size cap (64 KB),
    parsed with `json.loads`, fields validated (ISO timestamps, integers); anything else → "no build".
  - Verify: BE-T-095, BE-T-096; `bandit` B602/B603/B605/B607 absent; review BE-REV-025.

- SEC-BE-018 [NEW 2026-10-29 16:06] Resource limits (local DoS basics)
  - Body limits (1 MB JSON, 10 MB upload), 40 MP pixel limit, Markdown ≤ 100 000 chars, `page_size ≤ 100`, Argon2 only
    after the throttle check, CPU-heavy work in the threadpool, DB pool size 5, and a per-connection
    `statement_timeout` of 10 s for the app (asyncpg `server_settings`) so a runaway query cannot hold the pool.
  - Verify: BE-T-012, BE-T-013, BE-T-080, BE-T-082, BE-T-088; **new test** `SHOW statement_timeout` through the app
    session returns `10s`; review BE-REV-029.

- SEC-BE-019 [NEW 2026-10-29 16:06] Seed, CLI and test-harness safety
  - The seed never creates an admin, passwords or sessions; enquiries only in development; SVG placeholders contain no
    external references and escape all text (`xml.sax.saxutils.escape`). The test session refuses any database whose
    name does not end in `_test`. Tests and fixtures contain only fictional data.
  - Verify: BE-T-099, BE-T-101, BE-T-102, BE-T-104, BE-T-107; review BE-REV-019, BE-REV-030.

## 4. Frontend

- SEC-UI-001 [NEW 2026-10-29 16:06] Output encoding and the single HTML insertion point
  - All API, content, settings and enquiry text is rendered as JSX text (React escaping). `dangerouslySetInnerHTML`
    exists only in `shared/ui/SanitizedHtml`, which accepts only the branded `SanitizedHtmlString` created by the typed
    mappers for `body_html`, `problem_html`, `solution_html` and the `previewAdminMarkdown` response. No `innerHTML`,
    `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function` or string `setTimeout` anywhere.
  - ESLint: `react/no-danger` (one documented disable in `SanitizedHtml`), `no-eval`, `no-implied-eval`,
    `no-new-func`, `no-restricted-properties` / `no-restricted-syntax` for `innerHTML`, `outerHTML`,
    `insertAdjacentHTML`, `document.write`.
  - Verify: UI-T-030, UI-T-102; lint passes; review UI-REV-004, UI-REV-021.

- SEC-UI-002 [NEW 2026-10-29 16:06] Pre-render output: hydration data and head tags are escaped
  - Hydration data only as `<script type="application/json" id="__ROUTER_DATA__">` with `<`, `>`, `&`, U+2028 and
    U+2029 escaped as `\u003c`, `\u003e`, `\u0026`, `\u2028`, `\u2029`; read with `JSON.parse(textContent)`.
  - `entry-server.tsx` renders `<StaticRouterProvider … hydrate={false}>`: by default React Router emits its own
    **inline executable** `window.__staticRouterHydrationData` script, which would violate the CSP and bypass this
    escaping.
  - Head tags (`title`, `description`, `og:*`, canonical) are built with attribute/text escaping (React elements or one
    escaping helper); canonical and `og:url` are `VITE_SITE_URL` + a route path made of validated slugs; `og:image`
    is `VITE_SITE_URL` + a root-relative `/media/...` path only. `sitemap.xml` values are XML-escaped.
  - `dist/data/<key>.json` contains exactly the public loader data (no field that the public API does not return).
  - Verify: UI-T-004, UI-T-006, UI-T-008, UI-T-010; **new test** `buildHead` with a title containing `"><script>` and
    `</title>` → escaped; **new test** scan of `dist/**/*.html` after `build:site`: no `<script>` without `src` other
    than `type="application/json"`, no `__staticRouterHydrationData`; review UI-REV-022.

- SEC-UI-003 [NEW 2026-10-29 16:06] CSP-compatible markup and build output
  - No inline scripts, inline event-handler attributes, `style` attributes / `style` props, `javascript:` URLs or
    `<base>` tags in any rendered HTML. Vite: `build.assetsInlineLimit: 0` (no `data:` fonts or scripts that `font-src
    'self'` / `script-src 'self'` would block; `data:` images are allowed by `img-src` but not needed), no plugins that
    inject inline scripts, module-preload polyfill bundled (not inline). The admin shell (`dist/admin/index.html`) obeys
    the same policy.
  - Verify: SEC-010 Playwright CSP-violation test; dist scan test of SEC-UI-002 (also asserts no `style=` and no `on*=`
    attributes in `dist/**/*.html`); review UI-REV-005, UI-REV-022.

- SEC-UI-004 [NEW 2026-10-29 16:06] External links: http/https only, safe targets
  - `booking_url` and social links are rendered as links only when `new URL(value)` parses and `protocol` is `http:` or
    `https:` (defence in depth over SEC-BE-014); otherwise "Book a call" falls back to `/contact` and an invalid social
    link is omitted. External links use `target="_blank" rel="noopener noreferrer"` and announce "(opens in a new tab)".
    `mailto:` links are built only from the validated `contact_email`. Engagement-model actions use the `cta_target`
    enum, never a free URL.
  - Verify: UI-T-017, UI-T-018, UI-T-039, UI-T-044; **new test** Footer with a social link `javascript:alert(1)` →
    not rendered as a link; review UI-REV-011, UI-REV-023.

- SEC-UI-005 [NEW 2026-10-29 16:06] No open redirect after login
  - `next` is accepted only when, after `decodeURIComponent`, it is a path that equals `/admin` or starts with `/admin/`,
    does not start with `//` or `/\`, contains no `\`, no scheme, no control characters; navigation uses the path with
    React Router (never `window.location = next`). Otherwise `/admin`.
  - Verify: UI-T-074 (**extend** with `%2F%2Fevil.example`, `/admin%5C..%5C..%2F%2Fevil`, `/admin@evil.example`,
    `/administrator`); review UI-REV-014, UI-REV-023.

- SEC-UI-006 [NEW 2026-10-29 16:06] Admin session handling in the browser
  - No tokens, credentials or enquiry data in `localStorage`, `sessionStorage`, IndexedDB, URLs or non-HttpOnly cookies
    written by the app; the CSRF token is kept in module memory (it is also in the `mp_csrf` cookie by design). Requests
    use `credentials: "same-origin"`. On 401 and on logout the TanStack Query cache and the in-memory token are cleared.
    No service worker. The login form uses `autocomplete="username"` / `current-password` (password managers allowed).
  - Verify: UI-T-070, UI-T-071, UI-T-076; review UI-REV-014, UI-REV-024.

- SEC-UI-007 [NEW 2026-10-29 16:06] Contact form: honeypot, server-authoritative validation, no PII leakage
  - Honeypot `website` off-screen (not `display:none` only), `tabindex="-1"`, `autocomplete="off"`, `aria-hidden`;
    confirmation is identical for honeypot hits. Zod validation mirrors the contract for UX only; the server is the
    authority (SEC-BE-008). The form is POST-only via the generated client; the submit button stays disabled until
    hydration so native submission never puts data in a URL. Form values never go to `console.*`, error reporting or
    URLs. The privacy note is shown under the submit button (SEC-011).
  - Verify: UI-T-060..068, UI-T-110, UI-T-111; review UI-REV-019, UI-REV-024.

- SEC-UI-008 [NEW 2026-10-29 16:06] Enquiry and admin data in the admin UI
  - Enquiry fields are rendered as text (whitespace preserved with CSS, never as HTML); `mailto:` reply links are built
    from the stored email with `encodeURIComponent` for the subject. Enquiry routes carry only ids and the status
    filter. Admin responses are `no-store` (SEC-010) and the query cache is cleared on logout/401 (SEC-UI-006).
  - Verify: UI-T-102, UI-T-076; review UI-REV-024.

- SEC-UI-009 [NEW 2026-10-29 16:06] Media display
  - Uploaded and seeded images (including SVG) are shown only through `<img>` (`ResponsiveImage`, media picker tiles);
    never inline SVG markup, `<object>`, `<embed>`, `<iframe>` or CSS `background-image` from data. Image URLs are used
    only when they are root-relative and start with `/media/`. Client-side type/size pre-checks are UX only.
  - Verify: UI-T-029, UI-T-084; **new test** `ResponsiveImage` with `url: "https://evil.example/x.png"` or
    `javascript:` → fallback block, no `<img src>`; review UI-REV-021.

- SEC-UI-010 [NEW 2026-10-29 16:06] No third-party runtime code; frontend dependency hygiene
  - No external scripts, styles, fonts or images (SEC-006); `npm ci` from the lockfile; `npm audit --audit-level=high`
    clean; dev-only packages (`msw`, test libraries, `openapi-typescript`, `tsx`) never imported by `src/` production
    code; only `VITE_SITE_URL` is exposed to the bundle; production builds have no source maps published unless
    decided otherwise.
  - Verify: SEC-006 Playwright same-origin test; `npm audit`; **new test** grep of `dist/assets/*.js` for `http://` /
    `https://` origins other than `VITE_SITE_URL`, `example.com` seed data and XML/SVG namespace URIs; review UI-REV-025.

- SEC-UI-011 [NEW 2026-10-29 16:06] Admin exposure on the public site
  - The admin is in lazy chunks never loaded by public pages; the admin shell has `noindex, nofollow`; `robots.txt`
    disallows `/admin` (discovery hint only, not access control: protection is SEC-BE-005); public pages do not link to
    `/admin`.
  - Verify: UI-T-121, UI-REV-015; review UI-REV-025.

- SEC-UI-012 [NEW 2026-10-29 16:06] Vite dev server hardening
  - Dev server bound to `localhost` (no `--host`), `server.fs.strict` left on (default), no `server.fs.allow` widening
    beyond the project, proxy targets only `http://127.0.0.1:8000` for `/api` and `/media`; Vite kept on a patched
    version (dev-server file-read advisories). `vite preview` is not used for the production-like run (FastAPI serves
    `dist`, SEC-010 headers apply).
  - Verify: review of `vite.config.ts` and `package.json` scripts (UI-REV-025); `npm audit`.

## 5. Mobile
Not applicable: `mobile: none` in the SystemDesign header (no app; mobile apps are out of scope in requirements
section 5). No `SEC-MOB-*` items. If an app is added through `/feature`, this section gets MASVS-based items and
`docs/mobile-scope.md` its `MOB-REV` pointers.

## 6. Cloud
Not applicable: `cloud: none`, `iac: none`, `ci: none` (SD-012); the project runs only on the user's machine. No
`SEC-CL-*` items and no `cloud-scope.md` review pointers.

**Revisit when hosting arrives** (to become `SEC-CL-*` / changed `SEC-*` items in that `/feature`; not tracked items yet):
- H-1 HTTPS only (TLS 1.2+), HTTP → HTTPS redirect, HSTS (SEC-010 table), `SESSION_COOKIE_SECURE=true` (enforced by
  SEC-BE-003), cookie names with the `__Host-` prefix (`__Host-mp_session`, `__Host-mp_csrf`; requires `Secure`,
  `Path=/`, no `Domain`).
- H-2 Secrets in a managed store (cloud key vault or the platform's secret settings), not a `.env` file on a server;
  rotate the app-role password and `HASH_KEY_SECRET` (rotation invalidates throttle buckets only); separate
  dev/prod secrets.
- H-3 Reverse proxy / platform: trusted-proxy configuration so the real client IP comes from `X-Forwarded-For` only when
  set by the known proxy (contact and login limits then work per client); `ALLOWED_ORIGINS` and the trusted host list
  contain only the production origin.
- H-4 Login lock-out (OQ-6): replace the hard per-account block with per-account progressive delay or a block that
  applies only to unknown IPs, add a CLI `unlock-login`, and alert on repeated blocks.
- H-5 Database: managed PostgreSQL with TLS required, private network/firewall, separate migration (owner) and runtime
  (DML-only) roles, encrypted automated backups, encryption at rest.
- H-6 Media: blob storage or a separate cookie-less origin for `/media`, keeping `nosniff` and the SVG sandbox CSP;
  consider disabling SVG uploads if the host cannot set per-file headers.
- H-7 Build and dashboard: build in CI with no secrets in the client bundle; the dashboard's read of `build-info.json`
  needs a secure path to the deployed build (TS-015 risk).
- H-8 Edge protections: platform rate limiting/WAF for `/api/public/enquiries` and `/api/admin/auth/login`; uptime and
  error monitoring without personal data.
- H-9 Email notifications (deferred): CR/LF-safe headers, SPF/DKIM/DMARC on the sending domain, no enquiry message in the
  subject, provider credentials in the secret store.
- H-10 Privacy: published privacy notice, enquiry retention period, log retention, and the legal basis for the
  jurisdiction where the site is offered.
- H-11 Operational: `fastapi run` behind the proxy only, no `fastapi dev`, `/docs` disabled (SEC-006), `debug` off.

## 7. Data protection and compliance
No regulated data (payments, health, children) is processed. Personal data: enquiries and the admin's email.

| Data | Purpose | Stored where | Who can read | Retention | Protection |
|------|---------|-------------|--------------|-----------|------------|
| Enquiry name, email, company, budget, message | Reply to the sender | `enquiries` table | Admin only (session) | Until the admin deletes it; archive keeps it (REQ-NFR-005; period open, SQ-1) | Never logged, never public, `no-store`, hard delete (SEC-011, SEC-BE-009, SEC-UI-008) |
| Admin email + Argon2id hash | Authentication | `admin_users` | Backend only | Life of the account | Argon2id, CLI-only changes (SEC-BE-001, SEC-BE-002) |
| Session / CSRF token hashes | Authentication | `sessions` | Backend only | 8 h idle / 7 d absolute; deleted on logout/reset | SHA-256 only (SEC-BE-003) |
| Rate-limit keys (HMAC of IP / email) | Abuse protection | `rate_limit_counters` | Backend only | ≤ 1 day | Keyed HMAC, no raw values (SEC-BE-006, SEC-BE-008) |
| Image metadata (EXIF GPS etc.) | none | Removed on upload | — | — | Stripped by re-encoding (SEC-BE-010) |
| Logs | Diagnostics | Console / local files (`*.log` git-ignored) | User | User's choice | No personal data (SEC-008) |
| `pg_dump` backups | Recovery | User-chosen folder outside the repo | User | User's choice | Git-ignored patterns; encrypted disk (SEC-003, SEC-011) |

Encryption at rest is not provided by the application locally; it relies on the user's disk encryption (BitLocker or
device encryption recommended, section 8.2). Audit logging: the auth and contact events of SEC-008. Data-subject
requests (access/delete) are handled manually by the admin through the enquiry screens.

## 8. Verification

### 8.1 Matrix
"Review" = reviewer checks the listed `*-REV` item; "Test" = automated scenario; "Scan" = tool run; "User" = check the
user performs (no agent may report it as passed without the user's statement or output).

| SEC ID | Review | Tests | Scan / User |
|--------|--------|-------|-------------|
| SEC-001 | BE-REV-030, UI-REV-025 | BE-T-109 (extended) | User: `pg_hba.conf`, `password_encryption` |
| SEC-002 | BE-REV-024 | new test (SEC-BE-003 startup) | — |
| SEC-003 | BE-REV-017, BE-REV-030 | BE-T-001, BE-T-002, BE-T-004, new test (`HASH_KEY_SECRET`) | Pre-commit `git ls-files` check |
| SEC-004 | BE-REV-020, BE-REV-030 | BE-T-105 (after user run), BE-T-106 | User runs `setup_db.ps1` |
| SEC-005 | BE-REV-023, BE-REV-030, UI-REV-025 | — | `pip-audit`, `bandit -r app -ll`, `npm audit --audit-level=high` |
| SEC-006 | UI-REV-025 | new Playwright same-origin test, new `/docs` 404 test | — |
| SEC-007 | BE-REV-019, UI-REV-012 | BE-T-102, BE-T-104 | `git ls-files` of screenshots folder empty |
| SEC-008 | BE-REV-016, BE-REV-029, UI-REV-019 | BE-T-016 (extended), new uvicorn-logger test | — |
| SEC-009 | BE-REV-006, BE-REV-029 | BE-T-011, BE-T-036, BE-T-038 | — |
| SEC-010 | BE-REV-029, UI-REV-022 | BE-T-015, BE-T-018, BE-T-097 (extended), new CSP-violation E2E | — |
| SEC-011 | BE-REV-026, UI-REV-024 | BE-T-027, BE-T-094, BE-T-101, UI-T-102 | User: disk encryption, backup location |
| SEC-BE-001 | BE-REV-024 | BE-T-037, 038, 042, 050, 051, 054 | — |
| SEC-BE-002 | BE-REV-018, BE-REV-024 | BE-T-008, 050..053, new route-inventory test | — |
| SEC-BE-003 | BE-REV-024 | BE-T-037, 039..041, 053, new fixation and production-Secure tests | — |
| SEC-BE-004 | BE-REV-003, BE-REV-025 | BE-T-014, 043, 044, new text/plain and `ALLOWED_ORIGINS` tests | — |
| SEC-BE-005 | BE-REV-003, BE-REV-009, BE-REV-025 | BE-T-019, 020, 022, 025..027, 044, new public-route inventory | — |
| SEC-BE-006 | BE-REV-024 | BE-T-045..049, 053, new "no Argon2 when blocked" test | — |
| SEC-BE-007 | BE-REV-005, BE-REV-026 | BE-T-010, 012, 031, 057, 071, 090, 091, new NUL-byte test | `bandit` |
| SEC-BE-008 | BE-REV-026 | BE-T-030..035 | — |
| SEC-BE-009 | BE-REV-016, BE-REV-026 | BE-T-016, 034, 036, 049, 094, 101 | — |
| SEC-BE-010 | BE-REV-015, BE-REV-027 | BE-T-078..082, 084, new animated/metadata tests | — |
| SEC-BE-011 | BE-REV-027 | BE-T-018, 083, new SVG allow-list cases | — |
| SEC-BE-012 | BE-REV-021, BE-REV-027 | BE-T-018, 097, new Windows-path tests | — |
| SEC-BE-013 | BE-REV-014, BE-REV-028 | BE-T-057, 068, 086, 088, new scheme-case tests | — |
| SEC-BE-014 | BE-REV-028 | BE-T-090, 097, new URL and 308 tests | — |
| SEC-BE-015 | BE-REV-029 | BE-T-015, 018, 097 | — |
| SEC-BE-016 | BE-REV-025 | new Host-header test | — |
| SEC-BE-017 | BE-REV-025 | BE-T-095, 096 | `bandit` (B602/B603/B605/B607) |
| SEC-BE-018 | BE-REV-029 | BE-T-012, 013, 080, 082, 088, new `statement_timeout` test | — |
| SEC-BE-019 | BE-REV-019, BE-REV-030 | BE-T-099, 101, 102, 104, 107 | — |
| SEC-UI-001 | UI-REV-004, UI-REV-021 | UI-T-030, UI-T-102 | ESLint |
| SEC-UI-002 | UI-REV-022 | UI-T-004, 006, 008, 010, new head-escaping and dist-scan tests | — |
| SEC-UI-003 | UI-REV-005, UI-REV-022 | dist-scan test, CSP-violation E2E | — |
| SEC-UI-004 | UI-REV-011, UI-REV-023 | UI-T-017, 018, 039, 044, new social-link test | — |
| SEC-UI-005 | UI-REV-014, UI-REV-023 | UI-T-074 (extended) | — |
| SEC-UI-006 | UI-REV-014, UI-REV-024 | UI-T-070, 071, 076 | — |
| SEC-UI-007 | UI-REV-019, UI-REV-024 | UI-T-060..068, 110, 111 | — |
| SEC-UI-008 | UI-REV-024 | UI-T-076, 102 | — |
| SEC-UI-009 | UI-REV-021 | UI-T-029, 084, new external-URL image test | — |
| SEC-UI-010 | UI-REV-025 | Playwright same-origin test, new bundle-origin grep | `npm audit` |
| SEC-UI-011 | UI-REV-015, UI-REV-025 | UI-T-121 | — |
| SEC-UI-012 | UI-REV-025 | — | `npm audit` |

### 8.2 User checks (local machine; reported only from the user's own statement or output)
- `pg_hba.conf` of the PostgreSQL 17 instance (port 5442) allows `host` connections only from `127.0.0.1/32` and
  `::1/128` with `scram-sha-256`; `SHOW password_encryption;` returns `scram-sha-256` (SEC-001, SEC-004).
- `setup_db.ps1` run by the user; afterwards BE-T-105 can run (SEC-004).
- Disk encryption (BitLocker / device encryption) is on for the drive holding the database data directory, the project
  and backups (SEC-011, section 7).
- Backups (`pg_dump`) are written outside the repository folder (SEC-003, SEC-011).

### 8.3 Security open questions
| # | Question | Default until answered |
|---|----------|------------------------|
| SQ-1 | Retention for enquiries: keep until manually deleted (current REQ-NFR-005), or auto-delete archived enquiries after a period (e.g. 12 months)? | Keep until deleted; decide before hosting (H-10) |
| SQ-2 | SEC-BE-011 requires an allow-list SVG sanitiser, stricter than TS-011 step 4 (removal list). Update TS-011/BE-017 wording to match, or drop SVG uploads entirely (raster only)? | Allow-list as specified here; builder follows SEC-BE-011 |
| SQ-3 | Lock-out DoS (tech-spec OQ-6): accept the per-account 15 min block locally? | Accepted locally; revisit at hosting (H-4) |
| SQ-4 | Several verifications are marked **new test**. Should the scope owners add them as `BE-T-*` / `UI-T-*` rows, or may they live as tests marked with the SEC ID? | Tests marked with the SEC ID |
| SQ-5 | README/preview command must be `uv run fastapi run app/main.py --host 127.0.0.1` (TS-001 step 4 omits `--host`, and `fastapi run` binds `0.0.0.0` by default). OK to apply in BE-026? | Yes, apply |
