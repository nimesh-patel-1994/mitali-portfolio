import { render } from "@testing-library/react";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { checkMotionRule, checkStyles, checkThemeColor, checkTokenRule } from "../../scripts/check-styles";
import { Section } from "@/shared/ui/Section/Section";
import { readRepoFile, SRC_DIR } from "@/test/paths";

const srcDir = SRC_DIR;
const read = (rel: string) => readRepoFile("frontend", "src", "styles", rel.replace("./", ""));
const designBrief = readRepoFile("docs", "design-brief.md");

function rootDeclarations(css: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  postcss.parse(css).walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    out.set(decl.prop, [...(out.get(decl.prop) ?? []), decl.value.trim().toLowerCase()]);
  });
  return out;
}

describe("UI-T-001 tokens.css matches the design brief", () => {
  const tokens = rootDeclarations(read("./tokens.css"));
  const ALIASES = new Set(["--surface", "--on-surface", "--on-surface-muted", "--accent-on-surface", "--border"]);

  it("defines every token named in the design brief exactly once", () => {
    const named = new Set(
      [...designBrief.matchAll(/`(--[a-z][a-z0-9-]*)`/g)]
        .map((m) => m[1] ?? "")
        .filter((name) => !ALIASES.has(name) && !name.endsWith("-") && name !== "--space-1"),
    );
    // Ranged names in the brief ("--space-1…11", "primary-50 … primary-900", "neutral-50 … neutral-900").
    for (let i = 1; i <= 11; i += 1) named.add(`--space-${i}`);
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      named.add(`--color-primary-${step}`);
      named.add(`--color-neutral-${step}`);
    }
    expect(named.size).toBeGreaterThan(40);
    for (const name of named) {
      expect(tokens.get(name), `${name} defined once`).toHaveLength(1);
    }
    for (const [name, values] of tokens) expect(values, `${name} not duplicated`).toHaveLength(1);
  });

  it.each([
    ["--color-primary", "#70ff00"],
    ["--color-primary-tint", "rgba(112, 255, 0, 0.2)"],
    ["--color-primary-hover", "#a9ff66"],
    ["--color-primary-pressed", "#5acc00"],
    ["--color-primary-text-on-light", "#367a00"],
    ["--color-primary-800", "#367a00"],
    ["--color-on-primary", "#0f1c00"],
    ["--color-bg-deepest", "#030500"],
    ["--color-dark", "#0f1c00"],
    ["--color-cream", "#fffde9"],
    ["--color-text-muted", "#63635a"],
    ["--color-text-muted-on-dark", "#a3a396"],
    ["--color-input-bg-dark", "#2a3220"],
    ["--color-border-on-dark", "#a3a396"],
    ["--color-border-on-light", "#8a8a7e"],
    ["--color-white", "#ffffff"],
    ["--color-success", "#1e6b2e"],
    ["--color-warning", "#8c5a00"],
    ["--color-warning-on-dark", "#ffb74d"],
    ["--color-danger", "#b3261e"],
    ["--color-danger-on-dark", "#ff8a80"],
    ["--font-display", '"antonio", "oswald", "arial narrow", sans-serif'],
    ["--font-body", '"public sans", system-ui, -apple-system, "segoe ui", sans-serif'],
    ["--text-hero", "clamp(56px, 9.5vw, 136px)"],
    ["--text-h1", "clamp(36px, 4vw, 48px)"],
    ["--text-h2", "clamp(32px, 4vw, 48px)"],
    ["--text-h3", "clamp(24px, 2.6vw, 36px)"],
    ["--text-statement", "clamp(20px, 2vw, 26px)"],
    ["--text-lead", "18px"],
    ["--text-body", "16px"],
    ["--text-small", "14px"],
    ["--text-footer-mark", "clamp(96px, 18vw, 300px)"],
    ["--measure", "68ch"],
    ["--space-5", "24px"],
    ["--space-11", "160px"],
    ["--section-pad", "clamp(64px, 10vw, 160px)"],
    ["--radius-0", "0"],
    ["--radius-1", "6px"],
    ["--radius-full", "9999px"],
    ["--container-max", "1100px"],
    ["--container-wide", "1320px"],
    ["--tape-rotate", "-4deg"],
    ["--ease-out", "cubic-bezier(0.2, 0.8, 0.2, 1)"],
    ["--header-h", "80px"],
    ["--header-h-compact", "64px"],
    ["--dur-fast", "150ms"],
    ["--dur-base", "200ms"],
    ["--dur-fade", "250ms"],
    ["--dur-reveal", "300ms"],
    ["--glow-loop", "20s"],
  ])("%s has the documented value", (name, value) => {
    expect(tokens.get(name)).toEqual([value]);
  });
});

describe("UI-T-002 style check script", () => {
  it("passes on the source tree (tokens only, custom media only)", () => {
    expect(checkStyles(srcDir).filter((v) => v.rule !== "motion")).toEqual([]);
  });

  it("flags literal colours, font families, px/rem spacing and raw media queries", () => {
    const css = `
      .a { color: #fff; background: rgb(0 0 0); border-color: white; }
      .b { font-family: Arial; margin: 12px; padding: 1rem; gap: 0; }
      @media (min-width: 810px) { .c { width: 100%; } }
    `;
    const rules = checkTokenRule("x.module.css", css).map((v) => v.rule);
    expect(rules.filter((r) => r === "colour")).toHaveLength(3);
    expect(rules).toContain("font-family");
    expect(rules.filter((r) => r === "spacing")).toHaveLength(2);
    expect(rules).toContain("media");
  });

  it("accepts tokens, zero and custom media", () => {
    const css = `.a { color: var(--on-surface); margin: 0; padding: var(--space-4); }
      @media (--bp-tablet) { .a { gap: calc(2 * var(--space-2)); } }`;
    expect(checkTokenRule("x.module.css", css)).toEqual([]);
  });
});

describe("UI-T-002 / UI-REV-001 index.html theme-color traces to --color-bg-deepest (DES-011)", () => {
  it("the theme-color meta equals the token, and a drift is reported", () => {
    const html = readRepoFile("frontend", "index.html");
    const tokensCss = readRepoFile("frontend", "src", "styles", "tokens.css");
    expect(html).toMatch(/<!-- theme-color = --color-bg-deepest/);
    expect(checkThemeColor(html, tokensCss)).toEqual([]);
    const drifted = html.replace(/content="#[0-9a-fA-F]+"/, 'content="#123456"');
    expect(checkThemeColor(drifted, tokensCss).map((v) => v.rule)).toEqual(["theme-color"]);
  });
});

describe("UI-T-003 Section and surface aliases", () => {
  it.each(["deepest", "dark", "cream", "white"] as const)("renders data-surface=%s", (surface) => {
    const { container } = render(<Section surface={surface}>content</Section>);
    expect(container.querySelector("section")).toHaveAttribute("data-surface", surface);
  });

  it("maps cream accent to primary-text-on-light and dark accent to primary (DES-013)", () => {
    const aliases = new Map<string, Map<string, string>>();
    postcss.parse(read("./global.css")).walkRules((rule) => {
      const values = new Map<string, string>();
      rule.walkDecls((d) => {
        values.set(d.prop, d.value);
      });
      for (const selector of rule.selectors) aliases.set(selector, new Map([...(aliases.get(selector) ?? []), ...values]));
    });
    const cream = aliases.get('[data-surface="cream"]');
    const dark = aliases.get('[data-surface="dark"]');
    expect(cream?.get("--accent-on-surface")).toBe("var(--color-primary-text-on-light)");
    expect(cream?.get("--on-surface-muted")).toBe("var(--color-text-muted)");
    expect(cream?.get("--focus-color")).toBe("var(--color-dark)");
    expect(dark?.get("--accent-on-surface")).toBe("var(--color-primary)");
    expect(dark?.get("--on-surface-muted")).toBe("var(--color-text-muted-on-dark)");
    expect(dark?.get("--focus-color")).toBe("var(--color-primary)");
    // Green never used as a text alias on cream/white.
    for (const selector of ['[data-surface="cream"]', '[data-surface="white"]']) {
      for (const [prop, value] of aliases.get(selector) ?? []) {
        if (["--on-surface", "--accent-on-surface", "--heading-on-surface", "--link-on-surface"].includes(prop)) {
          expect(value).not.toBe("var(--color-primary)");
        }
      }
    }
  });
});

describe("UI-T-015 motion check", () => {
  it("every animation/transition in src is inside prefers-reduced-motion: no-preference", () => {
    expect(checkStyles(srcDir).filter((v) => v.rule === "motion")).toEqual([]);
  });

  it("flags motion outside the media query and allows `none`", () => {
    const css = `.a { transition: color 1s; } .b { animation: none; }
      @media (prefers-reduced-motion: no-preference) { .c { animation: x 1s; } }`;
    const violations = checkMotionRule("x.css", css);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("transition");
  });
});
