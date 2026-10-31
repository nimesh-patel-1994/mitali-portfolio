# Phases: mitali-portfolio

> Delivery plan. Requirements are grouped into small phases that each end in something you can run or see. Only the ACTIVE phase gets full
> specs and code; later phases stay outlines until they start (this keeps every session small and cheap). Managed by `/phase` and the `phasing` skill.
> Phase status: `PH-n [PLANNED|ACTIVE|DELIVERED|SKIPPED <date time>]`. Items carry `@PH-n` after their status tag.
> Created by `/upgrade-project` (toolkit 0.5.0 → 1.2.0) on 2026-10-31 02:16. The project was built before phases existed, so every item delivered so far
> belongs to PH-1; items without an `@PH-n` marker are PH-1 items.

ui_first: yes                   <!-- applies to the frontend-2 variant only (PH-2..PH-4); frontend/ was built before UI-first existed and is not a UI-first app -->
design_freeze: open             <!-- frontend-2: open until `/ui-review freeze` (gate G-D) in PH-4, before the final review; frontend/ has no freeze (n/a) -->
size: auto
points_per_usage_pct: unknown   <!-- PH-1 predates calibration; first calibration at the PH-2 gate -->

## Plan
| Phase (kind) | Goal | Deliverable (what you can run or see) | REQ items | Points | Depends on | Status |
|-------|------|----------------------------------------|-----------|--------|------------|--------|
| PH-1 (full build) | Portfolio site, admin area, tests and launcher | Public site + /admin on the dev database via `start-classic.cmd`; tests green | REQ-001..REQ-072, REQ-NFR-001..008 (44) | n/a (pre-phasing) | — | DELIVERED 2026-10-31 13:40 |
| PH-2 (ui-prototype, frontend-2) | Prove the frontend-2 look, type, motion and shell on real data | `frontend-2` dev server on http://localhost:5174 (real API, dev DB): tokens, fonts, header/menu/footer, motion system, Home and a case-study page; admin login works through the dev proxy | REQ-080, 081, 082, 083, 084, 085, 086, 090, 092, 094, REQ-NFR-009, 012, 013 (13) | 19 | PH-1 | ACTIVE 2026-10-31 02:54 |
| PH-3 (full parity, frontend-2) | Every remaining public and admin screen; SEO outputs; production-like preview | All screens of `frontend/` on frontend-2; pre-rendered build served by the backend via `FRONTEND_DIST_DIR`; parity matrix complete; parity check green | REQ-087, 088, 089, 091, 093, 095, 096, 097 (8) | 17 | PH-2 | PLANNED 2026-10-31 02:54 |
| PH-4 (polish, freeze, close-out, frontend-2) | Polish, design freeze, final review and tests | Frozen design (G-D), review and test loops passed, Lighthouse budget met, docs and run kit closed out, push plan | REQ-NFR-010, 011 (2) + close-out | 4 + close-out | PH-3 | PLANNED 2026-10-31 02:54 |

Points: S=1, M=2, L=4 (phasing skill). PH-2 = 19 points after G2 (2026-10-31 02:59: REQ-095 image polish moved to PH-3 by the user; REQ-094 view transitions stays in PH-2
for the P1 decision). Still above the "auto = medium" target of about 12 (not yet calibrated); accepted by the user. Per-REQ sizes: REQ-080 M, 081 S, 082 S, 083 S, 084 M, 085 S, 086 L, 090 M, 092 S, 094 S, 095 S, NFR-009 S, NFR-012 S, NFR-013 S;
REQ-087 L, 088 L, 089 M, 091 M, 093 M, 096 S, 097 S; NFR-010 M, NFR-011 M.

## Phase details

### PH-1 [DELIVERED 2026-10-31 13:40]: Initial build
- Goal: the full portfolio (public site, admin, seed, tests, launcher) from the intake brief.
- Deliverable and demo steps: `start-classic.cmd` → http://localhost:5173/ and /admin (see `start.md`).
- REQ items: all 44 (REQ-001..REQ-072, REQ-NFR-001..008), IMPLEMENTED (CHG-001..CHG-010).
- Layers touched: backend (FastAPI), web app `frontend/` (React), database (PostgreSQL 17). No mobile, no cloud.
- Out of scope: hosting and cloud, email notifications, analytics.
- Delivered on / usage / notes: 2026-10-31; usage not calibrated (phasing introduced afterwards); pushed to origin/main (54dfefe).

### PH-2 [ACTIVE 2026-10-31 02:54]: frontend-2 UI prototype (kind: ui-prototype)
- Status 2026-10-31 06:57: PH-2 built (frontend-2 unit tests 234 pass); browser tests run 1: 16 passed, 1 skipped, 12 failed (non-design); fixes applied but unverified; run kit starts all three apps; P1 review not yet held. See PENDING-WORK.md.
- Goal: build the frontend-2 foundation and the two most expressive pages on real data so the visual direction can be reviewed early.
- Deliverable and demo steps: start the backend (dev DB `mitali_portfolio`) and `cd frontend-2; npm run dev` (or the run kit's `web2` app) →
  http://localhost:5174/ (Home) → a case study from "Featured work" → open the mobile menu at 375 px → scroll to see the header hide/reveal and
  the reveals. frontend-2 has no admin screens yet in PH-2; the dev proxy and the dev-only Origin rewrite for `/api/admin` are proved by an
  automated check (UI-T-149: a login request through port 5174 is not rejected with `origin_rejected`), so PH-3 can build the admin on it.
- Specs: full (SystemDesign SD-111..SD-117; tech-spec TS-020..TS-028 and the PH-2 part of TS-033; design-brief DES-050..DES-065;
  ui-scope UI-100..UI-115, UI-REV-026..UI-REV-037, UI-T-127..UI-T-153; security SEC-UI-013..SEC-UI-019).
- REQ items: REQ-080, REQ-081, REQ-082, REQ-083, REQ-084, REQ-085, REQ-086, REQ-090, REQ-092, REQ-094, REQ-NFR-009, REQ-NFR-012,
  REQ-NFR-013.
- Layers touched: web app `frontend-2/` only, plus `run/run.json` (one new app entry). No backend, database, contract or `frontend/` change.
- **Deviation from the `ui-first` skill (user decision at G1):** no mock API and no `API_MODE` switch; the prototype reads the real backend on the
  development database, and E2E runs against the seeded test database. The run kit therefore keeps the database and API services.
- **Gate: P1 review via `/ui-review`** (a review round, not the freeze). Decisions to take there:
  1. base surface: cream `#FFFDE9` (default) vs white `#FFFFFF` (dev-only comparison switch, DES-051);
  2. type scale checked at 375 / 768 / 1024 / 1440 px (DES-057);
  3. keep or drop route view transitions (REQ-094; drop if they break focus management or scroll reset);
  4. header scroll-direction approach (requirements open question 13).
- Out of scope: remaining public pages, all frontend-2 admin screens, pre-render/SEO build, JSON-LD, admin skeletons, Lighthouse budget.
- Risks: React Router 8.5 view-transition API details; CSS scroll-driven animation support differs per browser (static fallback); dev-only
  Origin rewrite must never reach a build (SEC-UI-014); points above the medium target.

### PH-3 [PLANNED 2026-10-31 02:54]: frontend-2 full parity (outline)
- Remaining public screens (Work, Writing + `?format=`, writing sample, About, FAQs, Contact with all form states) — REQ-087.
- Admin area complete (login, layout/guard/sidebar/logout, dashboard incl. needs-rebuild, case studies list + Details/Results/Gallery, writing
  list + editor, services, engagement models, testimonials, FAQs (categories + items), values, process steps, profile, settings, enquiries list +
  detail, admin 404, unsaved-changes guard, confirm dialogs, toasts, reorder, Markdown editor with preview, media picker/upload) — REQ-088;
  admin skeletons — REQ-096.
- Pre-render, SEO outputs, compress script (duplicated, same outputs), JSON-LD — REQ-089, REQ-097.
- Production-like preview via `FRONTEND_DIST_DIR` as a process environment variable — REQ-091.
- Image loading polish (placeholder frames, eager + high priority for the largest image) — REQ-095 (moved from PH-2 at G2).
- Screen-parity matrix complete and automated parity check — REQ-093.
- Outline ids already reserved: TS-029..TS-032, UI-120..UI-145, UI-T-154..UI-T-162 (partly PH-4). Full specs are written when PH-3 becomes
  ACTIVE.

### PH-4 [PLANNED 2026-10-31 02:54]: frontend-2 polish, design freeze and close-out (outline)
- Polish round(s) via `/ui-review`, then **`/ui-review freeze` (gate G-D)** before the final review: `design_freeze: FROZEN <date time>`.
- Review loop and test loop (cap 3 rounds each), axe per state per width (REQ-NFR-010), Lighthouse budget on an idle machine with
  `benchmarkIndex` recorded (REQ-NFR-011).
- Close-out: README section for frontend-2, run kit check (`make-run-kit.ps1 -CheckOnly`), `docs/FEATURE.html` unchanged (features are
  identical; only the design differs), push plan for the user (commit and push only when asked).
- Outline ids already reserved: UI-150..UI-152.

## Backlog (agreed but not yet in a phase)
- (none) — the frontend-2 design variant is planned as PH-2..PH-4 (CHG-012).

## Calibration (filled at each phase gate)
| Phase | Points planned | Points done | Usage used (%) | Percent per point | Cached tokens read / written (Settings > Usage) | Rounds (review/test) | Notes |
|-------|----------------|-------------|----------------|-------------------|--------------------------------------------------|----------------------|-------|
| PH-1 | n/a | n/a | n/a | n/a | n/a | review 3 + 1 extra, test 2 | predates phasing |
