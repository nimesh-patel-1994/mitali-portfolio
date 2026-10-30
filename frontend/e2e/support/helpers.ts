/** Shared E2E helpers (tester): axe at WCAG 2.1 AA, admin login, reveal settling, result recording. */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_EMAIL, adminPassword } from "./harness";

export const WIDTHS = [360, 810, 1440] as const;
export const HEIGHT_FOR: Record<number, number> = { 360: 780, 390: 844, 810: 1080, 1440: 900 };

export const PUBLIC_PATHS = {
  home: "/",
  work: "/work",
  caseStudy: "/work/verdant-loop",
  writing: "/writing",
  sample: "/writing/verdant-loop-welcome-sequence",
  about: "/about",
  contact: "/contact",
  faqs: "/faqs",
} as const;

function outDir(): string {
  const dir = join(process.env.E2E_OUT ?? "test-results", "axe");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Scroll through the page so scroll-reveal content is shown, then back to the top. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
}

export interface AxeSummary {
  page: string;
  width: number;
  violations: { id: string; impact: string | null | undefined; nodes: number; targets: string[]; help: string }[];
}

/** Runs axe with the WCAG 2.0/2.1 A + AA rule tags, records every violation, fails on serious/critical ones. */
export async function axeCheck(page: Page, label: string, width: number, testInfo: TestInfo): Promise<AxeSummary> {
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary: AxeSummary = {
    page: label,
    width,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
      help: v.help,
    })),
  };
  appendFileSync(join(outDir(), "axe-results.jsonl"), `${JSON.stringify(summary)}\n`);
  await testInfo.attach(`axe ${label} @${width}`, { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  const blocking = summary.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect.soft(blocking, `axe serious/critical violations on ${label} at ${width}px`).toEqual([]);
  return summary;
}

export async function loginAdmin(page: Page, next?: string): Promise<void> {
  await page.goto(next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel(/^Password/).fill(adminPassword());
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
}

export async function noHorizontalScroll(page: Page): Promise<{ scrollWidth: number; innerWidth: number; scrollX: number }> {
  return page.evaluate(() => {
    const scrollWidth = document.scrollingElement?.scrollWidth ?? 0;
    window.scrollTo(400, window.scrollY);
    const scrollX = window.scrollX;
    window.scrollTo(0, window.scrollY);
    return { scrollWidth, innerWidth: window.innerWidth, scrollX };
  });
}
