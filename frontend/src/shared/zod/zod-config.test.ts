// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../..", import.meta.url));

describe("SEC-010 Zod runs jitless (no eval probe under the CSP)", () => {
  it("the public contact schema module leaves Zod jitless and the eval probe unused", async () => {
    const { validateEnquiry, initialValues } = await import("@/features/public/contact/enquiry-schema");
    const { z } = await import("./mini");
    expect(z.config().jitless).toBe(true);
    // The probe result is cached on first use; under jitless it returns false without calling `new Function`.
    expect(validateEnquiry(initialValues).ok).toBe(false);
    expect(z.util.allowsEval.value).toBe(false);
  });

  it("the admin schemas leave Zod jitless", async () => {
    const { z } = await import("./classic");
    const schemas = await import("@/features/admin/ui/schema");
    expect(Object.keys(schemas).length).toBeGreaterThan(0);
    expect(z.config().jitless).toBe(true);
    expect(z.object({ a: z.string() }).safeParse({ a: "x" }).success).toBe(true);
    expect(z.util.allowsEval.value).toBe(false);
  });

  it("no app module imports Zod except through the jitless wrappers", async () => {
    const entries = await readdir(srcDir, { recursive: true, withFileTypes: true });
    const offenders: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      const file = join(entry.parentPath, entry.name);
      const rel = relative(srcDir, file).split(sep).join("/");
      if (rel === "shared/zod/classic.ts" || rel === "shared/zod/mini.ts") continue;
      const text = await readFile(file, "utf8");
      if (/from\s+["']zod(?:\/[^"']*)?["']/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
