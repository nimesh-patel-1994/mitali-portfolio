/**
 * UI-T-120 / REQ-NFR-004: Lighthouse (default mobile profile: simulated throttling, moto-g-power emulation) on the 6
 * static pages + one case study + one writing sample of the production-like build, after re-seeding and rebuilding so
 * content is pristine. Median of LH_RUNS runs (default 3) per page. LH_CHROME_PATH overrides the browser executable.
 * Lighthouse / Lighthouse CI are NOT project dependencies (the @lhci/cli tree fails `npm audit --audit-level=high`, and
 * lhci 0.15.1 bundles Lighthouse 12.6.1 which hits NO_NAVSTART on Chromium 156). Point LIGHTHOUSE_BIN at a
 * `lighthouse` (13.x) executable installed outside the project. Skipped when LIGHTHOUSE_BIN is not set.
 */
import { chromium, expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL, backendCli, rebuildSite } from "./support/harness";
import { PUBLIC_PATHS } from "./support/helpers";

test.setTimeout(1_800_000);

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

interface Lhr {
  runtimeError?: { code: string };
  categories: Record<string, { score: number | null }>;
  audits: Record<string, { score: number | null; numericValue?: number; displayValue?: string; scoreDisplayMode: string }>;
}

test("UI-T-120 Lighthouse mobile ≥ 0.9 in Performance, Accessibility, Best Practices, SEO", async () => {
  const lighthouse = process.env.LIGHTHOUSE_BIN;
  test.skip(!lighthouse, "LIGHTHOUSE_BIN not set");
  if (process.env.LH_SKIP_RESEED !== "1") {
    backendCli(["seed", "--reset"], { appEnv: "development", label: "seed --reset (pristine content)" });
    rebuildSite();
  }
  const runs = Number(process.env.LH_RUNS ?? 3);
  const out = join(process.env.E2E_OUT ?? "test-results", "lighthouse");
  mkdirSync(out, { recursive: true });

  const table: Record<string, Record<string, number | string>> = {};
  const failing: string[] = [];
  for (const [name, path] of Object.entries(PUBLIC_PATHS)) {
    const results: Lhr[] = [];
    for (let i = 0; i < runs; i++) {
      const file = join(out, `${name}-${i}.json`);
      const res = spawnSync(
        lighthouse!,
        [
          `${BASE_URL}${path}`,
          "--output=json",
          `--output-path=${file}`,
          "--quiet",
          // LH_CHROME_PATH may point at chrome-headless-shell (avoids NO_NAVSTART trace errors seen with --headless=new).
          `--chrome-path=${process.env.LH_CHROME_PATH ?? chromium.executablePath()}`,
          ...(process.env.LH_CHROME_PATH ? [] : ["--chrome-flags=--headless=new"]),
        ],
        { encoding: "utf8", shell: process.platform === "win32", timeout: 300_000 },
      );
      if (res.status !== 0) {
        console.log(`LH ${path} run ${i} failed: ${(res.stderr ?? "").slice(-500)}`);
        continue;
      }
      const lhr = JSON.parse(readFileSync(file, "utf8")) as Lhr;
      if (!lhr.runtimeError) results.push(lhr);
    }
    expect.soft(results.length, `no successful Lighthouse run for ${path}`).toBeGreaterThan(0);
    if (results.length === 0) {
      table[path] = { runs: 0 };
      console.log(`LH ${path} not measured (every run failed)`);
      continue;
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
    const row: Record<string, number | string> = { runs: results.length };
    for (const c of CATEGORIES) {
      row[c] = Math.round(median(results.map((r) => r.categories[c]?.score ?? 0)) * 100);
      if ((row[c] as number) < 90) failing.push(`${path} ${c}=${row[c]}`);
    }
    // Key metrics of the median-performance run.
    const mid = [...results].sort((a, b) => (a.categories.performance?.score ?? 0) - (b.categories.performance?.score ?? 0))[Math.floor(results.length / 2)]!;
    for (const m of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"]) {
      row[m] = mid.audits[m]?.displayValue ?? "";
    }
    row.weak = Object.entries(mid.audits)
      .filter(([, a]) => a.score !== null && a.score < 0.9 && ["binary", "numeric", "metricSavings"].includes(a.scoreDisplayMode))
      .map(([id]) => id)
      .join(", ");
    table[path] = row;
    console.log(`LH ${path} ${JSON.stringify(row)}`);
  }
  writeFileSync(join(out, "scores.json"), JSON.stringify(table, null, 2));
  expect.soft(failing).toEqual([]);
});
