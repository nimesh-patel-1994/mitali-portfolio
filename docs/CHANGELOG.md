# Changelog — mitali-portfolio

> Append-only. One entry per change set. Newest first. Times in the user's local timezone.

## CHG-013 — 2026-10-31 06:57 — frontend-2 PH-2 build, browser tests run 1, run kit with three apps, session checkpoint
- UI-100..UI-115: NEW → IN-PROGRESS (fe-builder 2026-10-31 03:01; UI-114 run kit by the orchestrator). Nothing IMPLEMENTED.
- frontend-2 PH-2 checks: lint 0, tsc clean, Vitest 234/234, build + dist scan OK, motion 1023 B gzip, entry 112.7 kB gzip.
- Browser tests run 1 (TEST DB mitali_portfolio_test): 16 passed, 1 skipped, 12 failed (axe label-content-name-mismatch on the footer
  CTA; reveal-test locator; header tests scrolling before content loaded). Fixes applied in Footer.tsx and the E2E spec; NOT verified.
  SEC-UI-014 proofs 2-4, UI-T-149, UI-T-152 and UI-T-153 passed. Test backend stopped; test DB left at head 0002, seeded.
- Run kit: `web2` (frontend-2, 5174) added to `run/run.json` (phase PH-2); `start.cmd` starts backend + frontend 1 + frontend-2
  and opens both; `-Only` works. Toolkit template fixes (uncommitted in C:/Dev/multi-agent-setup) regenerated into `run/start.ps1`
  and `run/stop.ps1`: PS 5.1 pid-file write/read, pid-list merge across runs, `-Only id,id` splitting, unknown-id error.
- README, start.md, NEW-MACHINE-SETUP.new.md: three apps, URLs, shared dev admin session. PENDING-WORK.md added for resuming.

## CHG-012 — 2026-10-31 02:54 — Feature frontend-2 (design variant): G2 documents (branch feature/frontend-2)
- Scope agreed at G1: a second, self-contained React front end `frontend-2/` with the same screens, behaviour, API usage and SEO
  outputs as `frontend/`, a new visual/motion design inspired by https://theatlyx.com/sportfolio/ecommerce-brand-identity-redesign/
  (inspiration only), improvements #1-#7 (#8 light/dark skipped). No API contract, backend, database, `.env` or `frontend/` change.
  Documents only; no code. Awaiting gate G2.
- requirements.md: section 3.9 with REQ-080..REQ-097 [NEW] (@PH-2: 080, 081, 082, 083, 084, 085, 086, 090, 092, 094, 095;
  @PH-3: 087, 088, 089, 091, 093, 096, 097); REQ-NFR-009 [NEW] @PH-2, REQ-NFR-010 [NEW] @PH-4, REQ-NFR-011 [NEW] @PH-4,
  REQ-NFR-012 [NEW] @PH-2, REQ-NFR-013 [NEW] @PH-2. Priorities proposed (user confirms at G2). Out-of-scope lines for frontend-2;
  open questions 12-16. Existing REQs unchanged.
- phases.md: `ui_first: yes` (frontend-2 only), `design_freeze: open` (frontend-2); PH-2 ui-prototype [ACTIVE] (20 points),
  PH-3 full parity [PLANNED] (16), PH-4 polish/freeze/close-out [PLANNED]; deviation from the ui-first mock rule recorded
  (real API, no mock); backlog entry moved into the plan.
- design-brief.md: section 7 "Variant: frontend-2" with DES-050..DES-065 [NEW] (aspect table DES-050..054, breakpoints DES-055,
  header DES-056, type scale DES-057, motion tokens DES-058, contrast table DES-059, semantic token contract DES-060, grid DES-061,
  images DES-062, view transitions DES-063, admin skin DES-064, wordmark DES-065), colour derivation, typography pairing with
  licences (to be verified), pop-up pattern table; open questions 6-11. DES-001..DES-042 and section 6 unchanged.
- SystemDesign.md: header `frontend` is now a list (frontend, frontend-2); SD-111..SD-117 [NEW] in section 2a (variant app and
  duplication, dev server + dev-only Origin rewrite, Fontsource fonts, motion without library, deployment via `FRONTEND_DIST_DIR`,
  run kit `web2`, testing without a mock API); architecture note + diagram, NFR line, three environment rows, seven decision-log rows.
- tech-spec.md: TS-020..TS-028 [NEW] (full, @PH-2), TS-029..TS-032 [NEW] (outlines, @PH-3), TS-033 [NEW] (test strategy, PH-2 full);
  section 2 states `api-contract.yaml` unchanged and lists the 91 of 92 operations frontend-2 uses; open questions 10-12.
- ui-scope.md: section 7 "App: frontend-2": UI-100..UI-115 [NEW] (full, @PH-2), UI-120..UI-145 [NEW] (outlines, @PH-3),
  UI-150..UI-152 [NEW] (outlines, @PH-4); screen-parity matrix (41 rows); design/responsive/accessibility rules;
  UI-REV-026..UI-REV-037 [NEW]; UI-T-127..UI-T-153 [NEW] (PH-2), UI-T-154..UI-T-162 [NEW] (outlines).
- security.md: trust boundary 8, threats T13-T14; section 4a SEC-UI-013..SEC-UI-019 [NEW] (inherited controls, dev-only Origin
  rewrite with verification, CSP compatibility, JSON-LD escaping, no third-party requests/fonts, admin session handling, one
  deployed front end); matrix rows; SQ-6, SQ-7.
- backend-scope.md: note "frontend-2: no backend items (no backend change)". mobile-scope.md, cloud-scope.md, api-contract.yaml:
  unchanged.
- traceability.md: rows for REQ-080..REQ-097 and REQ-NFR-009..REQ-NFR-013 (NEW).
- Not edited (scope items for the build): `run/run.json` (UI-114), `.gitignore` (TS-020).
- Orchestrator checks after the spec-writer (2026-10-31 02:55): timestamps set from the system clock; DES-059 contrast table recomputed (24
  pairs, 0 mismatches); font licences verified from the npm registry (all OFL-1.1); FRONTEND_DIST_DIR environment override verified;
  Vite `proxyReq` and react-router `viewTransition` confirmed in the installed versions. Inspiration capture stored in
  `.dev-pipeline/reference/inspiration/` (notes, summary and style data committed; screenshots and probe output git-ignored).

- G2 approved by the user (2026-10-31 02:59) with answers: (1) header scroll listener accepted as SD-118, the single exception to REQ-NFR-009
  (passive, once per frame, class toggle only; ignores < ~8 px; always shown near the top, with keyboard focus inside, with the menu
  open, and always under reduced motion); (2) REQ-082 agreed — REQ-003, REQ-005, REQ-010, REQ-NFR-003, REQ-NFR-007 marked "frontend 1;
  variant in REQ-082"; (3) SQ-6 accepted — SEC-UI-014 gains four required automated proofs (absent from build/preview output; other
  origins 403 directly from the backend; frontend 1 unaffected; nothing logs cookies); (4) rebuild command text accepted as a known
  difference (backend follow-up only if frontend-2 is chosen); (5) REQ-095 moved to PH-3, REQ-094 stays in PH-2 (PH-2 19 points, PH-3
  17); (6) MoSCoW confirmed. REQ-084 reveal criteria split into explicit no-JS / print / reduced-motion / screenshot criteria;
  REQ-085 gains the 8 px, near-top, focus, menu, scroll-padding, skip-link and reduced-motion criteria. Requirements OQ-12..14, 16
  resolved.
- Line endings: working copies restored to CRLF (index LF), no mode or binary changes.
## CHG-011 — 2026-10-31 02:21 — Toolkit upgrade 0.5.0 → 1.2.0 (/upgrade-project, branch chore/upgrade-toolkit-1.2)
- Launchers: the original hand-made launcher is kept as `start-classic.cmd` → `run/classic/start-classic.ps1` (project root
  resolved two folders up; new `-DryRun` switch that prints root, folders, ports, target database host:port/name and browser;
  behaviour otherwise unchanged). The original `start.cmd` text is saved as `run/classic/start.cmd.original`. Dry runs passed from
  the project root and from another working folder (double-click path): root resolved correctly, database
  `localhost:5442/mitali_portfolio` (dev), Brave → `/` and `/admin`.
- 0.9: `docs/phases.md` (PH-1 DELIVERED with all 44 REQs; `ui_first: no`, `design_freeze: n/a`); `.dev-pipeline/models.json`
  (balanced). `budget.json` is not created here (it is computed by `/budget` from the developer's inputs).
- 0.11 + 1.0 run kit: `make-run-kit.ps1 -Phase PH-1` wrote `start.cmd` (replaced the original; copy kept), `stop.cmd`,
  `build-apk.cmd`, `smoke.cmd`, `testdata.cmd`, `run/*.ps1`, `run/secret-scan.ps1`, `.githooks/pre-commit`, 5 `.gitignore` lines.
  `run/run.json`: service PostgreSQL 17 (5442); apps `api` (backend, 127.0.0.1:8000, health /api/health, install `uv sync`,
  prepare `alembic upgrade head` once) and `web` (frontend, localhost:5173, `npm run dev`, opens `/`). `-CheckOnly`: ok, 0 warnings.
  Dry run ok (Chrome, one address; first real run creates `frontend/.env` from `.env.example` — kit behaviour, documented).
  No smoke journey or testdata section yet (`/smoke`, `/testdata` later). The secret-scan hook is installed but NOT enabled.
- 0.12: SystemDesign `preferences:` header and section 2a (SD-100..SD-110): developer = PostgreSQL, FastAPI, React (G1);
  suggested = Vite, pre-render script, SQLAlchemy/Alembic, TanStack Query, React Hook Form + Zod, openapi-fetch, session auth, tooling.
- 0.13: design-brief section 7 "Design notes (from references)" (frontend/: none via /inspire, see DES-030; placeholder for
  "Variant: frontend-2"); "Open questions" renumbered to 8.
- 1.0: `priority: Must (baseline default, all built; not a client priority)` on all 44 REQs; `docs/demo/`, `docs/reports/`,
  `docs/test-results/`; CLAUDE.md rules 13-19 (phases/models, handoff, UI-first, fast path, secret scan, client guide, launchers)
  and the updated pipeline line.
- 1.1: `.dev-pipeline/restore.json` (names and addresses only) validated; `.dev-pipeline/restore.ps1`; generated note
  `NEW-MACHINE-SETUP.new.md` (hand-written `NEW-MACHINE-SETUP.md` kept unchanged). Launcher section added to the new note.
- 1.2: REQ-DOC-001 [NEW] (client feature guide, Must); `docs/feature-guide.json` + `docs/FEATURE.html` (30 features, 5 sections,
  paginated, **marked DRAFT** until the developer checks it against the built app). Not in the guide on purpose (internal):
  REQ-001, REQ-005, REQ-022, REQ-070..072, REQ-NFR-*.
- README and `start.md`: which launcher is which; `start.cmd` now opens Chrome first and only `/`.
- `toolkit_version` 0.5.0 → 1.2.0. No change to `frontend/`, `backend/` or any `.env`.

## CHG-010 — 2026-10-31 00:12 — Performance closed; all items IMPLEMENTED; launcher added
- /faqs investigation: no code change needed. On an idle machine /faqs scores Performance 99 (TBT 94 ms); the earlier
  83-84 came from a loaded CPU (Lighthouse benchmarkIndex 376-560 vs 1040-1460 idle).
- Final Lighthouse 13.6.0 mobile on the production-like preview built from the dev DB (3 runs/page; 10 of 24 runs hit
  the known NO_NAVSTART trace bug on Chromium 156 and are excluded; benchmarkIndex 1248-1740): Performance medians
  Home 99, Work 99, case study 98, Writing 98, writing sample 97, About 98, Contact 99, FAQs 99; Accessibility, Best
  Practices, SEO 100 on every page. REQ-NFR-004 PASS.
- UI-011, UI-032: IN-PROGRESS → IMPLEMENTED. REQ-001, REQ-006, REQ-012, REQ-041, REQ-NFR-002, REQ-NFR-003, REQ-NFR-004:
  IN-PROGRESS → IMPLEMENTED. All 44 requirements and all 84 BE/UI scope items are now IMPLEMENTED.
- tech-spec TS-003 step 8: compression and font caching documented.
- Added `start.cmd`, `start.ps1`, `start.md` (user request): double-click starts the backend (127.0.0.1:8000) and the
  frontend dev server (localhost:5173) in their own windows, reuses apps already running, waits until both answer and
  opens the site and /admin in Brave → Chrome → default browser; `-Preview` rebuilds the site from the dev DB and
  serves it production-like on localhost:8000. Tested: fresh start, reuse on a second run, Brave detection, preview
  build + serve (br compression, 404 status). Two launcher bugs found and fixed during testing (IPv6 `localhost`
  port check; incomplete stop of the temporary build backend's process tree).
- `frontend/dist` is now built from the dev database.
- Git: all work committed and fast-forwarded into `main`, pushed to `origin` at the user's request.

## CHG-009 — 2026-10-30 18:36 — Tester run 2; items marked IMPLEMENTED
- Tester run 2 (after the user-approved fix round for F1-F3): 63/63 functional E2E PASS, axe 0 violations (54 checks),
  no CSP violations (incl. during a contact submit), no horizontal overflow at 360-1920 px, compression verified
  (br on HTML/JS/CSS; none on /api or /media), image-page LCP 4.2-4.5 s → 2.0-2.6 s. Lighthouse Accessibility, Best
  Practices, SEO 100 everywhere. Performance noisy with CPU load: every page ≥ 90 in at least one pass except /faqs
  (max 84, TBT 640-680 ms).
- User decision: fix /faqs and re-measure Lighthouse on an idle machine; mark everything else IMPLEMENTED now.
- Scope items IN-PROGRESS → IMPLEMENTED: BE-001, BE-002, BE-003, BE-004, BE-005, BE-006, BE-007, BE-008, BE-009, BE-010, BE-011, BE-012, BE-013, BE-014, BE-015, BE-016, BE-017, BE-018, BE-019, BE-020, BE-021, BE-022, BE-023, BE-024, BE-025, BE-026, UI-001, UI-002, UI-003, UI-004, UI-005, UI-006, UI-007, UI-008, UI-009, UI-010, UI-012, UI-013, UI-014, UI-015, UI-016, UI-017, UI-018, UI-019, UI-020, UI-021, UI-022, UI-023, UI-024, UI-025, UI-026, UI-027, UI-028, UI-029, UI-030, UI-031, UI-033, UI-034, UI-035, UI-036, UI-037, UI-038, UI-039, UI-040, UI-041, UI-042, UI-043, UI-044, UI-045, UI-046, UI-047, UI-048, UI-049, UI-050, UI-051, UI-052, UI-053, UI-054, UI-055, UI-056, UI-057, UI-058.
- Kept IN-PROGRESS (FAQs performance fix): UI-011, UI-032.
- Requirements NEW → IN-PROGRESS → IMPLEMENTED: REQ-002, REQ-003, REQ-004, REQ-005, REQ-010, REQ-011, REQ-013, REQ-014, REQ-015, REQ-020, REQ-021, REQ-022, REQ-023, REQ-030, REQ-031, REQ-040, REQ-042, REQ-043, REQ-050, REQ-051, REQ-052, REQ-060, REQ-061, REQ-062, REQ-063, REQ-064, REQ-065, REQ-066, REQ-067, REQ-070, REQ-071, REQ-072, REQ-NFR-001, REQ-NFR-005, REQ-NFR-006, REQ-NFR-007, REQ-NFR-008.
- Requirements NEW → IN-PROGRESS (pending /faqs fix + Lighthouse re-measure): REQ-001, REQ-006, REQ-012, REQ-041, REQ-NFR-002, REQ-NFR-003, REQ-NFR-004.
- Test scenarios (BE-T/UI-T) are covered by the tester reports (scratchpad run2); their tags are left as written.
- Tech-spec note to add: static frontend compression (br/gz, on-the-fly gzip, never /api or /media) and immutable
  caching for /assets and fonts (BE-022 fix round).

## CHG-008 — 2026-10-30 14:21 — Tester run 1: FAIL on three items; extra fix round approved by the user
- Tester: backend 521 tests (coverage app 97%, services 97%, core 96%), frontend 457 tests, 62 Playwright E2E
  (47 pass), axe 0 violations in 54 checks (public + admin at 360/810/1440), all functional REQs PASS.
- FAIL: F1 REQ-NFR-004 Lighthouse mobile Performance 83-85 on /work, /work/<slug>, /writing, /writing/<slug> (others
  96-99; Accessibility/Best Practices/SEO 100 everywhere); F2 SEC-010 CSP `eval` violation on /admin/login (zod v4
  probe); F3 UI-T-103 scrollWidth +33 px from the right TapeDivider (no actual sideways scroll in Chromium).
- User approved one extra fix round beyond the 3-round review cap (CLAUDE.md rule 6) for F1-F3.
- Tooling: `@lhci/cli` dropped (13 high advisories; bundled Lighthouse 12 fails on Chromium 156); Lighthouse 13 run by the
  E2E harness. SD-011, TS-019 step 5, ui-scope validation commands and UI-T-120 wording updated. `@axe-core/playwright`
  4.14.0 added (tester). E2E suite added under `frontend/e2e/`.
- Note: `frontend/dist` currently holds a build of the TEST database; rebuild against the dev API before use.

## CHG-007 — 2026-10-30 13:05 — Code review rounds 1-3 and fixes
- Review round 1: backend CHANGES REQUIRED (M1 login stripped password whitespace vs CLI; m1 SVG nan/inf/deep nesting
  500; m2 dummy hash on the event loop; m3 concurrent login throttle bypass; m4 unauthenticated 10 MB upload body; m5
  unbounded page; m6 media FK race; nits n2-n6). Frontend CHANGES REQUIRED (no scroll reset on navigation; case-study
  tabs dropped unsaved edits; enquiry status radios lost focus; side-panel unsaved guard; reorder cancelQueries;
  markdown preview key; slow/fragile admin tests; nits 8-13). All fixed with regression tests (fix round 1).
- Review round 2: all round-1 findings fixed except a partial UI-040 fix; new: F-1 stale side-panel guard after
  Discard, F-2 logout with unsaved changes could hang; B-1 login held a pool connection during Argon2, B-2 counter
  cleanup deadlock, B-3 href normalisation. All fixed with regression tests (fix round 2).
- Review round 3 (final): PASS. Follow-up minor (password reset racing a login) fixed by the orchestrator: locked,
  refreshed re-read of the admin row and hash comparison before starting the session (`admin_users.get_by_id_for_update`,
  `services/auth._start_session`), regression test in `test_admin_auth.py`.
- Checks after fixes: backend ruff, format, mypy --strict, 521 tests, contract 92/92, pip-audit, bandit -ll clean;
  frontend lint + style check, tsc, 457 tests (≈41 s), build, npm audit clean.
- Deviations accepted in review: generic framework 403 → `validation_error` "Forbidden." (unreachable today; add a
  `forbidden` contract code if a non-CSRF 403 is ever introduced); honeypot accepts any length (truncated, never stored).

## CHG-006 — 2026-10-30 07:50 — Build batch 3: admin CRUD, media, enquiries, dashboard, seed, admin UI
- BE-013..BE-017, BE-020..BE-023, BE-026: NEW → IN-PROGRESS (be-builder). UI-035..UI-058: NEW → IN-PROGRESS (fe-builder,
  2026-10-30 05:09). CHG-005 changes applied in code (migration 0002 settings copy fields; enquiry-type placeholder;
  settings-driven promise and rights lines; writing-sample heading styles).
- Orchestrator checks: backend ruff, format, mypy --strict (170 files), 472 tests, strict contract 92/92, pip-audit,
  bandit -ll clean. Frontend lint + style check, tsc, 433 tests (48 files) when run alone, npm audit clean. Some admin
  component tests run close to the 20 s timeout under CPU load (flakiness risk, sent to review).
- Dev DB seeded (`app.cli seed`, twice, counts unchanged): 6 case studies, 18 results, 40 gallery images, 12 writing
  samples, 5 services, 3 engagement models, 5 testimonials, 4 FAQ categories / 16 FAQs, 4 values, 4 process steps,
  4 dev enquiries, 59 generated images. One smoke-test enquiry added by the orchestrator.
- `npm run build:site` against the dev API: 24 pages; sitemap 24 URLs, none under /admin; robots disallows /admin; one
  h1 per page; canonical/OG tags present; admin shell noindex; no reference-site text.
- Production-like serving (127.0.0.1:8000, SERVE_FRONTEND=true): all public pages 200, unknown slug 404, admin API 401
  without session, security headers present, no Server header, contact POST 201 valid / 422 invalid.

## CHG-005 — 2026-10-29 20:55 — User decisions after batch 2
- REQ-042 (still NEW): enquiry type gets a required "Choose one…" placeholder; the promise line comes from settings.
- REQ-065 (still NEW): site settings gain `contact_promise` and `footer_rights_line` (current builder copy as initial
  values, editable in the admin; Mitali will revise).
- Booking URL limit stays 500 characters (contract wins over SEC-BE-014's 2048; security.md to be aligned in batch 3).
- Writing-sample headings: user delegated the design call; decision recorded in `.dev-pipeline/HANDOFF.md` for batch 3.
- Batch 3 not started: usage at 96% of the 5-hour limit. Plan in `.dev-pipeline/HANDOFF.md`. Model stays as is.
- Spec update 2026-10-30 05:08 (spec-writer; HANDOFF "Next" step 1). No status transitions; text only:
  - TS-002 (NEW, definition updated): migration `0002_settings_copy_fields` adds `site_settings.contact_promise` and
    `footer_rights_line` (text NOT NULL, server defaults = current copy, CHECK 1..200 after trim); `0001` stays untouched.
  - TS-013 (NEW, definition updated): both fields in settings input (required, ≤ 200, not blank) and in public settings;
    initial texts recorded; tech-spec section 3.2 and open question 4 (now partly resolved) updated.
  - api-contract.yaml: `PublicSettings`, `SettingsInput` (and so `AdminSettings`) gain `contact_promise` and
    `footer_rights_line`; `getPublicSite`, `getAdminSettings`, `updateAdminSettings`: NEW → CHANGED (x-status).
    `BudgetRange` enum values quoted as strings (no semantic change). `EnquiryCreate` already requires `enquiry_type`
    (enum, no empty value), so the "Choose one…" placeholder needs no contract change.
  - BE-006, BE-019 (IN-PROGRESS, definition updated): public/admin settings fields, migration `0002`, validation.
    New BE-T-110 (migration 0002), BE-T-111 (settings field validation), BE-T-112 (fields in admin and public responses).
  - UI-021, UI-030, UI-033 (IN-PROGRESS, definition updated); UI-056 (NEW, definition updated): settings-driven rights
    line and promise line, required "Choose one…" enquiry-type placeholder, admin settings fields, writing-sample
    heading mapping and styles. UI-T-060, UI-T-068 (NEW, definition updated). New UI-T-123, UI-T-124, UI-T-125 (unit)
    and UI-T-126 (E2E).
  - DES-021 (NEW, definition updated): note on writing-sample article headings (`#` → h2, `##` → h3, `###`+ → h4; styles
    `--text-h3` / `--text-statement` bold / `--text-label`, `--measure`).
  - SEC-BE-014 (NEW, definition updated): URL limit 2048 → 500 to match the contract.
  - traceability.md: rows REQ-042 and REQ-065 extended with the new and newly linked IDs.

## CHG-004 — 2026-10-29 20:47 — Build batch 2: public API, contact, admin auth, public pages
- BE-006, BE-007, BE-008, BE-009, BE-010, BE-011, BE-012, BE-018, BE-019: NEW → IN-PROGRESS (be-builder, 2026-10-29 20:10).
- UI-019..UI-034: NEW → IN-PROGRESS (fe-builder, 2026-10-29 20:11).
- Checks: backend ruff, mypy --strict (112 files), 303 tests twice in a row (coverage: services 99%, core 91%, app 96%),
  pip-audit, bandit clean; contract 22/92 operations, no drift. Frontend lint + style check, tsc, 298 tests, build,
  fixture pre-render (24 pages), npm audit clean.
- Orchestrator check: `create-admin` / `reset-password` exercised against the test DB (short password refused, Argon2id
  hash, second admin refused, sessions ended on reset); test account removed. No admin exists in the dev DB.
- .gitignore: coverage data (`.coverage`, `.coverage.*`, `htmlcov/`).
- Note: local commit 723be1d on feature/initial-build (made by the user by mistake, message from the toolkit repo)
  holds a mid-batch-2 snapshot; kept as is at the user's choice (unpushed).

## CHG-003 — 2026-10-29 20:09 — Build batch 1: backend and frontend foundations (branch feature/initial-build)
- BE-001, BE-002, BE-003, BE-004, BE-005, BE-024, BE-025: NEW → IN-PROGRESS (be-builder, 2026-10-29 16:59).
- UI-001..UI-018: NEW → IN-PROGRESS (fe-builder, 2026-10-29 16:58).
- User ran `backend/scripts/setup_db.ps1`: role `mitali_app`, databases `mitali_portfolio` and `mitali_portfolio_test`
  created on PostgreSQL 17 (port 5442); `backend/.env` written (git-ignored).
- Fix: migration 0001 singleton insert bound `years_experience=None` as VARCHAR into a smallint column; `None` values
  are now omitted. Migration verified online: upgrade, `alembic check` (no drift), downgrade base, upgrade.
- Fix: test reset (`tests/conftest.py`) emptied the profile/settings singletons through `TRUNCATE ... CASCADE` and then
  updated zero rows; it now upserts them. Database tests pass twice in a row and per file.
- Checks: backend ruff, format, mypy --strict, 126 tests (91% line+branch coverage), pip-audit, bandit clean;
  frontend lint + style check, tsc, 221 tests, client + SSR build, fixture pre-render, npm audit clean.
- Toolkit lesson recorded (C:/Dev/multi-agent-setup, uncommitted): `stack-postgresql` (migrations verified online,
  typed migration inserts, cascade-safe test reset, run DB tests twice), `stack-python-fastapi` review checklist,
  `agents/be-builder.md` (report migrations as unverified when no DB is reachable).

## CHG-002 — 2026-10-29 16:54 — Gate G2 approved
- User approved docs 2-6 and all defaults listed at G2 (no sample flag on testimonials; fixed hero/CTA copy in the
  frontend; SVG uploads with allow-list sanitiser; lock-out DoS accepted while local; accordions and contact form need
  JavaScript; no prices, no currency on budget bands; `/work/<slug>`; enquiries kept until deleted).
- Environment re-check: Git 2.55.0, Node v26.13.0, npm 11.20.0, Python 3.12.6, pip 26.2.2, PostgreSQL 17.11 (port 5442,
  running), Playwright 1.64.1 with Chromium, Chrome present, uv 0.13.6 (installed under the Python user Scripts folder,
  not on PATH; agents call `python -m uv`).
- .gitignore: raw reference capture (`analysis.json`, `summary.md`) kept out of git (contains third-party text).
- Initial commit of the document set pushed to `origin` (`main`).

## CHG-001 — 2026-10-29 16:06 — Initial document set from the intake (/init-project, gate G1 passed)
- requirements.md: added REQ-001..REQ-006, REQ-010..015, REQ-020..023, REQ-030..031, REQ-040..043, REQ-050..052,
  REQ-060..067, REQ-070..072 and REQ-NFR-001..008 [NEW 2026-10-29 16:06] from `.dev-pipeline/intake.md` and
  `.dev-pipeline/reference/reference-notes.md` (behaviour only, no reference wording); 11 assumptions/open questions.
- design-brief.md: added DES-001..003, DES-010..013, DES-020..021, DES-030, DES-040..042 [NEW 2026-10-29 16:06];
  palette from `palette.py "#70FF00"` with contrast table (green on cream/white FAIL handled by DES-013; muted on dark
  replaced by #A3A396). DES-030 records studiobrag.com as inspiration only and what is not copied.
- SystemDesign.md: header filled (python-fastapi, react, postgresql, no mobile/cloud/CI); SD-001..SD-013
  [NEW 2026-10-29 16:06], including the pre-render approach (SD-003), local test DB instead of Testcontainers (SD-006)
  and session cookie instead of JWT (SD-007); remote `origin` recorded (SD-012).
- mobile-scope.md, cloud-scope.md: "Not applicable" (mobile none, cloud none).
- backend-scope.md: added BE-001..BE-026, BE-REV-001..023 and BE-T-001..109 [NEW 2026-10-29 16:06] from TS-001..TS-019
  and `api-contract.yaml`; coverage target ≥90% services/core, ≥85% overall; open questions BQ-1, BQ-2, BQ-3.
- ui-scope.md: added UI-001..UI-058, UI-REV-001..020, UI-T-001..102 (unit/component) and UI-T-103..122 (Playwright
  E2E) [NEW 2026-10-29 16:06]; 7 open questions.
- security.md: added SEC-001..011, SEC-BE-001..019, SEC-UI-001..012 [NEW 2026-10-29 16:06] with verification;
  SEC-MOB / SEC-CL not applicable, hosting revisit list H-1..H-11; open questions SQ-1..SQ-5. Review items fed back as
  BE-REV-024..030 (backend-scope.md) and UI-REV-021..025 (ui-scope.md).
- traceability.md: Scope items, Security and Tests columns filled for all 44 requirements.
- .gitignore: added `*.dump`, `*.backup`, `backups/`, `backend/media/uploads/`, `backend/media/seed/`, `dist-ssr/` (SEC-003).
- PROJECTS.md (projects root): stack recorded, status "G2 pending".
- tech-spec.md: added TS-001..TS-019 [NEW 2026-10-29 16:06] (repo layout, data model, backend foundation, public API,
  pre-render, public frontend, contact, auth/session/CSRF, admin CLI, admin CRUD/reorder, uploads, markdown,
  profile/settings, enquiries, dashboard/rebuild notice, admin frontend, seed, DB setup script, test strategy); data model
  (sections 3.1-3.5), 4 sequence diagrams, risks and 9 open questions.
- api-contract.yaml: replaced the template with OpenAPI 3.1; 92 operations (14 public, 78 admin), all
  `x-status: NEW 2026-10-29 16:06` with `x-implements`; template `/health` (getHealth) moved to `/api/health` and
  relinked to REQ-NFR-006.
- traceability.md: replaced the placeholder row with one row per REQ (REQ-001..REQ-072, REQ-NFR-001..008) linking TS IDs.

## CHG-000 — 2026-10-29 16:06 — Project initialised
- Created: requirements.md, SystemDesign.md and the document set from templates.
