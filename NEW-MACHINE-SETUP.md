# Set up mitali-portfolio on a new computer or a new Claude account

Everything the project needs is in git: this repository and the toolkit repository. Claude settings, memory, plugins and
chat history are tied to one account and are **not** needed. Follow the steps in order.

## What lives where

| Thing | Where | In git? |
|-------|-------|---------|
| Toolkit (marketplace `multi-agent-setup`, plugin `dev-pipeline`) | https://github.com/nimesh-patel-1994/multi-agent-setup -> `C:\Dev\multi-agent-setup` | yes |
| This project | https://github.com/nimesh-patel-1994/mitali-portfolio -> `C:\Dev\projects\mitali-portfolio` | yes |
| Other adopted project (learnhub) | see `C:\Dev\projects\learnhub\NEW-MACHINE-SETUP.md` | see that file |
| `backend/.env`, `frontend/.env` | recreate from the `.env.example` files | no (secrets) |
| PostgreSQL databases and their data | recreate (README, Backend steps 2-6) | no |
| Uploaded media (`backend/media/uploads/`) | re-created by the seed and admin uploads | no |
| Reference screenshots and raw capture | not needed; `reference-notes.md` is committed | no |
| Usage and budget files (`.dev-pipeline/usage.json`, `budget.json`) | re-created by the status line and `/budget` | no |

Keep the same folders (`C:\Dev\multi-agent-setup`, `C:\Dev\projects\...`). The launcher looks for the toolkit there; any
other folder works if you set the `DEV_PIPELINE_TOOLKIT` environment variable to it.

## 1. Install the tools (once per computer, PowerShell)

```powershell
winget install --id Git.Git -e
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.12
winget install astral-sh.uv
winget install PostgreSQL.PostgreSQL.17
```

Open a new PowerShell window, then set your git identity:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 2. Install Claude Code and sign in with the new account

```powershell
npm install -g @anthropic-ai/claude-code
claude          # sign in with the account for this computer, then type /exit
```

The Claude desktop app (Code tab) works too; install it from claude.ai/download and sign in.

## 3. Get the toolkit and register it as a marketplace

```powershell
git clone https://github.com/nimesh-patel-1994/multi-agent-setup C:\Dev\multi-agent-setup
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\multi-agent-setup\scripts\check-setup.ps1
```

The repository is private: sign in to GitHub when Git asks. `check-setup.ps1` lists what is missing and installs nothing.

Then load the plugin in one of these ways:

- **Desktop app (Code tab):** Settings > Plugins > Add marketplace, choose the local folder `C:\Dev\multi-agent-setup`
  (or the GitHub source `nimesh-patel-1994/multi-agent-setup`), then install `dev-pipeline`.
- **CLI, installed once:** in `claude`, run `/plugin marketplace add nimesh-patel-1994/multi-agent-setup`, then
  `/plugin install dev-pipeline@multi-agent-setup`.
- **CLI, no install:** the project launcher (`open-claude.ps1`) passes `--plugin-dir C:\Dev\multi-agent-setup` for you.

Check: type `/dev-pipeline:` in a session; the commands (`resume`, `feature`, `bug`, `handoff` ...) are listed.

## 4. Get this project

```powershell
git clone https://github.com/nimesh-patel-1994/mitali-portfolio C:\Dev\projects\mitali-portfolio
cd C:\Dev\projects\mitali-portfolio
git switch feature/initial-build      # the build branch, until it is merged into main
```

## 5. Recreate what is not in git

Follow `README.md`, section **Backend**, steps 1 to 6 (PostgreSQL 17 on port 5442, role `mitali_app`, the dev and test
databases, `uv sync`, migrations, `create-admin`, seed), and section **Frontend** (`npm ci`). Copy
`backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env` and fill in your own values. Never
commit the `.env` files.

## 6. Open the project and continue

```powershell
cd C:\Dev\projects\mitali-portfolio
.\open-claude.ps1            # or double-click open-claude.cmd; in the desktop app, open this folder in the Code tab
```

Then run `/dev-pipeline:resume`. Claude reads `.dev-pipeline/HANDOFF.md` and `docs/`, checks the tools, says where the
work stopped and continues.

## Moving work between computers or accounts (for example at a usage limit)

1. On the old one: run `/dev-pipeline:handoff`, then commit and push from a terminal (`git push`, never the app's
   "Continue in cloud", which skips hooks).
2. On the new one: `git pull` (or clone as above), open the project with the launcher, run `/dev-pipeline:resume`.
