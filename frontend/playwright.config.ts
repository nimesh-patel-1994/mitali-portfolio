/**
 * Playwright E2E (TS-019 step 4, ui-scope 6.1). Global setup migrates + seeds the TEST database, creates a throwaway
 * admin, starts the production-like preview (FastAPI with SERVE_FRONTEND=true on 127.0.0.1:8000, MEDIA_ROOT in a temp
 * folder) and runs `npm run build:site` against it; teardown stops the server and removes the temp folder.
 * Tests share one database, so they run serially in one worker. Viewports are set per test (360/390/810/1440).
 */
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, adminPassword } from "./e2e/support/harness";

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
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
