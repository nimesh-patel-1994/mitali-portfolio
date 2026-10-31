// @vitest-environment node
/**
 * UI-T-127 / UI-REV-026 / REQ-080 / SD-111: frontend-2 is self-contained. No import specifier, relative path,
 * alias, config entry or script path resolves into `frontend/`; ESLint reports a planted import.
 * The only file read outside frontend-2 is ../docs/api-contract.yaml (by `generate:api`).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { FRONTEND_PATH_PATTERN } from "../eslint.config.js";

const APP_DIR = process.cwd();
const SCANNED_DIRS = ["src", "scripts", "vite", "e2e"];
const SCANNED_FILES = [
  "vite.config.ts",
  "tsconfig.json",
  "eslint.config.js",
  "postcss.config.js",
  "playwright.config.ts",
  "package.json",
  "index.html",
];
/**
 * Documented exception: SEC-UI-014 proof 3 ("frontend 1 is unaffected") must name frontend/ to check, read-only,
 * that git reports no change there. It imports nothing from it.
 */
const ALLOWED = new Set([
  "e2e/sec-ui-014.e2e.ts",
  // This test plants such strings on purpose to prove the scanner and the ESLint rule catch them.
  "scripts/self-containment.test.ts",
]);

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["'`]([^"'`]+)["'`]/g;
const PATH_LITERAL = /["'`]((?:[^"'`\s]*[\\/])?\.\.[\\/](?:\.\.[\\/])*frontend(?:[\\/][^"'`]*)?)["'`]/g;
const frontendPath = new RegExp(FRONTEND_PATH_PATTERN);

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return /\.(ts|tsx|js|mjs|cjs|json|css|html)$/.test(entry.name) ? [full] : [];
  });
}

export function findFrontendReferences(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(SPECIFIER)) if (m[1] && frontendPath.test(m[1])) found.push(m[1]);
  for (const m of text.matchAll(PATH_LITERAL)) if (m[1]) found.push(m[1]);
  return [...new Set(found)];
}

describe("UI-T-127 self-containment scan", () => {
  it("the scanner itself finds planted references and ignores frontend-2 and prose", () => {
    expect(findFrontendReferences('import x from "../../frontend/src/x";')).toEqual(["../../frontend/src/x"]);
    const backslashPath = `const p = "${["..", "frontend", "dist"].join(String.fromCharCode(92))}";`;
    expect(findFrontendReferences(backslashPath)).toHaveLength(1);
    expect(findFrontendReferences('await import("../frontend/src/app/routes")')).not.toHaveLength(0);
    expect(findFrontendReferences('import x from "../frontend-2/src/x";')).toEqual([]);
    expect(findFrontendReferences("// behaviour ported from frontend/ UI-013")).toEqual([]);
  });

  it("no source, script, config or test path resolves into frontend/", () => {
    const files = [
      ...SCANNED_DIRS.flatMap((d) => listFiles(join(APP_DIR, d))),
      ...SCANNED_FILES.map((f) => join(APP_DIR, f)).filter((f) => existsSync(f)),
    ];
    expect(files.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(APP_DIR, file).split(sep).join("/");
      if (ALLOWED.has(rel)) continue;
      for (const ref of findFrontendReferences(readFileSync(file, "utf8"))) offenders.push(`${rel}: ${ref}`);
    }
    expect(offenders).toEqual([]);
  });

  it("package.json reads only ../docs/api-contract.yaml outside frontend-2", () => {
    const pkg = JSON.parse(readFileSync(join(APP_DIR, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const outside = Object.entries(pkg.scripts).filter(([, cmd]) => cmd.includes(".."));
    expect(outside).toEqual([["generate:api", "openapi-typescript ../docs/api-contract.yaml -o src/api/schema.d.ts"]]);
  });

  it("ESLint reports a planted import from ../frontend (no-restricted-imports)", async () => {
    const eslint = new ESLint({ cwd: APP_DIR });
    const [planted] = await eslint.lintText('import x from "../../frontend/src/x";\nexport default x;\n', {
      filePath: join(APP_DIR, "src", "planted.ts"),
    });
    const messages = planted?.messages.filter((m) => m.ruleId === "no-restricted-imports") ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toMatch(/self-contained/);

    const [clean] = await eslint.lintText('import { cx } from "@/shared/utils/cx";\nexport default cx;\n', {
      filePath: join(APP_DIR, "src", "planted.ts"),
    });
    expect(clean?.messages.filter((m) => m.ruleId === "no-restricted-imports")).toEqual([]);
  });

  it("ESLint forbids src/ from importing the dev-server Origin rewrite (SEC-UI-014)", async () => {
    const eslint = new ESLint({ cwd: APP_DIR });
    const [result] = await eslint.lintText('import { devAdminOrigin } from "../../vite/dev-origin";\nexport default devAdminOrigin;\n', {
      filePath: join(APP_DIR, "src", "app", "planted.ts"),
    });
    expect(result?.messages.some((m) => m.ruleId === "no-restricted-imports" && /SEC-UI-014/.test(m.message))).toBe(true);
  });
});
