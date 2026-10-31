---
project: mitali-portfolio
cloud: none
iac: none
backend: python-fastapi
frontend:               # two web apps, same stack; only ONE is deployed at a time (SD-115). frontend/: public site pre-rendered at build time + client-rendered /admin
  - { stack: react, role: "public site + admin (current)", path: frontend }
  - { stack: react, role: "design variant frontend-2 (public site + admin)", path: frontend-2 }   # CHG-012, SD-111
mobile: none
mobile_platforms: []
database: postgresql
auth: session-cookie    # single admin, email + password (Argon2id), server-side session, HttpOnly cookie (SD-007)
ci: none                # local only for now (SD-012)
stack_profiles: [stack-python-fastapi, stack-react, stack-postgresql]
mcp_servers: []
preferences: { database: postgresql, backend: python-fastapi, frontend: react, build_tool: vite, prerender: project-script, orm: sqlalchemy-async, migrations: alembic, server_state: tanstack-query, forms: react-hook-form, validation: zod, api_client: openapi-fetch, auth: server-session-cookie, python_deps: uv }   # source per entry in section 2a
---

# System Design — mitali-portfolio

> Project-level decisions that rarely change. The YAML header above is machine-read by every
> builder, reviewer and tester agent. Per-feature detail belongs in `tech-spec.md`.
> Status tags: `ID [STATUS YYYY-MM-DD HH:MM]`.
> Stack chosen per layer by the developer at gate G1 (`.dev-pipeline/intake.md` section 5).

## 1. Architecture overview
A small **modular monolith**, run locally:

- **Backend** (`backend/`): one FastAPI application. It exposes a read-only public content API (used at build time by the
  pre-renderer), the public contact endpoint (used at runtime), the authenticated admin API (CRUD, uploads, enquiries,
  settings), and serves uploaded and seeded media from `backend/media/`. CLI commands live alongside it
  (`create-admin`, `reset-password`, `seed`). PostgreSQL 17 holds all content, enquiries, the admin user, sessions and
  rate-limit counters.
- **Frontend** (`frontend/`): one React + Vite + TypeScript app with two parts:
  - **Public site**: routes `/`, `/work`, `/work/:slug`, `/writing`, `/writing/:slug`, `/about`, `/contact`, `/faqs`, 404.
    At build time a pre-render script fetches all published content from the public API and renders every public route to
    static HTML (with head tags and embedded data for hydration). In the browser the pages hydrate for interactivity
    (menu, accordions, carousel, writing filter, contact form).
  - **Admin**: routes under `/admin`, rendered client-side only (one HTML shell, `noindex`), talking to the admin API with
    the session cookie.
- **Publishing**: content edits are stored immediately; the public site changes when the "rebuild site" command
  (`npm run build:site`) re-runs the pre-render (REQ-052). The backend records a `content_changed_at` timestamp; the build
  writes a `build-info.json` with its build time, which the admin dashboard compares to show "Site needs rebuilding".
- **Serving locally (single origin)**: in development the Vite dev server (port 5173) proxies `/api` and `/media` to
  FastAPI (port 8000). For a production-like local run FastAPI serves the pre-rendered `frontend/dist` as static files
  plus `/api` and `/media`, so the session cookie is first-party and no CORS is needed.
- **Design variant `frontend-2/`** (CHG-012, SD-111..SD-117): a second, self-contained React app with the same stack, screens,
  behaviour, API usage and SEO outputs as `frontend/`, and a new visual and motion design (design-brief section 7). It talks to the
  same backend (no API, backend or database change). In development it runs on its own Vite dev server (port 5174) with the same
  `/api` and `/media` proxy, plus a dev-only Origin rewrite for `/api/admin` (SD-112). Only one front end is deployed: the backend
  serves whichever pre-rendered build `FRONTEND_DIST_DIR` points to (SD-115); `frontend/` stays the default.

```mermaid
flowchart LR
  D1[Browser :5173] -->|/api, /media| V1[Vite dev frontend/]
  D2[Browser :5174] -->|/api, /media| V2[Vite dev frontend-2/<br/>dev-only Origin rewrite for /api/admin]
  V1 --> BE[FastAPI :8000]
  V2 --> BE
  BE --> DB[(PostgreSQL 17 :5442)]
  P[Production-like preview] -->|FRONTEND_DIST_DIR = frontend/dist (default)<br/>or frontend-2/dist (process env)| BE
```

```mermaid
flowchart LR
  V[Visitor browser] -->|static HTML + JS| S[Pre-rendered site<br/>frontend/dist]
  V -->|POST /api/public/enquiries| BE[FastAPI backend]
  A[Admin browser /admin] -->|/api/admin/* + session cookie| BE
  B[Build: npm run build:site] -->|GET /api/public/*| BE
  B -->|writes HTML, sitemap.xml, robots.txt| S
  BE --> DB[(PostgreSQL 17<br/>port 5442)]
  BE --> M[/backend/media<br/>uploads + seed images/]
  CLI[CLI: create-admin, reset-password, seed] --> DB
```

## 2. Technology decisions
| ID | Layer | Technology | Why chosen | Alternatives rejected | Status |
|----|-------|------------|-----------|----------------------|--------|
| SD-001 | Backend | Python 3.12 + FastAPI, Pydantic v2, SQLAlchemy 2.0 (async, `asyncpg`), Alembic, `pydantic-settings`; profile `stack-python-fastapi` | Developer's choice; small API surface (content CRUD, uploads, contact form, auth) fits FastAPI well; Python 3.12.6 installed | .NET (developer preference for Python) | NEW 2026-10-29 16:06 |
| SD-002 | Frontend | React 19 + Vite + TypeScript (strict), React Router (data routers), TanStack Query (admin), React Hook Form + Zod; profile `stack-react` | Developer's choice; one app covers the public site and the admin | Next.js (best SEO, but a different framework); plain React SPA (weak SEO and link previews) | NEW 2026-10-29 16:06 |
| SD-003 | Frontend / SEO | **Build-time pre-rendering with a project script** (`frontend/scripts/prerender.ts`) using Vite's SSR build of an `entry-server.tsx`, React Router's static data router (`createStaticHandler` / `createStaticRouter`) and `react-dom/server`. Route loaders fetch from the public API; each route's HTML is written to `dist/<route>/index.html` with head tags (title, description, canonical, Open Graph) and serialized loader data; the client hydrates with `createBrowserRouter` + `hydrationData`. The script also writes `sitemap.xml`, `robots.txt` and `404.html`. `/admin` gets one client-only shell. | Keeps the chosen stack (Vite + React Router, as the profile describes), gives full HTML for SEO and link previews, no runtime Node server, few dependencies | `vite-react-ssg` / `vite-plugin-ssr` (third-party, extra conventions and maintenance risk); React Router framework mode with `prerender` (changes the project structure away from the profile); Next.js (rejected at G1); runtime SSR (needs a Node server, unnecessary for a low-traffic portfolio) | NEW 2026-10-29 16:06 |
| SD-004 | Database | PostgreSQL 17, local Windows service on **port 5442** (not 5432, which is PostgreSQL 16); databases `mitali_portfolio` (dev) and `mitali_portfolio_test` (tests); profile `stack-postgresql` | Relational content with ordering, foreign keys and simple filtering; already installed; `jsonb` for small lists (channels, tags, features) | MySQL, MongoDB (discussed at G1) | NEW 2026-10-29 16:06 |
| SD-005 | Database setup | `backend/scripts/setup_db.ps1` (and `.sql`), run **by the user** with the PostgreSQL superuser via `C:\Program Files\PostgreSQL\17\bin\psql.exe -p 5442`; it creates the app role (password supplied by the user at the prompt) and both databases. App credentials live in git-ignored `backend/.env`; `backend/.env.example` is committed. Agents call psql by full path. | The superuser password is the user's only; never asked for in chat (REQ-072) | Agents creating the DB themselves (needs the superuser password) | NEW 2026-10-29 16:06 |
| SD-006 | Testing (backend) | `pytest` + `pytest-asyncio` + `httpx.AsyncClient` against the local `mitali_portfolio_test` database (schema migrated per test session, transactions rolled back per test). **Deviation from the profile:** no Testcontainers, because the Docker engine is not running and the user decided Docker is not needed. | Real PostgreSQL behaviour without Docker | Testcontainers (needs Docker), SQLite (different engine behaviour) | NEW 2026-10-29 16:06 |
| SD-007 | Auth | Single admin. Email + password hashed with **Argon2id** (`argon2-cffi`). Server-side sessions in a `sessions` table; a random 256-bit token (stored hashed) in an `HttpOnly`, `SameSite=Strict`, `Path=/` cookie (`Secure` when served over HTTPS; locally over http the flag is configurable); 8 h idle / 7 d absolute expiry. CSRF: `SameSite=Strict` plus a double-submit token (`X-CSRF-Token` header) on all state-changing admin requests. Login throttling persisted in the database (REQ-061). Admin created and reset only via CLI (REQ-062). **Deviation from the profile's OAuth2/JWT default**, recorded here. | One user, minimal attack surface, revocable sessions, nothing in `localStorage` | JWT in local storage (rejected at G1); external identity provider (overkill for one user, costs) | NEW 2026-10-29 16:06 |
| SD-008 | Media | Uploads stored on disk under `backend/media/uploads/` (seed images under `backend/media/seed/`), served by FastAPI at `/media/...`; the DB stores relative paths. Raster uploads (JPEG, PNG, WebP) are re-encoded with **Pillow** into responsive WebP sizes (e.g. 480, 960, 1600 px) and metadata is stripped; SVG uploads are sanitized and served with a restrictive CSP. Max 10 MB per file. | Local-only, no cloud storage needed; responsive images for performance (REQ-NFR-004) | Cloud blob storage (cloud deferred); serving originals only (slow pages) | NEW 2026-10-29 16:06 |
| SD-009 | Rich text | Writing-sample bodies and long texts stored as **Markdown**; the backend renders Markdown to HTML (`markdown-it-py`) and sanitizes it with an allow-list (`nh3`) when content is saved, returning `body_html`. The frontend inserts only this sanitized HTML. The admin editor is a Markdown textarea with live preview. | Safe formatting without a heavy WYSIWYG editor; one sanitization point | WYSIWYG HTML editor (larger XSS surface), plain text only (requirement asks for formatting) | NEW 2026-10-29 16:06 |
| SD-010 | Rate limiting / spam | Contact form: honeypot field + DB-backed fixed-window counter keyed by client IP (5 per 10 min). Login: DB-backed failure counter per account and per IP (5 per 15 min, 15 min block). | Survives restarts; no extra service (Redis) for a single-instance local app | `slowapi` in-memory (lost on restart), Redis (extra service), CAPTCHA (third-party, hurts UX) | NEW 2026-10-29 16:06 |
| SD-011 | Tooling | Backend dependencies with **uv** (`pyproject.toml` + `uv.lock`); lint/format `ruff`, types `mypy --strict`, security `pip-audit`, `bandit`. Frontend with npm (`package-lock.json`), ESLint, `tsc --noEmit`, Vitest + React Testing Library + MSW, Playwright for E2E, Lighthouse 13 run by the E2E harness (`frontend/e2e/03-lighthouse.e2e.ts`, `LIGHTHOUSE_BIN`) for REQ-NFR-004 (changed 2026-10-30 14:21, CHG-008: `@lhci/cli` dropped — 13 high-severity transitive advisories and its bundled Lighthouse 12 fails on Chromium 156). API client generated from `docs/api-contract.yaml` with `openapi-typescript` + `openapi-fetch`. Fonts self-hosted from the official Antonio and Public Sans releases. uv is installed under the Python user Scripts folder (not on PATH): agents run it as `python -m uv`. | Matches the profiles; reproducible installs | Poetry (uv is faster and simpler); hand-written API client (profile forbids) | NEW 2026-10-29 16:06 |
| SD-012 | Cloud / IaC / CI | None for now: local development only. `cloud: none`, `iac: none`, `ci: none`. Repository: `https://github.com/nimesh-patel-1994/mitali-portfolio` (remote `origin`; push only when the user asks). | Hosting deferred by the user | Azure + Terraform (later, via `/feature`) | NEW 2026-10-29 16:06 |
| SD-013 | Content model | Ordering via an integer `position` per entity; publish via a `is_published` flag; slugs unique per entity; sample-data flag `is_sample` on case studies, results and writing samples; singletons for profile and site settings. Detail in `tech-spec.md`. | Matches REQ-063/064/067 directly | Draft/revision history (not required) | NEW 2026-10-29 16:06 |

### 2a. Architecture decisions
<!-- From the Technical preferences step (added by /upgrade-project, toolkit 1.2.0, 2026-10-31 02:17). Source: developer = stated by the developer (never overridden); suggested = recommended and accepted. Precedence for every agent: developer, then suggested, then the stack profile default. -->
| ID | Area | Decision | Source | Why | Enforced by | Status |
|----|------|----------|--------|-----|-------------|--------|
| SD-100 | Database | PostgreSQL 17 (local service, port 5442) | developer (G1) | Chosen by the developer at G1 (SD-004) | header `database`, stack-postgresql | IMPLEMENTED 2026-10-31 02:17 |
| SD-101 | Backend | Python FastAPI | developer (G1) | Chosen by the developer at G1 (SD-001) | header `backend`, stack-python-fastapi | IMPLEMENTED 2026-10-31 02:17 |
| SD-102 | Web app | React | developer (G1) | Chosen by the developer at G1 (SD-002) | header `frontend`, stack-react | IMPLEMENTED 2026-10-31 02:17 |
| SD-103 | Build tool | Vite | suggested | Proposed with React at G1; profile default | stack-react | IMPLEMENTED 2026-10-31 02:17 |
| SD-104 | Pre-rendering | Project script on Vite SSR + React Router static handler | suggested | SD-003 (SEO without a Node server) | TS-005, UI-004 | IMPLEMENTED 2026-10-31 02:17 |
| SD-105 | Data access | SQLAlchemy 2.0 async (asyncpg) + Alembic migrations | suggested | Profile default; SD-001 | stack-python-fastapi, BE-002 | IMPLEMENTED 2026-10-31 02:17 |
| SD-106 | Server state (admin) | TanStack Query | suggested | Profile standard (stack-react) | UI-035 | IMPLEMENTED 2026-10-31 02:17 |
| SD-107 | Forms and validation | React Hook Form + Zod (zod/mini on public pages, jitless) | suggested | Profile standard; CHG-008 jitless for CSP | UI-040, UI-033 | IMPLEMENTED 2026-10-31 02:17 |
| SD-108 | API client | openapi-typescript + openapi-fetch, generated from `api-contract.yaml` | suggested | Profile rule: generated client only | UI-035, contract check | IMPLEMENTED 2026-10-31 02:17 |
| SD-109 | Auth | Server-side session cookie + CSRF, Argon2id, CLI-only admin | suggested | SD-007 (single admin) | BE-008..011, SEC-BE-001..006 | IMPLEMENTED 2026-10-31 02:17 |
| SD-110 | Tooling | uv (Python deps), ruff, mypy strict, pytest; Vitest + RTL + MSW, Playwright + axe; Lighthouse 13 via the E2E harness | suggested | SD-011, CHG-008 | backend/frontend checks | IMPLEMENTED 2026-10-31 02:17 |
| SD-111 | Web app (variant) | **`frontend-2/`: a second, fully self-contained React app** (role "design variant frontend-2 (public site + admin)") with the same major versions and tooling as `frontend/`: React 19.3, React Router 8.5 (data routers), Vite 8.3, TypeScript 5.9 strict, TanStack Query (admin), React Hook Form + Zod through the jitless wrappers (CSP, CHG-008), openapi-typescript + openapi-fetch, Vitest + RTL + MSW, Playwright + axe. Own `package.json`, lockfile, build output (`frontend-2/dist`), pre-render and compress scripts, style check, and its own generated API client from the same `docs/api-contract.yaml`. **Never imports from `frontend/`**. **Known cost (accepted):** the API client, content source/hydration, pre-render, compress script, SEO helpers, shared utils (labels, URL guards, date formatting, zod wrappers) and their tests exist twice; a fix in one must be repeated in the other (the parity check, TS-033, catches behavioural drift). Rejected: a shared package or workspace (couples the two apps and changes `frontend/`), importing from `../frontend` (breaks self-containment), a theme switch inside `frontend/` (touches the delivered app) | developer (G1) | Client wants a second design option without risk to the delivered front end | header `frontend` list, REQ-080, TS-020, UI-100, UI-REV-026 | NEW 2026-10-31 02:54 |
| SD-112 | Dev server (variant) | frontend-2's Vite dev server on `localhost:5174` (`strictPort`), proxying `/api` and `/media` to `http://127.0.0.1:8000` like `frontend/`. **Dev-only Origin rewrite:** in the Vite **dev server** proxy only, and only for `/api/admin` requests whose `Origin` is the frontend-2 dev origin (`http://localhost:5174` or `http://127.0.0.1:5174`), the `Origin` header is replaced with the backend's own origin `http://127.0.0.1:8000`. Reason: the backend's Origin check (TS-003 step 5, SEC-BE-004) allows only the origins in `ALLOWED_ORIGINS` (5173 and 8000), and the user decided not to change `ALLOWED_ORIGINS` or any `.env`. **Risk:** for requests that already come from the 5174 dev page, the backend's Origin check is bypassed in development (layer 2 of 3); SameSite=Strict and the session-bound CSRF token remain, and other origins are passed through unchanged and still rejected. Never in the build output, `vite preview` or production; production is unaffected because only one front end is deployed and it is served same-origin by the backend. Note: admin cookies are host-only for `localhost` and are shared between 5173 and 5174 in development (one session, logout in one ends both). Verification: SEC-UI-014 | developer (G1) | Run frontend-2's admin in dev without a backend or `.env` change | TS-027, UI-113, UI-REV-029, SEC-UI-014 | NEW 2026-10-31 02:54 |
| SD-113 | Fonts (variant) | Inter Tight 300 (display), Public Sans 400 / 400 italic / 600 (body), Antonio 500 / 700 (wordmark, labels), **self-hosted from the Fontsource npm packages** (`@fontsource/inter-tight`, `@fontsource/public-sans`, `@fontsource/antonio`), Latin subset files only, `font-display: swap`, display font preloaded; bundled by Vite into `/assets` (served `immutable`, `font-src 'self'`). Licences: SIL OFL 1.1 expected, **to be verified from each package's licence file** (UI-T-131). `frontend/` keeps its official-release WOFF2 files (SD-011) | developer (G1) | Light, tightly tracked display like the inspiration, free licence, no CDN | REQ-NFR-012, DES-050, TS-021 | NEW 2026-10-31 02:54 |
| SD-114 | Motion (variant) | **No motion library.** One shared `IntersectionObserver` + CSS transitions for reveals; CSS scroll-driven animations (`animation-timeline: view()`) for parallax bands and collage drift with a static fallback; CSS hovers; the View Transitions API for route cross-fades (progressive, off under reduced motion). Budget ≤ 2 KB gzip JS, `transform`/`opacity` only. Rejected: GSAP + ScrollTrigger (≈35-40 KB, proprietary no-charge licence, not open source), Motion (≈15 KB; kept as a later option), smooth-scroll libraries (scroll hijacking) | developer (G1) | Smallest JS, CSP-safe, reduced-motion friendly | REQ-084, REQ-094, REQ-NFR-009, TS-022, TS-024 | NEW 2026-10-31 02:54 |
| SD-115 | Deployment (variant) | **Only one front end is deployed.** The backend serves the chosen pre-rendered build through its existing `FRONTEND_DIST_DIR` setting (default `../frontend/dist`, unchanged). For a local production-like preview of frontend-2, the start command sets `FRONTEND_DIST_DIR` (and `SERVE_FRONTEND=true`) as **process environment variables for that run only** (they override the dotenv values in `pydantic-settings`), never in `.env`. frontend-2 is never part of `frontend/`'s deployment. The dashboard's "needs rebuild" check then reads the selected build's `build-info.json`; its constant rebuild command still names `frontend` (requirements OQ-16) | developer (G1) | No backend change; one switch | REQ-091, TS-032 | NEW 2026-10-31 02:54 |
| SD-116 | Run kit (variant) | `run/run.json` gets a second web app `web2` (dir `frontend-2`, port 5174, `npm run dev`, `depends_on: [api]`, opens `http://localhost:5174/`) in PH-2; the existing `web` app and `start-classic.cmd` stay exactly as they are (CLAUDE.md rule 19) | developer (G1) | Start both designs side by side | REQ-092, TS-028, UI-114 | NEW 2026-10-31 02:54 |
| SD-117 | Testing (variant) | UI-first **without a mock API** (deviation from the `ui-first` skill's mock rule, user decision): development and the P1 review use the real backend on the dev database; Playwright E2E for frontend-2 runs against the real backend on the seeded **test** database (`mitali_portfolio_test`); pre-rendering builds read the dev database through the API, never production. Unit/component tests use MSW typed from the contract, as in `frontend/`. The orchestrator states which database the backend uses before every build or test run | developer (G1) | Real data from day one; no mock to maintain | REQ-081, REQ-NFR-013, TS-033 | NEW 2026-10-31 02:54 |
| SD-118 | Header scroll listener (variant) | **The single deliberate exception to the motion budget (REQ-NFR-009).** The frontend-2 header (REQ-085) uses exactly one passive `scroll` listener, throttled to once per animation frame, that reads `scrollY` only (no layout reads) and toggles a class on the header. It ignores movements under about 8 px; the header is always shown near the top (within the header height), whenever it contains keyboard focus (`:focus-within`), while the mobile menu is open, and always under `prefers-reduced-motion: reduce` (never hidden). Hiding uses `transform` only. | developer (G2) | Scroll direction is not available from CSS in every browser; agreed at G2 | REQ-085, REQ-NFR-009, UI-T for the header, UI-REV (no other scroll listeners) | NEW 2026-10-31 02:59 |

## 3. Non-functional targets
- **Scale:** one admin; low public traffic (hundreds of visits per day at most once hosted). Single backend instance.
- **Performance:** public pages are static HTML; Lighthouse (mobile) ≥ 90 in all four categories on a local production
  build (REQ-NFR-004); LCP image served as responsive WebP; fonts preloaded, `font-display: swap`; JS for public pages
  kept small (admin code split into its own lazy chunk, never loaded by public pages).
- **API latency (local):** p95 < 200 ms for admin reads and writes, excluding image processing (< 3 s for a 10 MB upload).
- **Availability / RPO / RTO:** not applicable while local-only. Data protection relies on the user's machine; a
  `pg_dump` backup command is documented in the README.
- **Accessibility:** WCAG 2.1 AA (REQ-NFR-002), reduced motion (REQ-NFR-003).
- **Compliance / privacy:** no regulated data. Enquiries contain names and emails; they are never logged, only shown to
  the admin, and can be archived or deleted (REQ-NFR-005).
- **Cost ceiling:** zero running cost; open-source tools and open-licence fonts only (REQ-NFR-008).
- **Responsive:** 360 px to 1920 px (REQ-NFR-001).
- **frontend-2 (CHG-012):** Lighthouse mobile ≥ 90 Performance and 100 Accessibility / Best Practices / SEO on every public page on an
  idle machine (CPU `benchmarkIndex` recorded), public JS ≤ `frontend/`'s shared entry, CLS < 0.05, motion JS ≤ 2 KB gzip
  (REQ-NFR-009, REQ-NFR-011); axe clean on every screen state at 375 / 768 / 1024 / 1440 px (REQ-NFR-010).

## 4. Environments and deployment
| Environment | Where | Database | How it runs |
|-------------|-------|----------|-------------|
| dev | User's Windows machine | `mitali_portfolio` on PostgreSQL 17, port 5442 | `uv run fastapi dev` (port 8000) + `npm run dev` (Vite, port 5173, proxy `/api` and `/media` to 8000) |
| test | Same machine, run by agents and the user | `mitali_portfolio_test`, port 5442 | `uv run pytest`; `npm test`; Playwright E2E against a locally started backend (seeded test DB) and the built site |
| local preview (production-like) | Same machine | `mitali_portfolio` | `npm run build:site` (pre-render against the running API) then FastAPI serves `frontend/dist` + `/api` + `/media` on one port |
| dev (frontend-2) | Same machine | `mitali_portfolio` (through the API) | backend as above + `cd frontend-2; npm run dev` (Vite, port 5174, same proxy + dev-only Origin rewrite, SD-112); or run kit app `web2` |
| test (frontend-2) | Same machine | `mitali_portfolio_test`, port 5442 | `npm test` in `frontend-2/`; Playwright against the backend on the seeded test DB (dev server in PH-2, production-like preview of `frontend-2/dist` from PH-3) (SD-117) |
| local preview (frontend-2) | Same machine | `mitali_portfolio` | `npm run build:site` in `frontend-2/` (pre-render against the running API), then the backend started with `FRONTEND_DIST_DIR` pointing at `frontend-2/dist` as a process environment variable (SD-115) |
| prod | Not defined | — | Deferred; hosting will be added through `/feature`. Only one front end will be deployed (SD-115) |

Branching: `main` is the default branch on the remote; work happens on feature branches merged into `main`. The local
repository is currently on `master` with no commits; branch alignment happens at the first commit the user asks for.
Commits and pushes only on request, to `origin` only, never force-push (CLAUDE.md rule 12).

## 5. Integrations and external systems
| System | Purpose | Protocol | Auth |
|--------|---------|----------|------|
| Booking service (unspecified) | "Book a call" link | Plain outbound link (new tab) to the URL in site settings; no API | None |
| Social networks (LinkedIn, Instagram placeholders) | Footer links | Outbound links | None |
| Email (deferred) | Enquiry notifications | Not built; `notification_email` setting stored only | — |

No analytics, no third-party scripts, no external fonts or CDNs at runtime.

## 6. Cross-cutting concerns
- **Logging:** structured JSON logs from FastAPI (request id, route, status, duration); never log passwords, session
  tokens, CSRF tokens or enquiry contents (names, emails, messages).
- **Error handling:** one error envelope for the API (`{ "error": { "code", "message", "fields"? } }`) via registered
  exception handlers; the frontend maps it to field errors and toasts. Public pages have a route error boundary and a
  404 page.
- **Config and secrets:** `pydantic-settings` reading `backend/.env` (git-ignored); `backend/.env.example` committed.
  Frontend build config via `frontend/.env` (`VITE_*` holds only public values such as the site URL; the pre-render reads
  `API_BASE_URL` from the build environment). No secrets in the repository.
- **Security headers:** CSP (self only; no inline scripts except the hashed hydration-data script), `X-Content-Type-Options`,
  `Referrer-Policy`, `frame-ancestors 'none'`; detail in `security.md`.
- **Multi-tenancy / i18n:** none. English (`en`) only; dates formatted with `Intl`.
- **Content rule:** all text, images and data are original or dummy; nothing from the reference site, no hot-linking
  (CLAUDE.md rule 11).
- **Design tokens:** every UI value comes from `docs/design-brief.md` tokens (CLAUDE.md rule 10).

## 7. Decision log
| Date | Decision | Reason | Supersedes |
|------|----------|--------|-----------|
| 2026-10-29 | Stack per layer: FastAPI, one React (Vite) app with pre-rendered public pages and client-rendered `/admin`, PostgreSQL 17 on port 5442, no mobile, no cloud | Developer's choices at gate G1 | — |
| 2026-10-29 | Pre-render with a project script on Vite SSR + React Router static handler (SD-003) | Resolves the intake's open question on the pre-render approach while keeping the profile's structure | — |
| 2026-10-29 | Local test database instead of Testcontainers (SD-006) | Docker engine not running; user decided Docker is not needed | Profile default |
| 2026-10-29 | Server-side session cookie instead of OAuth2/JWT (SD-007) | Single admin, minimal surface, revocable | Profile default |
| 2026-10-29 | Case-study URLs at `/work/<slug>` | Matches the "Work" navigation label | Reference's `/projects/<slug>` |
| 2026-10-29 | Remote `origin` = github.com/nimesh-patel-1994/mitali-portfolio | Given by the user | — |
| 2026-10-31 | Second web app `frontend-2/` as a self-contained design variant with the same stack; header `frontend` becomes a list (SD-111) | Client design option without touching the delivered front end | header `frontend: react` |
| 2026-10-31 | Dev-only Origin rewrite for `/api/admin` in frontend-2's Vite dev server instead of widening `ALLOWED_ORIGINS` (SD-112) | No backend or `.env` change (user decision); production unaffected | — |
| 2026-10-31 | Fonts for frontend-2 from Fontsource packages (Inter Tight, Public Sans, Antonio) (SD-113) | Free licences, self-hosted, light display style | — |
| 2026-10-31 | Motion without a library for frontend-2 (SD-114) | ≤ 2 KB JS, CSP-safe, reduced-motion friendly | — |
| 2026-10-31 | One deployed front end selected by `FRONTEND_DIST_DIR`; frontend-2 preview via process env only (SD-115) | No backend change; `.env` untouched | — |
| 2026-10-31 | Run kit app `web2` for frontend-2; `start-classic.cmd` unchanged (SD-116) | Both designs runnable side by side | — |
| 2026-10-31 | frontend-2 UI-first without a mock API; E2E on the test DB (SD-117) | User decision at G1 | `ui-first` mock rule (for this variant) |
