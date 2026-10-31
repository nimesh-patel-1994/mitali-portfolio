/**
 * copy-fonts (TS-021 step 3, SD-113, REQ-NFR-012, SEC-UI-017, UI-T-131).
 *
 * Copies exactly the six Latin-subset WOFF2 files frontend-2 ships from the installed Fontsource packages into
 * `public/fonts/`, and each package's LICENSE into `public/fonts/LICENSES/<family>.txt`. Fails (exit 1) when a
 * package or file is missing, or when a licence file does not identify the SIL Open Font License 1.1. Prints the
 * licence name and the package version of each font (the licence verification of REQ-NFR-012).
 * A file is rewritten only when its content changed; if a font file with different content already exists, the
 * copy gets the package version in its name so cached copies (served `immutable`) are never stale. Because
 * fonts.css and index.html name the files, such a change is reported and the run fails until they are updated.
 *
 * Usage: `tsx scripts/copy-fonts.ts` (runs as `npm run fonts`, also before `dev` and `build`).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface FontPackage {
  /** npm package name. */
  pkg: string;
  /** Licence text file name under public/fonts/LICENSES. */
  family: string;
  /** Latin subset files to ship (names as published by Fontsource). */
  files: string[];
}

export const FONT_PACKAGES: FontPackage[] = [
  { pkg: "@fontsource/inter-tight", family: "inter-tight", files: ["inter-tight-latin-300-normal.woff2"] },
  {
    pkg: "@fontsource/public-sans",
    family: "public-sans",
    files: [
      "public-sans-latin-400-normal.woff2",
      "public-sans-latin-400-italic.woff2",
      "public-sans-latin-600-normal.woff2",
    ],
  },
  {
    pkg: "@fontsource/antonio",
    family: "antonio",
    files: ["antonio-latin-500-normal.woff2", "antonio-latin-700-normal.woff2"],
  },
];

export class FontCopyError extends Error {
  override name = "FontCopyError";
}

/** True when the licence text is the SIL Open Font License, version 1.1. */
export function isOfl11(text: string): boolean {
  const normalised = text.replace(/\s+/g, " ").toUpperCase();
  return normalised.includes("SIL OPEN FONT LICENSE") && /VERSION 1\.1\b/.test(normalised);
}

export interface CopiedFont {
  pkg: string;
  version: string;
  licence: string;
  files: string[];
}

function sameContent(a: string, b: string): boolean {
  return existsSync(b) && readFileSync(a).equals(readFileSync(b));
}

/**
 * Copies the fonts and licences. `nodeModules` and `outDir` are parameters so the test can run it against a
 * planted package with a non-OFL licence.
 */
export function copyFonts(nodeModules: string, outDir: string, packages: FontPackage[] = FONT_PACKAGES): CopiedFont[] {
  const licenceDir = join(outDir, "LICENSES");
  mkdirSync(licenceDir, { recursive: true });
  const copied: CopiedFont[] = [];
  for (const font of packages) {
    const pkgDir = join(nodeModules, ...font.pkg.split("/"));
    const manifestPath = join(pkgDir, "package.json");
    if (!existsSync(manifestPath)) throw new FontCopyError(`${font.pkg} is not installed (run npm ci)`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string; license?: string };
    const version = manifest.version ?? "unknown";

    const licensePath = join(pkgDir, "LICENSE");
    if (!existsSync(licensePath)) throw new FontCopyError(`${font.pkg}: LICENSE file missing`);
    const licenceText = readFileSync(licensePath, "utf8");
    if (!isOfl11(licenceText)) {
      throw new FontCopyError(
        `${font.pkg}@${version}: the LICENSE file is not the SIL Open Font License 1.1 (stop and ask the user, DES-050)`,
      );
    }

    const shipped: string[] = [];
    for (const file of font.files) {
      const source = join(pkgDir, "files", file);
      if (!existsSync(source)) throw new FontCopyError(`${font.pkg}: ${file} not found in the package`);
      const target = join(outDir, file);
      if (existsSync(target) && !sameContent(source, target)) {
        const versioned = file.replace(/\.woff2$/, `-${version}.woff2`);
        copyFileSync(source, join(outDir, versioned));
        throw new FontCopyError(
          `${file} changed in ${font.pkg}@${version}; copied as ${versioned}. Update fonts.css and index.html to the new name.`,
        );
      }
      if (!existsSync(target)) copyFileSync(source, target);
      shipped.push(file);
    }

    const licenceTarget = join(licenceDir, `${font.family}.txt`);
    if (!existsSync(licenceTarget) || readFileSync(licenceTarget, "utf8") !== licenceText) {
      writeFileSync(licenceTarget, licenceText);
    }
    copied.push({ pkg: font.pkg, version, licence: "SIL Open Font License 1.1", files: shipped });
  }
  return copied;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  try {
    const result = copyFonts(join(root, "node_modules"), join(root, "public", "fonts"));
    for (const font of result) {
      console.log(`fonts: ${font.pkg}@${font.version} — ${font.licence} — ${font.files.join(", ")}`);
    }
  } catch (error) {
    console.error(`fonts: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
