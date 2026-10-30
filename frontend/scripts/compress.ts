/**
 * Precompressed static files (REQ-NFR-004): writes `<file>.gz` (gzip level 9) and `<file>.br` (Brotli quality 11)
 * next to every text asset in `dist`, using only Node's zlib. The backend serves the variant the browser accepts
 * and falls back to on-the-fly gzip. Run by the pre-render after every HTML file is final (stale variants are
 * removed first, so a variant never disagrees with its source). A variant is kept only when it is smaller.
 */
import { promisify } from "node:util";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { brotliCompress, constants, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

/** Text formats worth compressing (images such as SVG included; woff2/png/jpg/webp are already compressed). */
export const COMPRESSIBLE = /\.(?:js|mjs|css|html|svg|json|xml|txt|webmanifest)$/i;
const VARIANT = /\.(?:gz|br)$/i;
/** Below this size the saving does not pay for the extra file. */
export const MIN_BYTES = 256;

export interface CompressSummary {
  files: number;
  gz: number;
  br: number;
  rawBytes: number;
  gzBytes: number;
  brBytes: number;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

/** Skips build metadata (`.vite/manifest.json` is never served as a page asset). */
function isSkipped(dir: string, file: string): boolean {
  return relative(dir, file).split(sep)[0] === ".vite";
}

export async function compressDir(dir: string, minBytes = MIN_BYTES): Promise<CompressSummary> {
  const summary: CompressSummary = { files: 0, gz: 0, br: 0, rawBytes: 0, gzBytes: 0, brBytes: 0 };
  const all = await listFiles(dir);
  await Promise.all(all.filter((f) => VARIANT.test(f)).map((f) => rm(f, { force: true })));

  for (const file of all) {
    if (VARIANT.test(file) || !COMPRESSIBLE.test(file) || isSkipped(dir, file)) continue;
    const raw = await readFile(file);
    if (raw.byteLength < minBytes) continue;
    summary.files += 1;
    summary.rawBytes += raw.byteLength;

    const gz = await gzipAsync(raw, { level: 9 });
    if (gz.byteLength < raw.byteLength) {
      await writeFile(`${file}.gz`, gz);
      summary.gz += 1;
      summary.gzBytes += gz.byteLength;
    }
    const br = await brotliAsync(raw, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
        [constants.BROTLI_PARAM_SIZE_HINT]: raw.byteLength,
      },
    });
    if (br.byteLength < raw.byteLength) {
      await writeFile(`${file}.br`, br);
      summary.br += 1;
      summary.brBytes += br.byteLength;
    }
  }
  return summary;
}
