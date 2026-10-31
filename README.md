# mitali-portfolio

Portfolio website with a FastAPI backend (`backend/`) and a React frontend (`frontend/`).

## Starting the apps (two launchers)

| Launcher | What it starts | Browser | Opens |
|----------|----------------|---------|-------|
| **`start.cmd`** (toolkit run kit; default for daily work with both front ends) | **All three apps** from `run/run.json`, each in its own window, in dependency order: the backend API (`127.0.0.1:8000`, auto-reload), frontend 1 (`localhost:5173`) and frontend-2 (`localhost:5174`). It waits until each answers, then opens both front ends. Installs and migrates **once** on the first run. `-Only api,web2` starts a subset (ids: `api`, `web`, `web2`); `-DryRun`, `-NoBrowser`, `-Reinstall`. **`stop.cmd` stops everything `start.cmd` started** (every window and its child processes), also across several `start.cmd -Only …` runs. `smoke.cmd` checks the health addresses. | Chrome first (then Edge, Firefox, default); Brave is not supported by the kit yet | `http://localhost:5173/` and `http://localhost:5174/` (`/` only) |
| **`start-classic.cmd`** (the original hand-made launcher; unchanged) | Backend (`127.0.0.1:8000`) and **frontend 1 only** (`localhost:5173`) (`run/classic/start-classic.ps1`). Checks PostgreSQL 17 on 5442, prints the target database (host:port/name, no password), runs `alembic upgrade head` on every start, reuses anything already running. `-Preview` rebuilds the pre-rendered site from the dev database and serves it production-like on `localhost:8000`; `-NoBrowser`; `-DryRun`. Close its windows to stop it (it is not tracked by `stop.cmd`). | Brave, else Chrome, else default | frontend 1 `/` and `/admin` |

Which address is which:

| Address | App |
|---------|-----|
| http://localhost:5173/ (admin: http://localhost:5173/admin) | **frontend 1** (`frontend/`, the current design) |
| http://localhost:5174/ (admin from PH-3: http://localhost:5174/admin) | **frontend-2** (`frontend-2/`, the design variant) |
| http://127.0.0.1:8000/api/health | backend API (both front ends use it through their dev proxies) |

Notes:
- **One admin session for both front ends in development:** browsers ignore the port for cookies, so the admin cookies on
  `localhost` are shared by 5173 and 5174. Logging in or out on one front end does the same on the other.
- frontend-2's dev server rewrites the `Origin` header of `/api/admin` requests to the backend's own origin, in development only
  (SEC-UI-014); builds and previews never do this, and frontend 1 is unchanged.
- On their first real run through `start.cmd`, `frontend/.env` and `frontend-2/.env` are created from their `.env.example` files
  (public values only: `VITE_SITE_URL`). `start-classic.cmd` never creates `.env` files.
- Both launchers start against the **dev** database (`mitali_portfolio`); the tests use `mitali_portfolio_test`.
- The original `start.cmd` text is saved as `run/classic/start.cmd.original`. More detail: `start.md`.


## Backend

FastAPI + PostgreSQL 17. All commands run from the `backend/` folder in PowerShell unless stated otherwise. If `uv` is
not on your `PATH`, use `python -m uv` instead of `uv`.

### 1. Prerequisites

- Python 3.12 and [uv](https://docs.astral.sh/uv/) (dependency manager; the lockfile is `backend/uv.lock`).
- PostgreSQL 17 running locally on **port 5442**, accepting connections from `127.0.0.1` / `::1` only.
  `psql` is used by its full path: `C:\Program Files\PostgreSQL\17\bin\psql.exe`.
- No Docker is needed: tests use the local database `mitali_portfolio_test`.

### 2. Create the database role and databases (you run this once)

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File backend\scripts\setup_db.ps1
```

The script asks for a new password for the app role `mitali_app` (hidden input) and lets `psql` ask for the
PostgreSQL superuser password itself. It creates `mitali_portfolio` and `mitali_portfolio_test` and can write
`backend\.env` for you. Never paste passwords into chat, scripts or files other than `backend\.env` (git-ignored).
Without the script: copy `backend\.env.example` to `backend\.env` and fill in the placeholders.

### 3. Install dependencies

```powershell
cd backend
uv sync
```

### 4. Create the schema

```powershell
uv run alembic upgrade head
```

### 5. Create the admin account (once)

```powershell
uv run python -m app.cli create-admin --email you@example.com
```

The password (12 to 128 characters, not your email) is asked twice and never shown. There is only one admin and no
sign-up page.

### 6. Load the sample content

```powershell
uv run python -m app.cli seed            # inserts missing sample records only (keeps your edits)
uv run python -m app.cli seed --reset    # puts seeded records back to their original sample values
```

All sample content is fictional and flagged as sample data; placeholder images are generated locally into
`backend\media\seed\`. Four sample enquiries are added only when `APP_ENV=development`.

### 7. Run the backend for development

```powershell
uv run fastapi dev app/main.py
```

Listens on `http://127.0.0.1:8000` (loopback only). Start the frontend dev server in a second terminal (see
Frontend); it proxies `/api` and `/media` to the backend.

### 8. Run the tests

```powershell
uv run pytest --cov=app --cov-branch
```

Needs `TEST_DATABASE_URL` in `backend\.env` pointing at `mitali_portfolio_test` (the test session refuses any
database whose name does not end in `_test`). Quality checks: `uv run ruff check .`, `uv run ruff format --check .`,
`uv run mypy --strict app`, `uv run pip-audit`, `uv run bandit -r app -ll`, and
`uv run python scripts/check_contract.py` (generated API vs `docs/api-contract.yaml`).

### 9. Production-like preview (FastAPI serves the built site)

Build the site first (`cd frontend; npm run build:site`, with the backend running), then start the backend with
`SERVE_FRONTEND=true`:

```powershell
$env:SERVE_FRONTEND = "true"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-server-header --no-access-log
```

Open `http://127.0.0.1:8000`. Always pass `--host 127.0.0.1`: `fastapi run` and other production servers listen on
all network interfaces (`0.0.0.0`) by default, which would expose the admin over plain http. If you use
`uv run fastapi run app/main.py --host 127.0.0.1` instead, note that it cannot switch off the `Server` header.
After content changes, the admin dashboard shows "Site needs rebuilding" until you run
`cd frontend; npm run build:site` again.

### 10. Reset the admin password

```powershell
uv run python -m app.cli reset-password
```

Sets a new password, ends all admin sessions and clears a login lock-out.

### 11. Back up the database

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h localhost -p 5442 -U mitali_app -Fc -f "$HOME\Backups\mitali_portfolio.dump" mitali_portfolio
```

This is `pg_dump -h localhost -p 5442 -U mitali_app -Fc mitali_portfolio > backup.dump`, written with `-f` because
PowerShell's `>` redirection can corrupt binary output. `pg_dump` asks for the `mitali_app` password. Backups
contain enquiries and the admin password hash: keep them outside this repository on an encrypted disk (`*.dump` is
git-ignored). Restore with `pg_restore.exe -h localhost -p 5442 -U mitali_app -d mitali_portfolio --clean <file>` (also in
`C:\Program Files\PostgreSQL\17\bin\`).

## Frontend

_Added by the frontend build._
