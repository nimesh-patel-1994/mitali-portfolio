# Traceability — mitali-portfolio

> One row per requirement. Updated by every agent that touches a linked item.
> A requirement is IMPLEMENTED only when every linked item is IMPLEMENTED and tests pass.
> "—" = not yet filled (code is filled by builders). "n/a" = no security item specific to this requirement
> (project-wide SEC-001..SEC-011 still apply). Scope and test columns list backend IDs first, then UI IDs, separated
> by ";". Ranges such as `BE-T-005..009` include both ends; bare numbers continue the preceding prefix.

| REQ | Tech spec | Scope items | Security | Code | Tests | Status |
|-----|-----------|-------------|----------|------|-------|--------|
| REQ-001 | TS-003, TS-005, TS-006 | BE-022; UI-002, UI-007, UI-019, UI-021, UI-022, UI-027, UI-032, UI-034 | SEC-010, SEC-BE-012, SEC-UI-003 | backend/app, frontend/src (see scope items) | BE-T-097..098; UI-T-004, 005, 012, 069, 103, 104 | IMPLEMENTED 2026-10-31 00:12 |
| REQ-002 | TS-002, TS-004, TS-006, TS-013 | BE-002, BE-006, BE-019; UI-005, UI-006, UI-019, UI-056 | SEC-BE-014, SEC-UI-004 | backend/app, frontend/src (see scope items) | BE-T-005..009, 019, 027, 089..090; UI-T-016, 017, 018, 035, 107 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-003 | TS-006 | UI-019, UI-020 | n/a | backend/app, frontend/src (see scope items) | UI-T-036, 037, 038, 106, 107 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-004 | TS-002, TS-004, TS-005, TS-006, TS-013 | BE-002, BE-006, BE-019; UI-005, UI-021, UI-056 | SEC-BE-014, SEC-UI-004 | backend/app, frontend/src (see scope items) | BE-T-005..009, 027, 089..090; UI-T-039, 040, 103 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-005 | TS-006 | UI-005 | SEC-007 | backend/app, frontend/src (see scope items) | UI-T-016 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-006 | TS-002, TS-004, TS-006 | BE-002, BE-006, BE-016; UI-011, UI-017, UI-022, UI-027, UI-031, UI-033, UI-052 | SEC-BE-013, SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-025, 074..077; UI-T-023, 033, 046, 057, 097 | IMPLEMENTED 2026-10-31 00:12 |
| REQ-010 | TS-006 | UI-003, UI-006, UI-022 | n/a | backend/app, frontend/src (see scope items) | UI-T-041, 103, 112 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-011 | TS-002, TS-004, TS-006 | BE-002, BE-006; UI-010, UI-023 | SEC-BE-005, SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-019, 023, 028..029; UI-T-022, 042 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-012 | TS-002, TS-004, TS-006 | BE-002, BE-006, BE-015; UI-011, UI-024 | SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-019, 070..071; UI-T-023, 043, 109 | IMPLEMENTED 2026-10-31 00:12 |
| REQ-013 | TS-002, TS-004, TS-006 | BE-002, BE-006, BE-015; UI-006, UI-025, UI-050 | SEC-UI-001, SEC-UI-004 | backend/app, frontend/src (see scope items) | BE-T-019, 070..072; UI-T-044, 095 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-014 | TS-002, TS-004, TS-006, TS-013 | BE-002, BE-006, BE-019; UI-013, UI-018, UI-022, UI-031, UI-055 | SEC-BE-010, SEC-UI-001, SEC-UI-009 | backend/app, frontend/src (see scope items) | BE-T-027, 089, 091; UI-T-034, 099, 122 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-015 | TS-002, TS-004, TS-006 | BE-002, BE-006, BE-015; UI-012, UI-026, UI-051 | SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-019, 026, 070..072; UI-T-025..028, 045, 096, 109 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-020 | TS-002, TS-004, TS-006 | BE-002, BE-006; UI-009, UI-010, UI-013, UI-027 | SEC-BE-005, SEC-UI-001, SEC-UI-009 | backend/app, frontend/src (see scope items) | BE-T-019, 028..029; UI-T-021, 022, 046 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-021 | TS-002, TS-004, TS-006 | BE-002, BE-006; UI-010, UI-013, UI-014, UI-028, UI-044..UI-046 | SEC-BE-013, SEC-UI-001, SEC-UI-009 | backend/app, frontend/src (see scope items) | BE-T-020..022; UI-T-047..049 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-022 | TS-004, TS-005, TS-006 | BE-006, BE-022; UI-002, UI-004, UI-028, UI-030, UI-034 | SEC-BE-005, SEC-BE-012, SEC-UI-002 | backend/app, frontend/src (see scope items) | BE-T-020, 097; UI-T-005, 008, 104 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-023 | TS-002, TS-004, TS-006, TS-017 | BE-002, BE-006, BE-013, BE-023; UI-010, UI-015, UI-028, UI-029 | SEC-007 | backend/app, frontend/src (see scope items) | BE-T-021, 063, 099; UI-T-022, 031, 048, 118 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-030 | TS-002, TS-004, TS-006 | BE-002, BE-006, BE-014; UI-009, UI-010, UI-029 | SEC-BE-007, SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-024, 069; UI-T-021, 050..054, 105, 108 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-031 | TS-002, TS-004, TS-006, TS-012 | BE-002, BE-006, BE-014, BE-018; UI-014, UI-030, UI-041, UI-048 | SEC-BE-013, SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-068, 086..088; UI-T-030, 055, 083 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-040 | TS-002, TS-004, TS-006 | BE-002, BE-006, BE-015, BE-019; UI-016, UI-018, UI-031, UI-053..UI-055 | SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-019, 073, 089; UI-T-056, 057, 098 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-041 | TS-002, TS-004, TS-006 | BE-002, BE-006, BE-016; UI-011, UI-016, UI-032, UI-052 | SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-025, 074..077; UI-T-023, 058, 059, 109 | IMPLEMENTED 2026-10-31 00:12 |
| REQ-042 | TS-002, TS-003, TS-006, TS-007, TS-013 | BE-002, BE-003, BE-006, BE-007, BE-019; UI-033, UI-056 | SEC-011, SEC-BE-007, SEC-BE-008, SEC-BE-009, SEC-UI-007 | backend/app, frontend/src (see scope items) | BE-T-010, 030..031, 036, 110..112; UI-T-060..068, 110, 124..126 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-043 | TS-002, TS-007 | BE-002, BE-007; UI-033 | SEC-BE-008, SEC-UI-007 | backend/app, frontend/src (see scope items) | BE-T-032..035; UI-T-064, 067, 111 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-050 | TS-004, TS-005 | BE-006, BE-022; UI-004, UI-028, UI-030 | SEC-010, SEC-UI-002, SEC-UI-003 | backend/app, frontend/src (see scope items) | BE-T-027..028, 097; UI-T-004, 006, 010, 105 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-051 | TS-005 | BE-022; UI-004 | SEC-UI-002, SEC-UI-011 | backend/app, frontend/src (see scope items) | BE-T-097; UI-T-008, 121 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-052 | TS-002, TS-005, TS-010, TS-015 | BE-002, BE-012, BE-021; UI-004, UI-038 | SEC-BE-017, SEC-UI-002 | backend/app, frontend/src (see scope items) | BE-T-055, 066..067, 095..096; UI-T-009, 077, 115 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-060 | TS-002, TS-008, TS-016 | BE-002, BE-004, BE-008, BE-009; UI-035..UI-037 | SEC-BE-001, SEC-BE-003, SEC-BE-004, SEC-BE-005, SEC-UI-005, SEC-UI-006 | backend/app, frontend/src (see scope items) | BE-T-014, 037..044; UI-T-070..076, 113 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-061 | TS-002, TS-008 | BE-002, BE-010; UI-036 | SEC-BE-006 | backend/app, frontend/src (see scope items) | BE-T-045..049; UI-T-073, 114 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-062 | TS-009 | BE-011; UI-036 | SEC-BE-001, SEC-BE-002 | backend/app, frontend/src (see scope items) | BE-T-050..054 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-063 | TS-002, TS-010, TS-011, TS-016 | BE-002, BE-012, BE-013, BE-017, BE-018; UI-039..UI-046 | SEC-BE-005, SEC-BE-007, SEC-BE-010, SEC-BE-011, SEC-BE-012, SEC-BE-013, SEC-UI-009 | backend/app, frontend/src (see scope items) | BE-T-055..065, 078..085; UI-T-079..091, 115, 116 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-064 | TS-002, TS-010, TS-011, TS-012, TS-016 | BE-002, BE-012, BE-014..BE-018; UI-039..UI-042, UI-047..UI-054 | SEC-BE-005, SEC-BE-007, SEC-BE-010, SEC-BE-011, SEC-BE-013, SEC-UI-001 | backend/app, frontend/src (see scope items) | BE-T-064, 068..088; UI-T-079..086, 092..098, 117 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-065 | TS-002, TS-011, TS-013, TS-016 | BE-002, BE-003, BE-006, BE-017, BE-019; UI-021, UI-033, UI-040, UI-042, UI-055, UI-056 | SEC-BE-010, SEC-BE-014, SEC-UI-004 | backend/app, frontend/src (see scope items) | BE-T-089..091, 110..112; UI-T-081, 099, 100, 122..126 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-066 | TS-002, TS-003, TS-014, TS-015, TS-016 | BE-002, BE-003, BE-020, BE-021; UI-009, UI-037, UI-038, UI-057, UI-058 | SEC-011, SEC-BE-009, SEC-UI-008 | backend/app, frontend/src (see scope items) | BE-T-013, 092..096; UI-T-075, 078, 101, 102, 110, 119 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-067 | TS-002, TS-010, TS-016 | BE-002, BE-012, BE-013, BE-014; UI-015, UI-043..UI-045, UI-047, UI-048 | SEC-BE-005 | backend/app, frontend/src (see scope items) | BE-T-063, 069; UI-T-089, 118 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-070 | TS-017 | BE-023 | SEC-007, SEC-BE-019 | backend/app, frontend/src (see scope items) | BE-T-099..101, 103..104 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-071 | TS-017 | BE-005, BE-023 | SEC-006, SEC-007, SEC-BE-019 | backend/app, frontend/src (see scope items) | BE-T-018, 102 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-072 | TS-001, TS-018 | BE-001, BE-024, BE-026 | SEC-003, SEC-004 | backend/app, frontend/src (see scope items) | BE-T-004, 105..106, 109 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-NFR-001 | TS-006, TS-019 | UI-001 | n/a | backend/app, frontend/src (see scope items) | UI-T-103 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-NFR-002 | TS-006, TS-016, TS-019 | UI-001, UI-011, UI-012, UI-019, UI-020, UI-029, UI-031, UI-033, UI-035..UI-042 | n/a | backend/app, frontend/src (see scope items) | UI-T-023, 026, 037, 060, 082, 103, 109 | IMPLEMENTED 2026-10-31 00:12 |
| REQ-NFR-003 | TS-006 | UI-003, UI-011, UI-012, UI-020 | n/a | backend/app, frontend/src (see scope items) | UI-T-014, 015, 112 | IMPLEMENTED 2026-10-31 00:12 |
| REQ-NFR-004 | TS-005, TS-006, TS-011, TS-019 | BE-005, BE-017, BE-022; UI-002, UI-004, UI-013 | SEC-010, SEC-BE-018, SEC-UI-003 | backend/app, frontend/src (see scope items) | BE-T-018, 078..079, 097; UI-T-029, 120 | IMPLEMENTED 2026-10-31 00:12 |
| REQ-NFR-005 | TS-002, TS-003, TS-007, TS-008, TS-014 | BE-002, BE-003, BE-004, BE-007, BE-008, BE-009, BE-020; UI-033, UI-035, UI-057, UI-058 | SEC-003, SEC-008, SEC-011, SEC-BE-001, SEC-BE-003, SEC-BE-004, SEC-BE-005, SEC-BE-009, SEC-UI-006, SEC-UI-008 | backend/app, frontend/src (see scope items) | BE-T-016, 034, 037, 043..044, 092..094; UI-T-070, 071, 102 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-NFR-006 | TS-001, TS-018, TS-019 | BE-001, BE-005, BE-024, BE-025, BE-026 | SEC-001, SEC-004, SEC-UI-012 | backend/app, frontend/src (see scope items) | BE-T-001..003, 017, 105..109 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-NFR-007 | TS-001, TS-006 | UI-001 | SEC-006 | backend/app, frontend/src (see scope items) | UI-T-001..003 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-NFR-008 | TS-001 | BE-001 | SEC-005 | backend/app, frontend/src (see scope items) | BE-T-001 | IMPLEMENTED 2026-10-30 18:36 |
| REQ-DOC-001 | — | — (orchestrator, `make-feature-guide.ps1`) | n/a | docs/feature-guide.json, docs/FEATURE.html | `make-feature-guide.ps1 -CheckOnly` (ok, 1 warning: internal REQs deliberately not in the guide) | NEW 2026-10-31 02:21 |
