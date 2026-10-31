# PENDING WORK — mitali-portfolio / frontend-2 (written 2026-10-31 for a session with no memory of the previous one)

HOW TO RESUME (read this first):
1. `git fetch origin`, then `git checkout feature/frontend-2` (local-only branch unless the user has pushed it; see "Git state").
2. Read, in order: this file, `CLAUDE.md` (rules 1-19), `docs/phases.md` (PH-2 is ACTIVE), `.dev-pipeline/HANDOFF.md` (newest entry).
3. Then the frontend-2 specs: `docs/requirements.md` REQ-080..097 + REQ-NFR-009..013, `docs/design-brief.md` section 7
   "Variant: frontend-2", `docs/ui-scope.md` section "App: frontend-2", `docs/security.md` SEC-UI-013..019.
4. FIRST TASK: re-run the frontend-2 browser tests (step 1 under PENDING) on the TEST database only, after telling the user.
5. Never push; the user pushes. Never read `.env` values. Use `python -m uv` (uv is not on PATH on the original machine).
6. The toolkit (`C:\Dev\multi-agent-setup`) has UNCOMMITTED fixes to the run kit; see "Git state" before running `/run-kit`.
7. Working copies of tracked text files use CRLF (git index LF, `core.autocrlf=true`): keep CRLF when editing.
8. Status rules: `status-tracker` skill; never mark items IMPLEMENTED before the tester passes.
9. Ports: backend 8000, frontend 1 5173, frontend-2 5174. Dev DB `mitali_portfolio`, test DB `mitali_portfolio_test` (port 5442).
10. The user decides design questions at the P1 review (white vs cream, view transitions); do not decide them yourself.
11. Builds that pre-render read the DEV database through the API; E2E uses the TEST database; never production.
12. Do not modify `frontend/`, `backend/` or `start-classic.cmd` for this feature.
13. Unverified items are marked "unverified" below.
14. Usage limits interrupted agents several times; resume agents rather than restarting them.
15. Keep this file current, or delete it once the work is finished.

## Project, branch, toolkit, git state
- Project: mitali-portfolio (portfolio site + admin). Backend FastAPI (`backend/`), frontend 1 React (`frontend/`), PostgreSQL 17 on
  port 5442. Remote: https://github.com/nimesh-patel-1994/mitali-portfolio.git
- Toolkit: dev-pipeline 1.2.0 (`.dev-pipeline/project.json` toolkit_version 1.2.0).
- Branches: `main` = `origin/main` at f90c68b (toolkit upgrade merged). `chore/upgrade-toolkit-1.2` (pushed, merged).
  `feature/initial-build` (local, already in main). `feature/frontend-2` (LOCAL ONLY): from f90c68b plus the local checkpoint
  commit made at the end of this session (frontend-2 PH-2 work, G2 docs, run kit, this file). Not pushed.
- Toolkit repo `C:\Dev\multi-agent-setup` (main at e38ba6d): UNCOMMITTED changes in `templates/run/start.ps1` and
  `templates/run/stop.ps1` (fixes below). The project's `run/start.ps1` and `run/stop.ps1` were regenerated from them. If the toolkit is
  re-cloned without these changes, `/run-kit` would bring the bugs back: ask the user to commit them in the toolkit repo.

## Goal and scope of frontend-2
- A second, alternative front end `frontend-2/` (React 19.3, react-router 8.5, Vite 8.3, TS 5.9), fully self-contained (own
  package.json, build, pre-render, generated API client; code copied from `frontend/`, never imported), as a design option for the
  client. Only one front end is deployed (backend `FRONTEND_DIST_DIR`).
- Same screens, behaviour, states, API operations (91 of 92; contract unchanged), auth flow and database (through the API) as
  frontend 1. No backend, database, API-contract or `.env` change.
- Visual and motion design inspired by https://theatlyx.com/sportfolio/ecommerce-brand-identity-redesign/ (inspiration only:
  no text, images, logos, fonts, code or brand copied). Notes: `.dev-pipeline/reference/inspiration/reference-notes.md`
  (screenshots git-ignored, not in git).
- Phases: PH-2 UI prototype (ACTIVE: tokens, fonts, shell, motion, Home + case study, P1 review), PH-3 remaining public + admin
  screens and parity check, PH-4 polish, design freeze, review/tests, Lighthouse, close-out.

## Decisions already made (G1 and G2, by the user)
- Fonts: Inter Tight 300 (display), Public Sans (body), Antonio (wordmark/labels); self-hosted from Fontsource 5.3.0, Latin subset,
  minimal weights, font-display swap, display font preloaded; all SIL OFL 1.1 (verified from npm metadata and the package licence files).
- Base surface: cream #FFFDE9 as the single surface token, white for alternate bands; white-as-base shown as a comparison at P1.
- Colour: our brand around #70FF00, which is never text/icons on cream or white; contrast table DES-059 (24 pairs, verified).
- Header: hides on scroll down, reappears on scroll up; one passive once-per-frame listener toggling a class (SD-118, the single
  exception to the motion budget); ignores < ~8 px; always shown near the top, with focus inside, with the menu open, and always
  under reduced motion; scroll-padding-top; skip link.
- Reveals are progressive enhancement: visible without JS, in print, under reduced motion and in test screenshots (REQ-084).
- Dev-only Origin rewrite (SEC-UI-014): Vite dev server on 5174 only, only `/api/admin`, only for Origin localhost:5174 /
  127.0.0.1:5174, rewritten to http://127.0.0.1:8000; never in build or preview; `ALLOWED_ORIGINS` and `.env` untouched.
- REQ-082: frontend-2 relaxes only the visual parts of REQ-003, REQ-005, REQ-010, REQ-NFR-003, REQ-NFR-007 (marked "frontend 1;
  variant in REQ-082"); behaviour and accessibility criteria stay.
- Priorities: Must for REQ-080..093 and REQ-NFR-009..013; Should for REQ-094..097.
- REQ-095 (image loading polish) moved to PH-3; REQ-094 (view transitions) stays in PH-2 and may be dropped at the P1 review.
- Dashboard rebuild message names `frontend` even when frontend-2 is deployed: accepted known difference (backend follow-up only
  if frontend-2 is chosen).
- No motion library; improvements #1-#7 included, #8 light/dark mode skipped.

## COMPLETED (2026-10-30 / 2026-10-31)
- Toolkit upgrade 0.5.0 → 1.2.0 (CHG-011), merged to main (f90c68b) by the user.
- G2 documents for frontend-2 (CHG-012) approved with the answers above.
- PH-2 build of `frontend-2/` (builder report, orchestrator re-run 2026-10-31): lint 0 problems, `tsc` clean, Vitest 29 files /
  234 tests passed, `npm run build` + dist scan OK (no Origin rewrite, no review aids in dist), motion JS 1023 B gzip (budget 2048),
  client entry 112.7 kB gzip (frontend 1: 118 kB), `npm audit --audit-level=high` exit 0 (15 moderate, dev toolchain).
- Browser tests run 1 (2026-10-31, TEST DB `localhost:5442/mitali_portfolio_test`): 16 passed, 1 skipped, 12 failed.
  Passed: UI-T-149 admin login/me/logout through 5174; SEC-UI-014 proof 2 (foreign and 5174 origins get 403 directly from the
  backend), proof 3 (frontend/ unchanged; 5173 forwards Origin unchanged), proof 4 (no cookie/session values in dev-server log);
  UI-T-153 parity (Home, case study); UI-T-152 same-origin requests.
- `run/run.json` now has `api`, `web` (5173) and `web2` (5174); `make-run-kit.ps1 -CheckOnly` ok (1 service, 3 apps, 0 warnings);
  `start.cmd -DryRun` (all three, opens 5173 and 5174), `-Only api,web2`, unknown-id error and `stop.cmd -DryRun` checked.
- Run-kit bugs fixed in the toolkit templates (uncommitted there) and regenerated: on Windows PowerShell 5.1 `start.ps1` could
  not write `run\pids.json` (ConvertTo-Json on a wrapped List), `stop.ps1` could not read it (ConvertFrom-Json array), a second
  start replaced earlier pids, and `-Only api,web2` arrived as one string. Verified with dummy processes on PS 5.1: two runs
  record api,web2,web; `stop.cmd` stopped all three trees, nothing left, pids.json removed.
- README, `start.md`, `NEW-MACHINE-SETUP.new.md`: three-app `start.cmd`, which URL is which, shared dev admin session.

## IN PROGRESS (where this session stopped)
- Fixes for the 12 failed browser tests were APPLIED by the builder but NOT REPORTED or verified (the builder was stopped):
  1. Footer CTA visible text "let'stalk" → "let's talk" (axe `label-content-name-mismatch`, all 9 axe failures): code fixed in
     `frontend-2/src/features/public/layout/Footer/Footer.tsx` (seen); its component test: unverified.
  2. UI-T-150 reveal test locator re-resolving after reveal; 3. UI-T-151 header tests scrolling before content loaded:
     `frontend-2/e2e/01-ph2-public.e2e.ts` changed (seen); correctness unverified.
  Lint/tsc/Vitest/build after these fixes: NOT run.
- UI items UI-100..UI-115 are IN-PROGRESS in `docs/ui-scope.md`; nothing of frontend-2 is IMPLEMENTED.

## PENDING (in order)
1. Run lint, `tsc --noEmit`, Vitest and `npm run build` in `frontend-2/`; then, after telling the user, the browser tests on the
   TEST DB: port 8000 must be free; optionally start frontend 1 (`cd frontend; npm run dev`) for the parity tests; run
   `cd frontend-2; npx playwright test` (the harness migrates/seeds `mitali_portfolio_test`, refuses non-`_test` databases, starts the
   backend on 8000 and the 5174 dev server); afterwards confirm 8000/5173/5174 are free. Fix non-design failures.
2. Run kit (DONE in the project; pending only the user's real test and the toolkit commit): `start.cmd` starts backend +
   frontend 1 + frontend-2. Mark UI-114 IMPLEMENTED only after the tester passes.
3. The user's P1 review: start the apps, open http://localhost:5174/ (Home), a case study, `/__review/type`, the "P1 review" panel
   (base cream/white `?base=white`, view transitions on/off); check type at 375/768/1024/1440.
4. One-message `/ui-review` round with all changes; apply; re-run checks.
5. PH-3: remaining public screens (Work, Writing + filter, writing sample, About, FAQs, Contact), complete admin, pre-render/SEO
   parity, JSON-LD, admin skeletons, REQ-095 image polish, production-like preview via `FRONTEND_DIST_DIR` process variable,
   parity matrix (41 rows in ui-scope) and the automated parity check.
6. PH-4: polish, `/ui-review freeze` (G-D), code review loop, tester, Lighthouse mobile on an idle machine (record benchmarkIndex),
   close-out (status tags, traceability, CHANGELOG, `docs/FEATURE.html` unchanged since features are identical), `/push-plan`.

## OPEN DECISIONS (need the user)
- White vs cream as the base surface (P1 review).
- View transitions: keep or drop (REQ-094, P1 review).
- Type scale per width (375/768/1024/1440) and all other visual changes (P1 `/ui-review` round).
- Commit the run-kit fixes in the toolkit repo (`C:\Dev\multi-agent-setup`)?
- Collage drift (up to ±12 % of a tile) may briefly overlap neighbouring rows while scrolling (builder note; unverified visually).
- `docs/FEATURE.html` is still marked DRAFT until the user checks it against the built app.

## TESTED VS NOT TESTED
- Tested: frontend-2 unit/component tests (234), lint, types, build, dist scan, motion budget (before the E2E fixes); SEC-UI-014
  proofs 1-4; parity for Home and case study; run-kit validation, dry runs and the PS 5.1 pid/stop logic with dummy processes.
- NOT tested: the E2E fixes (step 1); a REAL `start.cmd`/`stop.cmd` run with the three apps; the frontend-2 dev server against the
  real backend outside the E2E harness; no-JS reveal E2E (skipped until the PH-3 preview exists); Lighthouse for frontend-2;
  any PH-3 screen; Brave/Safari/Firefox (only Chromium in E2E).

## HOW TO RUN AND VERIFY (new machine)
- Prerequisites: see `NEW-MACHINE-SETUP.md` / `.new.md` (PostgreSQL 17 on 5442, `backend/scripts/setup_db.ps1` run by the user,
  `python -m uv sync`, `npm ci` in `frontend/` and `frontend-2/`, `npx playwright install chromium`).
- `start.cmd`: backend 127.0.0.1:8000 + frontend 1 http://localhost:5173 + frontend-2 http://localhost:5174 (DEV DB
  `mitali_portfolio`); opens both front ends (Chrome first). `start.cmd -Only api,web2` for a subset. `stop.cmd` stops them.
  First real run: installs, migrates once, and creates `frontend/.env` and `frontend-2/.env` from their `.env.example` (public values).
- `start-classic.cmd`: backend + frontend 1 only (DEV DB), Brave first, `/` and `/admin`, `-DryRun`, `-Preview`.
- Checks: `cd frontend-2; npm run lint; npx tsc --noEmit; npx vitest --run; npm run build`. Backend unchanged (521+ tests on the
  TEST DB: `cd backend; python -m uv run pytest`).
- E2E: see PENDING step 1 (TEST DB only). Admin E2E uses a throwaway admin created in the test DB by the harness.
- Admin in dev: one shared session for 5173 and 5174 (cookies ignore ports). Create the dev admin with
  `python -m uv run python -m app.cli create-admin --email <email>` (the user does this).

## KNOWN ISSUES AND RISKS
- E2E fixes unverified (see IN PROGRESS).
- The kit's first real run creates `frontend*/.env` from public examples (no switch to disable it yet).
- The secret-scan hook (`.githooks/pre-commit`) is installed but not enabled; enabling it flags existing test/CLI lines with
  `password=` as false alarms.
- Dev server renders on the client, so reveals can fade in on first load there (pre-render arrives in PH-3).
- Scroll-driven parallax/drift need `animation-timeline` support; other browsers show a static layout.
- `npm audit`: 15 moderate findings in the dev toolchain of frontend-2 (fix would be a breaking ESLint downgrade).
- Usage limits: long agents were interrupted several times; keep HANDOFF and this file current.

## DON'TS
- No passwords, keys or tokens in chat or files; never read or print `.env` values.
- Never `git push` (the user pushes); never force-push or rewrite history.
- Never `terraform apply`/destroy; never publish to a store.
- Test data only: E2E on `mitali_portfolio_test`; never production.
- Do not change anything in `frontend/` or `backend/`, and do not touch `start-classic.cmd` or `run/classic/`.
