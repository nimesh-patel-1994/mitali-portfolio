# Changelog — mitali-portfolio

> Append-only. One entry per change set. Newest first. Times in the user's local timezone.

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
