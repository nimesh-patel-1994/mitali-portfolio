/** Shared E2E helpers (frontend-2, PH-2): widths, axe at WCAG 2.1 AA, overflow and touch-target checks. */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CASE_STUDY_PATH } from "./harness";

export const WIDTHS = [375, 768, 1024, 1440] as const;
export const HEIGHT_FOR: Record<number, number> = { 360: 780, 375: 812, 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080 };
export const PAGES = { home: "/", caseStudy: CASE_STUDY_PATH } as const;

/** Hides the dev-only P1 review panel so it never appears in screenshots or axe results. */
export function noPanel(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}review=off`;
}

/** Scroll through the page (reveals settle), then back to the top. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}

export async function axeCheck(page: Page, label: string, testInfo: TestInfo): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
  const dir = join(process.env.E2E_OUT ?? "test-results", "axe");
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "axe-frontend-2.jsonl"), `${JSON.stringify({ label, test: testInfo.title, summary })}\n`);
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.help}`), `axe ${label}`).toEqual([]);
}

export async function noHorizontalScroll(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
}

/** Visible interactive elements smaller than 44 × 44 px (inline text links inside prose excluded). */
export async function smallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("a[href], button"))) {
      if (el.closest("p, li p, [class*='prose']") && el.tagName === "A") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (r.width < 44 || r.height < 44) out.push(`${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
}

/**
 * The dev server renders on the client and loads page data asynchronously: wait for the h1, the network to settle
 * and (on Home) the featured work, so the page is long enough to scroll.
 */
export async function waitForContent(page: Page): Promise<void> {
  await expect(page.locator("main h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/") {
    await expect(page.getByRole("region", { name: "Selected work" })).toBeVisible();
  }
}

/** Scrolls by `total` px in steps with an animation frame (and a short pause) between them. */
export async function scrollInSteps(page: Page, total: number, step = 200): Promise<void> {
  const direction = Math.sign(total);
  let done = 0;
  while (Math.abs(done) < Math.abs(total)) {
    const delta = direction * Math.min(step, Math.abs(total) - Math.abs(done));
    await page.mouse.wheel(0, delta);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(50);
    done += delta;
  }
}
