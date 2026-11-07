# Phases: mitali-portfolio

> Delivery plan. Requirements are grouped into small phases that each end in something you can run or see. Only the ACTIVE phase gets full
> specs and code; later phases stay outlines until they start (this keeps every session small and cheap). Managed by `/phase` and the `phasing` skill.
> Phase status: `PH-n [PLANNED|ACTIVE|DELIVERED|SKIPPED <date time>]`. Items carry `@PH-n` after their status tag.
> Created by `/upgrade-project` (toolkit 0.5.0 → 1.2.0) on 2026-10-31 02:16. The project was built before phases existed, so every item delivered so far
> belongs to PH-1; items without an `@PH-n` marker are PH-1 items.

ui_first: no                    <!-- the UI was built before UI-first existed (project already past its UI) -->
design_freeze: n/a              <!-- applies to frontend/; a later UI-first phase for a new variant sets its own freeze in its phase block -->
size: auto
points_per_usage_pct: unknown   <!-- PH-1 predates calibration -->

## Plan
| Phase (kind) | Goal | Deliverable (what you can run or see) | REQ items | Points | Depends on | Status |
|-------|------|----------------------------------------|-----------|--------|------------|--------|
| PH-1 (full build) | Portfolio site, admin area, tests and launcher | Public site + /admin on the dev database via `start-classic.cmd`; tests green | REQ-001..REQ-072, REQ-NFR-001..008 (44) | n/a (pre-phasing) | — | DELIVERED 2026-10-31 13:40 |

## Phase details

### PH-1 [DELIVERED 2026-10-31 13:40]: Initial build
- Goal: the full portfolio (public site, admin, seed, tests, launcher) from the intake brief.
- Deliverable and demo steps: `start-classic.cmd` → http://localhost:5173/ and /admin (see `start.md`).
- REQ items: all 44 (REQ-001..REQ-072, REQ-NFR-001..008), IMPLEMENTED (CHG-001..CHG-010).
- Layers touched: backend (FastAPI), web app `frontend/` (React), database (PostgreSQL 17). No mobile, no cloud.
- Out of scope: hosting and cloud, email notifications, analytics.
- Delivered on / usage / notes: 2026-10-31; usage not calibrated (phasing introduced afterwards); pushed to origin/main (54dfefe).

## Backlog (agreed but not yet in a phase)
- frontend-2 design variant (feature agreed 2026-10-31; planned as its own phases after this upgrade).

## Calibration (filled at each phase gate)
| Phase | Points planned | Points done | Usage used (%) | Percent per point | Cached tokens read / written (Settings > Usage) | Rounds (review/test) | Notes |
|-------|----------------|-------------|----------------|-------------------|--------------------------------------------------|----------------------|-------|
| PH-1 | n/a | n/a | n/a | n/a | n/a | review 3 + 1 extra, test 2 | predates phasing |
