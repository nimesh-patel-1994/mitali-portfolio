/**
 * Playwright E2E scaffold (TS-019, ui-scope 6.1). Not run in batch 1: the journeys need the backend serving the
 * pre-rendered `dist` (SERVE_FRONTEND=true) on the seeded test database. Start that first, then `npm run e2e`.
 */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 } } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-810", use: { ...devices["Desktop Chrome"], viewport: { width: 810, height: 1080 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
