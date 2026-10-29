# mitali-portfolio â€” Project Rules

This project uses the `dev-pipeline` toolkit. Documents live in `docs/`:
requirements.md, design-brief.md, SystemDesign.md, tech-spec.md, backend-scope.md, ui-scope.md,
mobile-scope.md, cloud-scope.md, security.md, api-contract.yaml, traceability.md, CHANGELOG.md.
`.dev-pipeline/intake.md` is the agreed starting brief from the first discussion; `docs/` becomes the source of truth after `/init-project`.
This folder is its own git repository and its own Claude session; do not touch other projects.

## Rules for every agent
1. Read `docs/SystemDesign.md` (YAML header first) before doing anything. Never assume a stack.
2. Status tags follow the `status-tracker` skill. Never change a tag outside your role.
3. Never skip an approval gate. Gates: (G1) user says "proceed" once requirements, tech stack and environment check are agreed,
   (G2) user approves docs 2-6, (G3) user runs `terraform apply` personally,
   (G4) user runs the manual device checks and publishes to the app stores personally.
4. Never run `terraform apply`, `destroy`, or any command that changes live cloud resources.
   Never upload to an app store or create/commit signing keys.
5. Every change is logged in `docs/CHANGELOG.md` with date, time and change-set ID.
6. Review/test fix loop is capped at 3 rounds, then stop and report.
7. If the `mcp_servers` list in the SystemDesign header is not empty, use those MCP servers for
   platform documentation, schemas and data instead of guessing. If one is listed but not connected,
   say so and stop that step rather than inventing platform behaviour.
8. By default there is no emulator, simulator or iOS build capability. Mobile work is verified headless
   (static analysis, unit and component/widget tests). Device checks are `MOB-M-*` items for the user.
   A device test counts only if it ran on a device the user provided and made reachable, or the user
   supplied the run output in `docs/test-results/` (label it USER-RUN). Never start emulators.
   Never report a device-only check as passed without one of those.
9. If `mobile` is set, the API stays backward compatible with every supported app version.
10. UI and mobile code uses the design tokens in `docs/design-brief.md`; no hard-coded colours, fonts or spacing.
    Logos come from `assets/brand/` and are never edited or redrawn.
11. Reference sites: never copy their text, images, logos, fonts or code into the project; no hot-linking. All content is original
    or dummy data. Reference screenshots stay in `.dev-pipeline/reference/screenshots/` and out of git.
12. Git: never commit secrets or `.env`. Commit and push only when I ask, and only to the remote I give you.
    Never force-push and never rewrite history.

## Pipeline
/feature -> requirements -> (G1) -> SystemDesign + specs -> (G2) -> build -> review -> test -> IMPLEMENTED
