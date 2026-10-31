/**
 * Motion budget check (TS-022 step 6, REQ-NFR-009, UI-T-135, UI-REV-030).
 * Bundles `src/shared/motion/index.ts` (reveal engine + header scroll direction) with production settings (Vite
 * library build, minified, nothing external) and fails when its gzip size exceeds 2048 bytes. It also fails when a
 * source file under src/ adds a `scroll` listener anywhere except `shared/motion/scroll-direction.ts` (the single
 * documented exception, SD-118), or when a motion library is imported.
 *
 * Usage: `tsx scripts/check-motion-size.ts` (exit code 1 on failure). Prints raw and gzip bytes.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

export const MOTION_BUDGET_GZIP = 2048;
export const SCROLL_LISTENER_ALLOWED = "shared/motion/scroll-direction.ts";
const MOTION_LIBRARIES = /from\s+["'](?:gsap|motion|framer-motion|lenis|locomotive-scroll|@studio-freight\/lenis|animejs)(?:\/[^"']*)?["']/;
const SCROLL_LISTENER = /addEventListener\(\s*["']scroll["']/;

export interface MotionSize {
  raw: number;
  gzip: number;
}

/** Production bundle of the motion entry, measured in bytes. */
export async function measureMotionBundle(entry: string): Promise<MotionSize> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      lib: { entry, formats: ["es"], fileName: "motion" },
      rollupOptions: { external: [] },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  let code = "";
  for (const out of outputs) {
    if ("output" in out) {
      for (const chunk of out.output) if (chunk.type === "chunk") code += chunk.code;
    }
  }
  if (code === "") throw new Error("motion bundle is empty");
  return { raw: Buffer.byteLength(code), gzip: gzipSync(code, { level: 9 }).length };
}

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

export interface SourceFinding {
  file: string;
  message: string;
}

/** Scroll listeners outside the documented exception and motion-library imports. */
export function scanMotionSources(srcDir: string): SourceFinding[] {
  const findings: SourceFinding[] = [];
  for (const file of listSources(srcDir)) {
    const rel = relative(srcDir, file).split(sep).join("/");
    const text = readFileSync(file, "utf8");
    if (SCROLL_LISTENER.test(text) && rel !== SCROLL_LISTENER_ALLOWED) {
      findings.push({ file: rel, message: 'adds a "scroll" listener (only the header direction listener may, SD-118)' });
    }
    if (MOTION_LIBRARIES.test(text)) findings.push({ file: rel, message: "imports a motion library (SD-114)" });
  }
  return findings;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const srcDir = fileURLToPath(new URL("../src", import.meta.url));
  const size = await measureMotionBundle(join(srcDir, "shared", "motion", "index.ts"));
  const findings = scanMotionSources(srcDir);
  console.log(`check-motion-size: motion modules ${size.raw} B raw, ${size.gzip} B gzip (budget ${MOTION_BUDGET_GZIP} B gzip)`);
  for (const f of findings) console.error(`src/${f.file}: ${f.message}`);
  if (size.gzip > MOTION_BUDGET_GZIP || findings.length > 0) process.exit(1);
}
