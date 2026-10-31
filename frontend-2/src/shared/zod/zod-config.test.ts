// @vitest-environment node
/**
 * SEC-010 via SEC-UI-013 (port of frontend/'s zod-config test): Zod runs jitless (no eval probe under the CSP) and
 * app code imports Zod only through the wrappers. The contact and admin schemas arrive in PH-3.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

describe("SEC-010 Zod runs jitless", () => {
  it("both wrappers set jitless and never use the eval probe", async () => {
    const mini = (await import("./mini")).z;
    expect(mini.config().jitless).toBe(true);
    const classic = (await import("./classic")).z;
    expect(classic.object({ a: classic.string() }).safeParse({ a: "x" }).success).toBe(true);
    expect(classic.util.allowsEval.value).toBe(false);
  });

  it("no app module imports Zod except through the jitless wrappers", () => {
    const offenders: string[] = [];
    for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      const file = join(entry.parentPath, entry.name);
      const rel = relative(SRC, file).split(sep).join("/");
      if (rel === "shared/zod/classic.ts" || rel === "shared/zod/mini.ts" || rel.endsWith(".test.ts")) continue;
      if (/from\s+["']zod(?:\/[^"']*)?["']/.test(readFileSync(file, "utf8"))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
