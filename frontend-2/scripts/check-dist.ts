/**
 * Build-output scan (SEC-UI-014 required proof 1, UI-T-140, UI-T-132, SEC-UI-015/017 early checks for PH-2).
 * Runs after `vite build` (client → dist/) and the SSR build (dist-ssr/) and fails when either contains:
 * - any trace of the dev-only Origin rewrite (helper names, the 5174 dev origins, the proxy event, an Origin header
 *   literal for the backend origin);
 * - any trace of the P1 review aids (white-base switch, review panel, type specimen route, view-transition toggle);
 * and, for the client build only:
 * - an inline executable script or a `style=` / `on*=` attribute in an HTML file;
 * - a font file other than the six Fontsource Latin files, or a missing licence text.
 *
 * Usage: `tsx scripts/check-dist.ts` (part of `npm run build`; exit code 1 on findings).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FONT_PACKAGES } from "./copy-fonts";

export interface DistFinding {
  file: string;
  message: string;
}

/** Strings that only exist in the dev-server Origin rewrite (vite/dev-origin.ts). */
export const DEV_ORIGIN_MARKERS: readonly string[] = [
  "devAdminOrigin",
  "wireDevOriginRewrite",
  "isAdminApiPath",
  "localhost:5174",
  "127.0.0.1:5174",
  "proxyReq",
];
/** An Origin header set to the backend origin (what the rewrite would emit). */
export const ORIGIN_LITERAL = /origin["']?\s*[:,=]\s*["'`]http:\/\/127\.0\.0\.1:8000/i;

/** Strings that only exist in the dev-only P1 review aids (src/dev/). */
export const REVIEW_MARKERS: readonly string[] = [
  "data-base",
  "review-switch",
  "review-base",
  "ReviewPanel",
  "data-review-panel",
  "__review",
  "P1 review",
  "Type specimen",
  "useDevViewTransitions",
  "setViewTransitionsEnabled",
];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const TEXT_FILE = /\.(?:js|mjs|cjs|css|html|json|txt|map|svg|xml)$/i;

/** Marker scan of one text file's content. */
export function scanText(file: string, text: string): DistFinding[] {
  const findings: DistFinding[] = [];
  for (const marker of DEV_ORIGIN_MARKERS) {
    if (text.includes(marker)) findings.push({ file, message: `dev-only Origin rewrite marker "${marker}" (SEC-UI-014)` });
  }
  if (ORIGIN_LITERAL.test(text)) findings.push({ file, message: "Origin literal for http://127.0.0.1:8000 (SEC-UI-014)" });
  for (const marker of REVIEW_MARKERS) {
    if (text.includes(marker)) findings.push({ file, message: `dev-only P1 review marker "${marker}" (UI-T-132)` });
  }
  return findings;
}

/** HTML rules: no inline executable script, no style/on* attributes (CSP, SEC-UI-015). */
export function scanHtml(file: string, html: string): DistFinding[] {
  const findings: DistFinding[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1] ?? "";
    const executable = !/\bsrc=/.test(attrs) && !/type="application\/(?:ld\+)?json"/.test(attrs);
    if (executable) findings.push({ file, message: "inline executable <script> (CSP script-src 'self')" });
  }
  if (/\sstyle=/i.test(html)) findings.push({ file, message: "style= attribute (CSP style-src 'self')" });
  if (/\son[a-z]+=/i.test(html)) findings.push({ file, message: "inline event handler attribute" });
  return findings;
}

/** Fonts: exactly the shipped Fontsource Latin files, each package with its licence text. */
export function scanFonts(distDir: string): DistFinding[] {
  const fontsDir = join(distDir, "fonts");
  if (!existsSync(fontsDir)) return [{ file: "fonts", message: "dist/fonts missing" }];
  const expected = new Set(FONT_PACKAGES.flatMap((p) => p.files));
  const findings: DistFinding[] = [];
  const shipped = readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"));
  for (const file of shipped) if (!expected.has(file)) findings.push({ file: `fonts/${file}`, message: "unexpected font file" });
  for (const file of expected) if (!shipped.includes(file)) findings.push({ file: `fonts/${file}`, message: "font file missing" });
  for (const pkg of FONT_PACKAGES) {
    if (!existsSync(join(fontsDir, "LICENSES", `${pkg.family}.txt`))) {
      findings.push({ file: `fonts/LICENSES/${pkg.family}.txt`, message: "licence text missing (REQ-NFR-012)" });
    }
  }
  return findings;
}

export function scanDir(dir: string, root: string, client: boolean): DistFinding[] {
  const findings: DistFinding[] = [];
  for (const file of listFiles(dir)) {
    if (!TEXT_FILE.test(file) || statSync(file).size > 20_000_000) continue;
    const rel = relative(root, file).split(sep).join("/");
    if (rel.startsWith("dist/fonts/LICENSES/")) continue;
    const text = readFileSync(file, "utf8");
    findings.push(...scanText(rel, text));
    if (client && file.endsWith(".html")) findings.push(...scanHtml(rel, text));
  }
  return findings;
}

export function checkDist(appDir: string): DistFinding[] {
  const dist = join(appDir, "dist");
  const ssr = join(appDir, "dist-ssr");
  const findings: DistFinding[] = [];
  if (!existsSync(dist)) findings.push({ file: "dist", message: "missing (run vite build first)" });
  else findings.push(...scanDir(dist, appDir, true), ...scanFonts(dist));
  if (!existsSync(ssr)) findings.push({ file: "dist-ssr", message: "missing (run the SSR build first)" });
  else findings.push(...scanDir(ssr, appDir, false));
  return findings;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const appDir = fileURLToPath(new URL("..", import.meta.url));
  const findings = checkDist(appDir);
  if (findings.length > 0) {
    for (const f of findings) console.error(`${f.file}: ${f.message}`);
    console.error(`\ncheck-dist: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log("check-dist: OK (no dev-only Origin rewrite, no P1 review aids, CSP-safe HTML, fonts + licences)");
}
