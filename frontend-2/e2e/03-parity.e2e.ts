/**
 * UI-T-153 / REQ-093 (PH-2 part): `/` and the case study in both apps against the same API (TEST database).
 * Records the public API operations each app calls per route and compares them, plus the document title.
 * Both dev servers compose page data from the API in the browser, so the recorded network calls are the
 * operations per route. Needs frontend/'s dev server on 5173 as well; skipped (with a note) when it is not running.
 * Description/canonical/og:* parity needs the pre-render and is part of the PH-3 check (UI-T-156).
 * NOT RUN BY THE BUILDER.
 */
import { expect, test, type Page } from "@playwright/test";
import { DEV_URL, FRONTEND1_DEV_URL, reachable } from "./support/harness";
import { PAGES, noPanel } from "./support/helpers";

async function record(page: Page, url: string): Promise<{ ops: string[]; title: string }> {
  const ops = new Set<string>();
  const listener = (req: { url(): string; method(): string }) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith("/api/public/")) ops.add(`${req.method()} ${u.pathname}${u.search}`);
  };
  page.on("request", listener);
  await page.goto(url);
  await expect(page.locator("h1")).toHaveCount(1);
  await page.waitForLoadState("networkidle");
  page.off("request", listener);
  return { ops: [...ops].sort(), title: await page.title() };
}

test.describe("UI-T-153 parity (PH-2 routes)", () => {
  for (const [name, path] of Object.entries(PAGES)) {
    test(`UI-T-153 ${name}: same public operations and title in frontend/ and frontend-2`, async ({ page }) => {
      test.skip(!(await reachable(`${FRONTEND1_DEV_URL}/`)), "frontend/ dev server (5173) not running");
      const one = await record(page, `${FRONTEND1_DEV_URL}${path}`);
      const two = await record(page, `${DEV_URL}${noPanel(path)}`);
      expect(two.ops).toEqual(one.ops);
      expect(two.title).toBe(one.title);
    });
  }
});
