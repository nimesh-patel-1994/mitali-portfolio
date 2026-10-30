Playwright E2E journeys (ui-scope 6.1, TS-019 step 4). Test IDs are in the test titles (UI-T-103..126, SEC-*, REQ-*).

What `npm run e2e` (= `playwright test`) does, via e2e/support/global-setup.ts:
  1. Reads TEST_DATABASE_URL from backend/.env (never printed; refuses a database whose name does not end in _test)
     and uses it as DATABASE_URL for every backend process. The dev database is never touched.
  2. `alembic downgrade base` + `alembic upgrade head` on the TEST database, then `python -m app.cli seed --reset`
     (APP_ENV=development so the 4 sample enquiries exist) with MEDIA_ROOT in a new temp folder.
  3. Creates the throwaway admin e2e-admin@example.com with a random password held only in the test process env.
  4. Starts uvicorn app.main:app on 127.0.0.1:8000 (--no-server-header, APP_ENV=test, SERVE_FRONTEND=true).
  5. Runs `npm run build:site` against it (API_BASE_URL and VITE_SITE_URL = http://127.0.0.1:8000).
  Teardown stops the server and deletes the temp folder. Port 8000 must be free.
  Note: the pytest session also truncates mitali_portfolio_test; do not run both at the same time.
  Note: `npm run build:site` overwrites frontend/dist with a build of the TEST content; rebuild against the dev
  backend afterwards if you preview the dev site.

Files (run in this order, one worker, shared database state):
  01-public.e2e.ts      public pages, axe at 360/810/1440, no-JS, menu, filter, keyboard, reduced motion, sitemap,
                        same-origin / CSP / dist scans
  02-admin.e2e.ts       contact form, admin auth, case study CRUD + results + gallery upload, reorder, settings,
                        profile, rebuild flow, enquiries, axe on admin screens, login throttle (last)
  03-lighthouse.e2e.ts  Lighthouse mobile on 8 public pages (median of 3 runs); skipped unless LIGHTHOUSE_BIN points
                        at a Lighthouse 13.x executable installed OUTSIDE the project (Lighthouse / @lhci/cli are
                        not project dependencies: the @lhci/cli tree fails `npm audit --audit-level=high`)

Environment variables: E2E_OUT (output folder, default test-results), LIGHTHOUSE_BIN, LH_RUNS (default 3).
Helper: e2e/support/db_tools.py clear-limits (empties rate_limit_counters on the TEST database only).
