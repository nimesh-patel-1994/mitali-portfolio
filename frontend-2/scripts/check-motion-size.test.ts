// @vitest-environment node
/** UI-T-135 / REQ-NFR-009 / UI-REV-030: motion modules ≤ 2 KB gzip; no scroll listener outside scroll-direction.ts. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { measureMotionBundle, MOTION_BUDGET_GZIP, scanMotionSources } from "./check-motion-size";

const SRC = join(process.cwd(), "src");

describe("UI-T-135 motion budget", () => {
  it("the production bundle of src/shared/motion/index.ts is ≤ 2048 bytes gzip", async () => {
    const size = await measureMotionBundle(join(SRC, "shared", "motion", "index.ts"));
    expect(size.gzip).toBeGreaterThan(0);
    expect(size.gzip).toBeLessThanOrEqual(MOTION_BUDGET_GZIP);
  });

  it("no scroll listener outside scroll-direction.ts and no motion library in src/", () => {
    expect(scanMotionSources(SRC)).toEqual([]);
  });

  it("a planted scroll listener or motion library import is reported", () => {
    const dir = mkdtempSync(join(tmpdir(), "f2-motion-"));
    try {
      mkdirSync(join(dir, "shared", "motion"), { recursive: true });
      writeFileSync(join(dir, "a.ts"), 'window.addEventListener("scroll", () => {});');
      writeFileSync(join(dir, "b.ts"), 'import { gsap } from "gsap";');
      writeFileSync(join(dir, "shared", "motion", "scroll-direction.ts"), 'window.addEventListener("scroll", f, { passive: true });');
      expect(scanMotionSources(dir).map((f) => f.file).sort()).toEqual(["a.ts", "b.ts"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
