# Handoff: mitali-portfolio

> Newest entry on top. Records state only; `docs/` stays the source of truth for scope. Resume with `/resume`
> (or open the project with its launcher and say "continue batch 3").

## 2026-10-31 06:57: session stopped (usage limit) — read PENDING-WORK.md at the project root first

## 2026-10-31 03:00: frontend-2 G2 approved; PH-2 build running (branch feature/frontend-2, uncommitted)
- Upgrade merged to main (f90c68b); `feature/frontend-2` created from it. G2 docs: CHG-012 (REQ-080..097, REQ-NFR-009..013,
  DES-050..065, SD-111..118, TS-020..033, UI-100..152, SEC-UI-013..019), with the user's G2 answers applied.
- Running: fe-builder for PH-2 (frontend-2 scaffold, tokens, fonts, shell, motion, view transitions, Home + case study, dev proxy
  with the dev-only Origin rewrite, P1 review aids: white/cream switch, type specimen, view-transition toggle). Resume via SendMessage.
- Next: orchestrator re-runs checks; adds `web2` to `run/run.json` (5174; `start-classic.cmd` unchanged) and validates with
  `make-run-kit.ps1 -CheckOnly`; tells the user before any E2E (TEST database only); then the P1 review via `/ui-review`.
- DB rules: dev DB for dev runs and pre-render; test DB only for E2E; never production; confirm before any build that reads data.
- Line endings: the working copies of tracked docs are CRLF (index LF); keep CRLF when editing.

## 2026-10-31 02:29: toolkit upgrade applied on chore/upgrade-toolkit-1.2 (uncommitted); waiting for the user to push and merge
- CHG-011: upgrade 0.5.0 → 1.2.0 applied and checked (run kit, machine setup, feature guide validators ok; staged secret scan clean).
- The user commits, pushes and merges the branch. Then: create `feature/frontend-2` from the updated `main` and start the frontend-2
  feature at G2 (documents). Decisions already agreed for frontend-2 (2026-10-31): Origin rewrite in the Vite dev proxy only for
  /api/admin; Inter Tight 300 + Public Sans + Antonio (self-hosted, Latin, OFL, preload display); cream #FFFDE9 single surface
  with white alternate bands (white comparison at the P1 review); header hides on scroll down / shows on scroll up with focus
  rules; improvements #1-#7 (skip #8), reveals as progressive enhancement, view transitions may be dropped at P1; review type at
  375/768/1024/1440; tell the user which database before any build or test (dev for builds, test for E2E; never production).
- Inspiration capture and notes: scratchpad `inspire-atlyx/` (copy to `.dev-pipeline/reference/inspiration/`, screenshots git-ignored,
  during the frontend-2 documents step).

## 2026-10-31 00:12: build complete — all requirements IMPLEMENTED
- All 44 REQs and 84 BE/UI items IMPLEMENTED (CHG-010). Launcher `start.cmd` added and tested.
- Committed on `feature/initial-build`, fast-forwarded into `main` and pushed to `origin/main` at the user's request
  (2026-10-31). Remote `origin` = github.com/nimesh-patel-1994/mitali-portfolio.
- Remaining user checks (tester list): real phones at 360/390 px, screen-reader spot check, visual review of the About
  staircase / gallery tiles / tape dividers, pg_hba loopback-only, disk encryption for data and backups.
- Open content items: real logo, contact email, booking URL, social links, portrait, real case studies and copy
  (Mitali), engagement-model prices, budget currency; seeded chart tiles keep a "Sample data" caption after flags are
  cleared (editable content).

## 2026-10-30 14:21: tester FAIL (F1 perf, F2 CSP eval, F3 overflow); user-approved extra fix round running
- Running: be-builder (gzip/precompressed static serving, cache headers) and fe-builder (split contact-form code,
  LCP image priority, precompressed assets, zod jitless, TapeDivider containment). Resume via SendMessage if cut off.
- Then: orchestrator re-runs checks, re-runs tester (E2E + Lighthouse), on PASS mark IMPLEMENTED + traceability, then
  write start.cmd / start.ps1 / start.md (user request: double-click starts backend + frontend, waits, opens
  http://localhost:5173/ and /admin in Brave → Chrome → default browser; optional -Preview mode), rebuild dist from
  the dev DB, and ask the user about committing.

## 2026-10-30 13:05: review passed (3 rounds); tester running
- CHG-007: all review findings fixed; final checks clean (backend 521 tests, frontend 457 tests).
- Running: tester agent (Playwright E2E with axe at 360/810/1440, Lighthouse, acceptance criteria). E2E uses the TEST
  database only (seeded + an admin created by CLI there), never the dev DB.
- If interrupted: resume the tester via SendMessage. On PASS: mark items IMPLEMENTED, update traceability, report to the
  user, and ask whether to commit/push. On FAIL: fix loop (the review/test fix cap is 3 rounds; review used 3, so any
  tester failures need the user's go-ahead per CLAUDE.md rule 6 interpretation — report and ask).

## 2026-10-30 07:58: review round 1 done (both CHANGES REQUIRED); fix round 1 running
- Backend review: M1 password whitespace (login strips, CLI does not), m1 SVG nan/inf/deep nesting → 500, m2 dummy
  hash on event loop, m3 concurrent login throttle bypass, m4 unauthenticated 10 MB upload body, m5 unbounded page,
  m6 media FK race → 500, nits n2-n6. Fixer briefed on all except n1.
- Frontend review: scroll not reset on navigation, case-study tabs drop unsaved edits, enquiry status radios lose
  focus, side-panel unsaved guard, reorder cancelQueries, markdown preview key, slow/fragile admin tests, nits 8-13.
  Fixer briefed on all.
- If interrupted: resume the two fixers via SendMessage. After both: orchestrator re-runs all checks, then review
  round 2 (re-check only the findings + regressions), then tester. Max 3 fix rounds (CLAUDE.md rule 6).

## 2026-10-30 07:50: batch 3 built and smoke-tested; code review running
- All 26 BE and 58 UI items built (IN-PROGRESS). Checks, seed, build:site and HTTP smoke test passed (CHG-006).
- Running: two code-reviewer agents (backend, frontend). Next: fix findings (max 3 rounds, CLAUDE.md rule 6), then
  tester (Playwright E2E + axe, Lighthouse), then mark IMPLEMENTED and update traceability.
- Pending small spec item: admin list items lack client_name (case studies) and published_on/is_featured (writing).
- No admin in the dev DB yet unless the user ran create-admin; E2E admin journeys need an admin in the TEST DB only.

## 2026-10-30 07:10: batch 3 interrupted (5-hour limit, resets 07:10)
- Frontend builder stopped at "content-screen tests, starting with case studies (UI-T-087..091)". Resume it with
  SendMessage (same agent) to continue; do not restart.
- Backend builder stalled (watchdog) right after "lint and types clean, now the full test run with coverage". Its code is
  on disk. Resume it with SendMessage; if it cannot resume, run the full backend checks yourself and brief a new
  be-builder only for what is missing.
- Then continue with the "Next after builders" steps in the entry below.

## 2026-10-30 05:08: batch 3 running (resumed automatically after the limit reset)
- Step 1 done: CHG-005 spec update (TS-002, TS-013, BE-006, BE-019, UI-021, UI-030, UI-033, UI-056, UI-T-060/068,
  DES-021, SEC-BE-014; new BE-T-110..112, UI-T-123..126; BudgetRange quoted). Placeholder times fixed to 2026-10-30 05:08.
- Step 2 running: be-builder (migration 0002, BE-013..017, BE-020..023, BE-026) and fe-builder (CHG-005 UI changes,
  UI-035..058) in parallel. If interrupted by the limit, resume each builder (SendMessage) rather than restarting.
- Open spec nits: align TS-012/BE-018 heading-mapping wording with DES-021/UI-030; add a BE-REV line for migration 0002.
- Next after builders: step 3 of the entry below (orchestrator checks, seed dev DB, build:site, smoke test), then review
  and tester.

## 2026-10-29 20:55: stopped before batch 3 (usage limit at 96%)
Reason: the 5-hour usage limit is nearly reached. The user asked to stop before 99% and resume after the reset,
using the current model, not Haiku (batch 3 includes auth-adjacent admin work, uploads and SVG sanitising).

**Completed**
- G1 and G2 passed. Docs committed and pushed (`main` 73909b4).
- Batch 1 (BE-001..005, 024, 025; UI-001..018) and batch 2 (BE-006..012, 018, 019; UI-019..034) are built and checked by
  the orchestrator: backend 303 tests twice in a row, frontend 298 tests, lint/types/build/audits clean (CHG-003, CHG-004).
  All of these items are IN-PROGRESS; none IMPLEMENTED (needs review + tester).
- DB created by the user (PostgreSQL 17, port 5442, role `mitali_app`), migration 0001 applied to dev and test DBs.
- `create-admin` verified on the test DB; the command was given to the user (they may or may not have run it yet).
- Toolkit lessons committed and pushed (multi-agent-setup a345310).

**Phase**
- Build, batch 3 next. Model: current (Opus); do not switch to Haiku for builders.

**In progress**
- Nothing running.

**Next (ordered)**
1. Spec update first (spec-writer, small), from CHG-005:
   - `site_settings` gains `contact_promise` (text, ≤200) and `footer_rights_line` (text, ≤200); initial values = the
     copy now hard-coded in `frontend/src/features/public/content/copy.ts` (contact promise "I reply to every enquiry
     within two working days" and the footer rights line). Update TS-002/TS-013, api-contract (PublicSettings,
     AdminSettings, SettingsInput; x-status CHANGED), a new Alembic migration 0002 (add columns with defaults),
     ui-scope UI-021/UI-033/UI-056, backend-scope BE-019, traceability. Mark the touched IMPLEMENTED-not-yet items:
     they are IN-PROGRESS, so just update their text and log it.
   - Enquiry type: required "Choose one…" placeholder (REQ-042). Update UI-033 and UI-T-060/UI-T-068 (expect 7 options
     incl. the placeholder, and an enquiry-type field error). Backend already requires `enquiry_type`.
   - Booking URL limit: keep 500 (contract). Align SEC-BE-014 text to 500.
   - Writing-sample headings (user delegated the design call): keep the builder's mapping — author `#` → `h2`, `##` → `h3`,
     `###` and deeper → `h4` (page `h1` is the sample title). Style in the article body: h2 = `--text-h3` display
     uppercase, h3 = `--text-statement` body bold, h4 = `--text-label` display uppercase; `--measure` line length. Record
     as a DES-021 note and in UI-030.
2. Batch 3 in parallel (be-builder + fe-builder), current model:
   - Backend: BE-013 (case studies + results + gallery CRUD), BE-014 (writing samples), BE-015 (services, engagement
     models, testimonials, values, process steps), BE-016 (FAQ categories/FAQs), BE-017 (media upload pipeline + SVG
     allow-list sanitiser per SEC-BE-011), BE-020 (enquiries), BE-021 (dashboard + rebuild info), BE-022 (serve
     pre-rendered dist, `--host 127.0.0.1`, `--no-server-header`), BE-023 (seed + generated SVGs), BE-026 (README),
     plus migration 0002 and the settings fields from step 1. Brief must include: `python -m uv`, DB exists, run DB
     tests twice, migrations online, no admin creation in dev DB, do not edit CHANGELOG/traceability.
   - Frontend: UI-035..UI-058 (admin area) plus the contact placeholder and settings-driven promise/rights lines in
     UI-021/UI-033. Same brief rules as batch 2.
   - If usage is tight, split: backend first (BE-013..017), then BE-020..023/026, then admin UI.
3. Orchestrator: re-run both suites, run the seed on the dev DB (`python -m uv run python -m app.cli seed`), build the
   site against the dev API (`npm run build:site`) and smoke-check.
4. Review (code-reviewer), then tester (Playwright E2E with axe, Lighthouse) — fix loop max 3 rounds.
5. Mark IMPLEMENTED only after tester PASS; update traceability.

**Decisions and open questions**
- User decisions 2026-10-29 20:55: see CHG-005 above. Copy lines stay as written until Mitali revises them in the admin.
- Still open (defaults applied): CSRF token rotation in `getAdminMe` (accepted unless reviewer objects); quoting
  `BudgetRange` enum values in the contract (recommend quoting them in step 1); tape tint on dark headings; SVG og:image
  (tech-spec Q1); enquiry retention (SQ-1).
- Local commit 723be1d on `feature/initial-build` (user's accidental commit with a toolkit message): user chose to keep
  it as is. Not pushed.

**Environment notes**
- uv only as `python -m uv`; psql only by full path; PostgreSQL 17 on 5442; Playwright 1.64.1 + Chromium installed;
  Chrome present for Lighthouse. Dev server binds to localhost only.

**Uncommitted files**
- `.gitignore`, `backend/pyproject.toml`, `docs/CHANGELOG.md`, `docs/requirements.md`, `frontend/src/test/setup.ts`,
  `.dev-pipeline/HANDOFF.md` (on top of local commit 723be1d). Commit only when the user asks.

**Resume**
- Open the project with `open-claude`, then `/resume` or "continue batch 3". Start with Next step 1.
