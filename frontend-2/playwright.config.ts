/**
 * Playwright E2E for frontend-2, PH-2 (TS-033 step 2). NOT RUN BY THE BUILDER: needs the backend on the seeded
 * TEST database and the frontend-2 dev server; the orchestrator runs it after telling the user (SD-117).
 * Global setup migrates + seeds `mitali_portfolio_test`, starts the backend (or reuses one with
 * E2E_EXTERNAL_BACKEND=1) and the dev server on http://localhost:5174. One worker: tests share the database.
 * Screenshot/axe contexts use reducedMotion "reduce" (final state); motion journeys set "no-preference".
 */
import { defineConfig, devices } from "@playwright/test";
import { DEV_URL, adminPassword } from "./e2e/support/harness";

adminPassword();

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  outputDir: `${process.env.E2E_OUT ?? "test-results"}/artifacts`,
  reporter: [["list"], ["json", { outputFile: `${process.env.E2E_OUT ?? "test-results"}/e2e-results.json` }]],
  globalSetup: "./e2e/support/global-setup.ts",
  globalTeardown: "./e2e/support/global-teardown.ts",
  use: {
    baseURL: DEV_URL,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" } }],
});
