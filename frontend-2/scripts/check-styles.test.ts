// @vitest-environment node
/** UI-T-128 (token-only style check) and UI-T-134 (CSS motion check); UI-REV-027, UI-REV-030. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkMotionRule,
  checkPaletteRule,
  checkPrintRule,
  checkStyles,
  checkThemeColor,
  checkTokenRule,
  transitionedProperties,
} from "./check-styles";

const SRC = join(process.cwd(), "src");

describe("UI-T-128 check-styles token rule", () => {
  it("the real stylesheets are clean (exit 0)", () => {
    expect(checkStyles(SRC)).toEqual([]);
    expect(
      checkThemeColor(readFileSync(join(process.cwd(), "index.html"), "utf8"), readFileSync(join(SRC, "styles/palette.css"), "utf8")),
    ).toEqual([]);
  });

  it("reports each planted value with file and line", () => {
    const css = [
      ".a {",
      "  color: #70FF00;",
      "  font-family: Arial;",
      "  padding: 12px;",
      "  background: var(--p-cream);",
      "  margin: 1.5rem;",
      "  gap: 0.5em;",
      "  transition-duration: 300ms;",
      "}",
      "@media (min-width: 768px) { .a { color: var(--on-surface); } }",
    ].join("\n");
    const found = [...checkTokenRule("x.module.css", css), ...checkPaletteRule("x.module.css", css)];
    const byRule = (rule: string) => found.filter((v) => v.rule === rule);
    expect(byRule("colour")).toEqual([expect.objectContaining({ file: "x.module.css", line: 2 })]);
    expect(byRule("font-family")).toEqual([expect.objectContaining({ line: 3 })]);
    expect(byRule("length").map((v) => v.line)).toEqual([4, 6, 7]);
    expect(byRule("palette")).toEqual([expect.objectContaining({ line: 5 })]);
    expect(byRule("duration")).toEqual([expect.objectContaining({ line: 8 })]);
    expect(byRule("media")).toEqual([expect.objectContaining({ line: 10 })]);
  });

  it("allows tokens, 0, percentages, unitless numbers and the custom media", () => {
    const css = ".a { padding: 0; width: 100%; line-height: var(--leading-body); color: currentcolor; transform: scaleX(0.7); }\n@media (--bp-md) { .a { gap: var(--space-4); } }";
    expect(checkTokenRule("ok.module.css", css)).toEqual([]);
  });

  it("--p-* may only be defined in palette.css and read in semantic.css (and the dev-only base override)", () => {
    expect(checkPaletteRule("styles/semantic.css", ":root { --brand-accent: var(--p-green); }")).toEqual([]);
    expect(checkPaletteRule("dev/review-base.css", "html { --surface-base: var(--p-white); }")).toEqual([]);
    expect(checkPaletteRule("styles/surfaces.css", ":root { --x: var(--p-green); }")).toHaveLength(1);
    expect(checkPaletteRule("styles/semantic.css", ":root { --p-new: #000; }")).toHaveLength(1);
  });
});

describe("UI-T-134 CSS motion check", () => {
  it("every transition/animation must sit inside prefers-reduced-motion: no-preference", () => {
    const bad = ".a { transition: transform var(--motion-dur-base); }";
    const good = "@media (prefers-reduced-motion: no-preference) { .a { transition: transform var(--motion-dur-base); } }";
    expect(checkMotionRule("a.css", bad).map((v) => v.rule)).toEqual(["motion"]);
    expect(checkMotionRule("a.css", good)).toEqual([]);
    expect(checkMotionRule("a.css", "@media (prefers-reduced-motion: reduce) { .a { animation: none; } }")).toEqual([]);
  });

  it("only transform and opacity animate (hover colour changes are the listed exceptions)", () => {
    const wrap = (body: string) => `@media (prefers-reduced-motion: no-preference) { .a { ${body} } }`;
    expect(checkMotionRule("a.css", wrap("transition: height var(--motion-dur-base);"))[0]?.rule).toBe("motion-property");
    expect(checkMotionRule("a.css", wrap("transition: all var(--motion-dur-base);"))[0]?.rule).toBe("motion-property");
    expect(checkMotionRule("a.css", wrap("transition: text-decoration-color var(--motion-dur-base), opacity var(--motion-dur-fast);"))).toEqual([]);
    expect(checkMotionRule("a.css", "@keyframes k { from { width: 0; } }")[0]?.rule).toBe("motion-property");
    expect(checkMotionRule("a.css", "@keyframes k { from { transform: none; opacity: 0; } }")).toEqual([]);
    expect(transitionedProperties({ prop: "transition", value: "opacity 1s cubic-bezier(0, 0, 1, 1) 2s, transform 1s" })).toEqual([
      "opacity",
      "transform",
    ]);
  });

  it("scroll timelines must be inside @supports (animation-timeline: …)", () => {
    const outside = "@media (prefers-reduced-motion: no-preference) { .a { animation-timeline: view(); } }";
    const inside = `@supports (animation-timeline: view()) { ${outside} }`;
    expect(checkMotionRule("a.css", outside).map((v) => v.rule)).toContain("scroll-timeline");
    expect(checkMotionRule("a.css", inside)).toEqual([]);
  });

  it("motion.css keeps the print override that shows every reveal block", () => {
    expect(checkPrintRule("styles/motion.css", readFileSync(join(SRC, "styles/motion.css"), "utf8"))).toEqual([]);
    expect(checkPrintRule("styles/motion.css", ".a { opacity: 1; }")).toHaveLength(1);
  });

  it("the hidden reveal state exists only under html[data-motion=on] inside no-preference (UI-REV-028)", () => {
    const css = readFileSync(join(SRC, "styles/motion.css"), "utf8");
    const hiddenRules = css.match(/[^{}]*\{\s*opacity:\s*0;/g) ?? [];
    expect(hiddenRules.length).toBeGreaterThan(0);
    for (const rule of hiddenRules) expect(rule).toContain('html[data-motion="on"]');
    expect(css.indexOf("@media (prefers-reduced-motion: no-preference)")).toBeLessThan(css.indexOf("opacity: 0"));
  });
});
