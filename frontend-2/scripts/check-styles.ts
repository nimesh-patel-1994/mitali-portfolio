/**
 * Style checks for frontend-2 (TS-021 step 2, TS-022 step 5; UI-T-128, UI-T-134; UI-REV-027, UI-REV-030).
 *
 * 1. Token rule — every stylesheet under src/ except the token files (styles/palette.css, semantic.css,
 *    surfaces.css, media.css, fonts.css) and the import-only index.css: no hex/rgb/hsl/named colours, no
 *    font-family names, no px/rem/em length literals (other than 0), no duration literals (ms/s), no raw
 *    `@media (min-width…)` (use the custom media), and no reads of the raw palette (`--p-*`).
 * 2. Palette rule — `--p-*` is defined only in palette.css and read only in semantic.css (plus the dev-only P1
 *    white-base override src/dev/review-base.css, which never reaches a build).
 * 3. Motion rule — every `transition*` / `animation*` declaration (other than `none`) sits inside
 *    `@media (prefers-reduced-motion: no-preference)`; transitions and keyframes animate only `transform` and
 *    `opacity` (hover colour/underline-colour changes are the listed exceptions); `transition: all` is forbidden;
 *    scroll timelines (`animation-timeline`) sit inside `@supports (animation-timeline: …)`.
 * 4. motion.css keeps the `@media print` override that shows every reveal block.
 * 5. index.html: the `theme-color` meta (the one literal colour outside the token files) equals `--p-cream`.
 *
 * Usage: `tsx scripts/check-styles.ts` (exit code 1 on any violation). Part of `npm run lint`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postcss, { type AtRule, type ChildNode, type Container, type Declaration } from "postcss";

export type Rule =
  | "colour"
  | "font-family"
  | "length"
  | "duration"
  | "media"
  | "palette"
  | "motion"
  | "motion-property"
  | "scroll-timeline"
  | "print"
  | "theme-color";

export interface Violation {
  file: string;
  line: number;
  rule: Rule;
  message: string;
}

const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX_COLOUR = /#[0-9a-f]{3,8}\b/i;
const NAMED_COLOUR =
  /(?:^|[\s,(])(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|lime|navy|teal|olive|maroon|aqua|fuchsia|magenta|cyan)(?=$|[\s,)])/i;
const LENGTH_LITERAL = /(?<![\w.-])(?!0(?:px|rem|em)\b)\d*\.?\d+(?:px|rem|em)\b/i;
const DURATION_LITERAL = /(?<![\w.-])\d*\.?\d+m?s\b/i;
const RAW_MEDIA = /\b(?:min|max)-(?:width|height)\b|\bwidth\s*[<>]=?|\d+(?:px|em|rem)\b/i;
const ALLOWED_FONT_FAMILY = /^(?:var\(--font-[a-z-]+\)|inherit|initial|unset)$/i;
const PALETTE_READ = /var\(\s*--p-/;

/** Token files: the only places allowed to hold literal design values (styles/ folder). */
export const TOKEN_FILES = new Set([
  "styles/palette.css",
  "styles/semantic.css",
  "styles/surfaces.css",
  "styles/media.css",
  "styles/fonts.css",
]);
/** Files allowed to read `--p-*`. review-base.css is the dev-only P1 white-base override (never in a build). */
export const PALETTE_READERS = new Set(["styles/semantic.css", "dev/review-base.css"]);

/** Properties a transition or keyframe may change. Colour changes are hover/state exceptions (REQ-NFR-009). */
const MOTION_PROPERTIES = new Set(["transform", "opacity"]);
const COLOUR_EXCEPTIONS = new Set([
  "color",
  "background-color",
  "border-color",
  "text-decoration-color",
  "outline-color",
]);

function lineOf(node: ChildNode): number {
  return node.source?.start?.line ?? 0;
}

function ancestors(node: ChildNode): AtRule[] {
  const out: AtRule[] = [];
  let parent = node.parent as Container | undefined;
  while (parent && parent.type !== "root") {
    if (parent.type === "atrule") out.push(parent as AtRule);
    parent = parent.parent as Container | undefined;
  }
  return out;
}

function insideNoPreference(node: ChildNode): boolean {
  return ancestors(node).some((at) => at.name === "media" && /prefers-reduced-motion\s*:\s*no-preference/i.test(at.params));
}

function insideKeyframesOrFontFace(node: ChildNode): boolean {
  return ancestors(node).some((at) => /keyframes$|^font-face$/i.test(at.name));
}

function insideScrollTimelineSupports(node: ChildNode): boolean {
  return ancestors(node).some((at) => at.name === "supports" && /animation-timeline/i.test(at.params));
}

/** Splits a comma list at top level (ignores commas inside parentheses). */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}

/** Properties named by a `transition` / `transition-property` declaration. */
export function transitionedProperties(decl: Pick<Declaration, "prop" | "value">): string[] {
  const prop = decl.prop.toLowerCase();
  if (prop === "transition-property") return splitTopLevel(decl.value).map((p) => p.toLowerCase());
  if (prop !== "transition") return [];
  return splitTopLevel(decl.value).map((part) => (part.split(/\s+/)[0] ?? "").toLowerCase());
}

/** Token rule + palette reads for one non-token stylesheet. */
export function checkTokenRule(file: string, css: string): Violation[] {
  const violations: Violation[] = [];
  const root = postcss.parse(css, { from: file });

  root.walkAtRules("media", (at) => {
    if (RAW_MEDIA.test(at.params)) {
      violations.push({ file, line: lineOf(at), rule: "media", message: `raw media query "@media ${at.params}" (use media.css)` });
    }
  });

  root.walkDecls((decl: Declaration) => {
    const value = decl.value;
    const where = { file, line: lineOf(decl) };
    if (HEX_COLOUR.test(value) || COLOUR_FUNCTION.test(value) || NAMED_COLOUR.test(value)) {
      violations.push({ ...where, rule: "colour", message: `literal colour in "${decl.prop}: ${value}"` });
    }
    const prop = decl.prop.toLowerCase();
    if (prop === "font-family" && !ALLOWED_FONT_FAMILY.test(value.trim())) {
      violations.push({ ...where, rule: "font-family", message: `font-family literal "${value}"` });
    }
    if (prop === "font" && !/^(?:inherit|initial|unset)$/i.test(value.trim())) {
      violations.push({ ...where, rule: "font-family", message: `font shorthand "${value}" (use the tokens)` });
    }
    if (!insideKeyframesOrFontFace(decl) && LENGTH_LITERAL.test(value)) {
      violations.push({ ...where, rule: "length", message: `px/rem/em literal in "${decl.prop}: ${value}"` });
    }
    if (DURATION_LITERAL.test(value)) {
      violations.push({ ...where, rule: "duration", message: `duration literal in "${decl.prop}: ${value}"` });
    }
  });
  return violations;
}

/** `--p-*` may be defined only in palette.css and read only by PALETTE_READERS. */
export function checkPaletteRule(file: string, css: string): Violation[] {
  const violations: Violation[] = [];
  postcss.parse(css, { from: file }).walkDecls((decl) => {
    if (decl.prop.startsWith("--p-") && file !== "styles/palette.css") {
      violations.push({ file, line: lineOf(decl), rule: "palette", message: `raw palette token ${decl.prop} defined outside palette.css` });
    }
    if (PALETTE_READ.test(decl.value) && !PALETTE_READERS.has(file)) {
      violations.push({
        file,
        line: lineOf(decl),
        rule: "palette",
        message: `reads the raw palette in "${decl.prop}: ${decl.value}" (only semantic.css may read --p-*)`,
      });
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
    const where = { file, line: lineOf(decl) };
    if (insideKeyframesOrFontFace(decl)) {
      const inKeyframes = ancestors(decl).some((at) => /keyframes$/i.test(at.name));
      if (inKeyframes && !MOTION_PROPERTIES.has(prop)) {
        violations.push({ ...where, rule: "motion-property", message: `keyframes animate "${prop}" (only transform/opacity)` });
      }
      return;
    }
    if (prop === "animation-timeline" && !insideScrollTimelineSupports(decl)) {
      violations.push({ ...where, rule: "scroll-timeline", message: `"${prop}" outside @supports (animation-timeline: …)` });
    }
    if (!prop.startsWith("animation") && !prop.startsWith("transition")) return;
    if (/^none$/i.test(decl.value.trim())) return;
    if (!insideNoPreference(decl)) {
      violations.push({
        ...where,
        rule: "motion",
        message: `"${decl.prop}: ${decl.value}" outside @media (prefers-reduced-motion: no-preference)`,
      });
    }
    for (const animated of transitionedProperties(decl)) {
      if (!MOTION_PROPERTIES.has(animated) && !COLOUR_EXCEPTIONS.has(animated)) {
        violations.push({ ...where, rule: "motion-property", message: `transition of "${animated}" (only transform/opacity)` });
      }
    }
  });
  return violations;
}

/** motion.css must make every reveal block visible in print. */
export function checkPrintRule(file: string, css: string): Violation[] {
  let ok = false;
  postcss.parse(css, { from: file }).walkAtRules("media", (at) => {
    if (!/^print$/i.test(at.params.trim())) return;
    at.walkRules((rule) => {
      if (!rule.selector.includes("[data-reveal]")) return;
      let opacity = false;
      let transform = false;
      rule.walkDecls((d) => {
        if (d.prop === "opacity" && d.value.startsWith("1")) opacity = true;
        if (d.prop === "transform" && d.value.startsWith("none")) transform = true;
      });
      if (opacity && transform) ok = true;
    });
  });
  return ok ? [] : [{ file, line: 0, rule: "print", message: "missing @media print override for [data-reveal]" }];
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

/** Runs every stylesheet rule over `srcDir`. */
export function checkStyles(srcDir: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of listCssFiles(srcDir)) {
    const css = readFileSync(file, "utf8");
    const rel = relative(srcDir, file).split(sep).join("/");
    if (!TOKEN_FILES.has(rel) && rel !== "styles/index.css" && rel !== "dev/review-base.css") {
      violations.push(...checkTokenRule(rel, css));
    }
    violations.push(...checkPaletteRule(rel, css));
    violations.push(...checkMotionRule(rel, css));
    if (rel === "styles/motion.css") violations.push(...checkPrintRule(rel, css));
  }
  return violations;
}

/** The `theme-color` meta in index.html must equal `--p-cream` (the base surface, DES-051). */
export function checkThemeColor(indexHtml: string, paletteCss: string): Violation[] {
  const meta = /<meta\s+name="theme-color"\s+content="([^"]*)"/i.exec(indexHtml)?.[1];
  let token: string | undefined;
  postcss.parse(paletteCss).walkDecls("--p-cream", (decl) => {
    token = decl.value.trim();
  });
  if (meta !== undefined && token !== undefined && meta.toLowerCase() === token.toLowerCase()) return [];
  return [
    {
      file: "../index.html",
      line: 0,
      rule: "theme-color",
      message: `theme-color "${meta ?? "(missing)"}" must equal --p-cream "${token ?? "(missing)"}"`,
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
      readFileSync(join(srcDir, "styles", "palette.css"), "utf8"),
    ),
  ];
  if (violations.length > 0) {
    for (const v of violations) console.error(`src/${v.file}:${v.line} [${v.rule}] ${v.message}`);
    console.error(`\ncheck-styles: ${violations.length} violation(s)`);
    process.exit(1);
  }
  console.log("check-styles: OK (semantic tokens only, palette read only by semantic.css, motion gated and transform/opacity only)");
}
