/**
 * Style checks (UI-T-002, UI-T-015; UI-REV-001, UI-REV-009, UI-REV-017).
 *
 * 1. Token rule: component stylesheets (`src/**\/*.module.css`) and the global/motion stylesheets contain no literal
 *    colours, font-family names, px/rem spacing literals (other than 0) or raw width media queries.
 *    tokens.css, fonts.css and media.css are the only places allowed to hold literal values.
 * 2. Motion rule: every `animation*` / `transition*` declaration (other than `none`) in any stylesheet under `src/`
 *    sits inside `@media (prefers-reduced-motion: no-preference)`.
 *
 * 3. index.html: the `theme-color` meta is the one literal colour outside tokens.css (HTML cannot read CSS tokens);
 *    it must equal `--color-bg-deepest` (DES-011).
 *
 * Usage: `tsx scripts/check-styles.ts` (exit code 1 on any violation).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postcss, { type AtRule, type ChildNode, type Container, type Declaration } from "postcss";

export interface Violation {
  file: string;
  line: number;
  rule: "colour" | "font-family" | "spacing" | "media" | "motion" | "theme-color";
  message: string;
}

const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX_COLOUR = /#[0-9a-f]{3,8}\b/i;
const NAMED_COLOUR =
  /(?:^|[\s,(])(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|lime|navy|teal|olive|maroon|aqua|fuchsia)(?=$|[\s,)])/i;
const SPACING_LITERAL = /(?<![\w.-])(?!0(?:px|rem)\b)\d*\.?\d+(?:px|rem)\b/i;
const RAW_MEDIA = /\b(?:min|max)-(?:width|height)\b|\bwidth\s*[<>]=?|\d+(?:px|em|rem)\b/i;
const ALLOWED_FONT_FAMILY = /^(?:var\(--font-[a-z-]+\)|inherit|initial|unset)$/i;

/** Files that are allowed to hold literal design values. */
const TOKEN_SOURCE_FILES = new Set(["tokens.css", "fonts.css", "media.css"]);

function lineOf(node: ChildNode): number {
  return node.source?.start?.line ?? 0;
}

function isInsideNoPreference(node: ChildNode): boolean {
  let parent: Container | undefined = node.parent as Container | undefined;
  while (parent && parent.type !== "root") {
    if (parent.type === "atrule") {
      const at = parent as AtRule;
      if (at.name === "media" && /prefers-reduced-motion\s*:\s*no-preference/i.test(at.params)) return true;
    }
    parent = parent.parent as Container | undefined;
  }
  return false;
}

function isInsideKeyframesOrFontFace(node: ChildNode): boolean {
  let parent: Container | undefined = node.parent as Container | undefined;
  while (parent && parent.type !== "root") {
    if (parent.type === "atrule" && /keyframes$|^font-face$/i.test((parent as AtRule).name)) return true;
    parent = parent.parent as Container | undefined;
  }
  return false;
}

/** Token rule for one component/global stylesheet. */
export function checkTokenRule(file: string, css: string): Violation[] {
  const violations: Violation[] = [];
  const root = postcss.parse(css, { from: file });

  root.walkAtRules("media", (at) => {
    if (RAW_MEDIA.test(at.params)) {
      violations.push({
        file,
        line: lineOf(at),
        rule: "media",
        message: `raw media query "@media ${at.params}" (use the custom media from media.css)`,
      });
    }
  });

  root.walkDecls((decl: Declaration) => {
    const value = decl.value;
    const where = { file, line: lineOf(decl) };
    if (HEX_COLOUR.test(value) || COLOUR_FUNCTION.test(value) || NAMED_COLOUR.test(value)) {
      violations.push({ ...where, rule: "colour", message: `literal colour in "${decl.prop}: ${value}"` });
    }
    if (decl.prop.toLowerCase() === "font-family" && !ALLOWED_FONT_FAMILY.test(value.trim())) {
      violations.push({ ...where, rule: "font-family", message: `font-family literal "${value}"` });
    }
    if (decl.prop.toLowerCase() === "font" && !/^(?:inherit|initial|unset)$/i.test(value.trim())) {
      violations.push({ ...where, rule: "font-family", message: `font shorthand "${value}" (use the tokens)` });
    }
    if (!isInsideKeyframesOrFontFace(decl) && SPACING_LITERAL.test(value)) {
      violations.push({ ...where, rule: "spacing", message: `px/rem literal in "${decl.prop}: ${value}"` });
    }
  });
  return violations;
}

/** Motion rule for any stylesheet. */
export function checkMotionRule(file: string, css: string): Violation[] {
  const violations: Violation[] = [];
  const root = postcss.parse(css, { from: file });
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    if (!prop.startsWith("animation") && !prop.startsWith("transition")) return;
    if (/^none$/i.test(decl.value.trim())) return;
    if (!isInsideNoPreference(decl)) {
      violations.push({
        file,
        line: lineOf(decl),
        rule: "motion",
        message: `"${decl.prop}: ${decl.value}" outside @media (prefers-reduced-motion: no-preference)`,
      });
    }
  });
  return violations;
}

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listCssFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

/** Runs both rules over `srcDir` and returns every violation. */
export function checkStyles(srcDir: string): Violation[] {
  const files = listCssFiles(srcDir);
  const violations: Violation[] = [];
  for (const file of files) {
    const css = readFileSync(file, "utf8");
    const rel = relative(srcDir, file).split(sep).join("/");
    const name = rel.split("/").pop() ?? rel;
    const isComponentOrGlobal =
      name.endsWith(".module.css") || (rel.startsWith("styles/") && !TOKEN_SOURCE_FILES.has(name) && name !== "index.css");
    if (isComponentOrGlobal) violations.push(...checkTokenRule(rel, css));
    violations.push(...checkMotionRule(rel, css));
  }
  return violations;
}

const THEME_COLOR_TOKEN = "--color-bg-deepest";

/** The `theme-color` meta in index.html must equal `--color-bg-deepest` from tokens.css. */
export function checkThemeColor(indexHtml: string, tokensCss: string): Violation[] {
  const meta = /<meta\s+name="theme-color"\s+content="([^"]*)"/i.exec(indexHtml)?.[1];
  let token: string | undefined;
  postcss.parse(tokensCss).walkDecls(THEME_COLOR_TOKEN, (decl) => {
    token = decl.value.trim();
  });
  if (meta !== undefined && token !== undefined && meta.toLowerCase() === token.toLowerCase()) return [];
  return [
    {
      file: "../index.html",
      line: 0,
      rule: "theme-color",
      message: `theme-color "${meta ?? "(missing)"}" must equal ${THEME_COLOR_TOKEN} "${token ?? "(missing)"}" (DES-011)`,
    },
  ];
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const srcDir = fileURLToPath(new URL("../src", import.meta.url));
  const violations = [
    ...checkStyles(srcDir),
    ...checkThemeColor(
      readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8"),
      readFileSync(join(srcDir, "styles", "tokens.css"), "utf8"),
    ),
  ];
  if (violations.length > 0) {
    for (const v of violations) console.error(`src/${v.file}:${v.line} [${v.rule}] ${v.message}`);
    console.error(`\ncheck-styles: ${violations.length} violation(s)`);
    process.exit(1);
  }
  console.log("check-styles: OK (tokens only, breakpoints via custom media, motion gated by reduced-motion)");
}
