// @vitest-environment node
/**
 * UI-T-131 / REQ-NFR-012 / SEC-UI-017 / UI-REV-033: copy-fonts copies exactly the six Latin files and the licence
 * texts, every licence is SIL OFL 1.1 (a non-OFL licence fails), every @font-face swaps and points at /fonts/, and
 * only Inter Tight 300 is preloaded.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postcss from "postcss";
import { afterEach, describe, expect, it } from "vitest";
import { copyFonts, FONT_PACKAGES, FontCopyError, isOfl11 } from "./copy-fonts";

const APP = process.cwd();
const NODE_MODULES = join(APP, "node_modules");
const SIX = [
  "inter-tight-latin-300-normal.woff2",
  "public-sans-latin-400-normal.woff2",
  "public-sans-latin-400-italic.woff2",
  "public-sans-latin-600-normal.woff2",
  "antonio-latin-500-normal.woff2",
  "antonio-latin-700-normal.woff2",
];

const temps: string[] = [];
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "f2-fonts-"));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("UI-T-131 copy-fonts", () => {
  it("copies exactly the six Latin files + three licence texts; every licence is SIL OFL 1.1 (version printed)", () => {
    const out = temp();
    const result = copyFonts(NODE_MODULES, out);
    expect(readdirSync(out).filter((f) => f.endsWith(".woff2")).sort()).toEqual([...SIX].sort());
    expect(readdirSync(join(out, "LICENSES")).sort()).toEqual(["antonio.txt", "inter-tight.txt", "public-sans.txt"]);
    for (const font of result) {
      expect(font.licence).toBe("SIL Open Font License 1.1");
      expect(font.version).toBe("5.3.0");
    }
    for (const pkg of FONT_PACKAGES) {
      const manifest = JSON.parse(readFileSync(join(NODE_MODULES, ...pkg.pkg.split("/"), "package.json"), "utf8")) as { license: string };
      expect(manifest.license).toBe("OFL-1.1");
      expect(isOfl11(readFileSync(join(out, "LICENSES", `${pkg.family}.txt`), "utf8"))).toBe(true);
    }
  });

  it("the committed public/fonts matches the packages (six files, licence texts present)", () => {
    const fonts = join(APP, "public", "fonts");
    expect(readdirSync(fonts).filter((f) => f.endsWith(".woff2")).sort()).toEqual([...SIX].sort());
    expect(readdirSync(join(fonts, "LICENSES")).sort()).toEqual(["antonio.txt", "inter-tight.txt", "public-sans.txt"]);
  });

  it("a package whose licence is not OFL 1.1 fails", () => {
    const fakeModules = temp();
    const pkgDir = join(fakeModules, "@fontsource", "antonio");
    mkdirSync(pkgDir, { recursive: true });
    cpSync(join(NODE_MODULES, "@fontsource", "antonio"), pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "LICENSE"), "MIT License\n\nPermission is hereby granted, free of charge…");
    const antonio = FONT_PACKAGES.filter((p) => p.pkg === "@fontsource/antonio");
    expect(() => copyFonts(fakeModules, temp(), antonio)).toThrow(FontCopyError);
    expect(() => copyFonts(fakeModules, temp(), antonio)).toThrow(/not the SIL Open Font License 1\.1/);
  });

  it("a missing package fails with the reason", () => {
    expect(() => copyFonts(temp(), temp())).toThrow(/not installed/);
  });

  it("isOfl11 recognises the licence wording", () => {
    expect(isOfl11("SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007")).toBe(true);
    expect(isOfl11("SIL Open Font License, Version 1.0")).toBe(false);
  });
});

describe("UI-T-131 fonts.css and index.html", () => {
  it("every @font-face swaps, points at /fonts/ and uses one of the six files (no CDN, no data: URL)", () => {
    const css = readFileSync(join(APP, "src", "styles", "fonts.css"), "utf8");
    const faces: Record<string, string>[] = [];
    postcss.parse(css).walkAtRules("font-face", (at) => {
      const face: Record<string, string> = {};
      at.walkDecls((d) => {
        face[d.prop] = d.value;
      });
      faces.push(face);
    });
    expect(faces).toHaveLength(6);
    const urls = faces.map((f) => /url\("([^"]+)"\)/.exec(f.src ?? "")?.[1]);
    expect(urls.sort()).toEqual(SIX.map((f) => `/fonts/${f}`).sort());
    for (const face of faces) {
      expect(face["font-display"]).toBe("swap");
      expect(face["unicode-range"]).toMatch(/^U\+0000-00FF/);
    }
    for (const face of faces) expect(face.src).not.toMatch(/https?:|data:/);
  });

  it("only Inter Tight 300 is preloaded", () => {
    const html = readFileSync(join(APP, "index.html"), "utf8");
    const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
    expect(preloads).toEqual(["/fonts/inter-tight-latin-300-normal.woff2"]);
    expect(html).toMatch(/as="font" type="font\/woff2" crossorigin/);
  });
});
