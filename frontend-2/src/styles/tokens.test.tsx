/** UI-T-129 (token files against DES-060) and UI-T-130 (Section + surfaces.css); UI-REV-032. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Section, SURFACES } from "@/shared/ui/Section/Section";
import { SRC_DIR } from "@/test/paths";

function read(name: string): string {
  return readFileSync(join(SRC_DIR, "styles", name), "utf8");
}

/** Declarations per selector of one stylesheet (top-level rules only, i.e. outside @media). */
function topLevel(css: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  postcss.parse(css).each((node) => {
    if (node.type !== "rule") return;
    const decls = out.get(node.selector) ?? new Map<string, string>();
    node.walkDecls((d) => {
      decls.set(d.prop, d.value);
    });
    out.set(node.selector, decls);
  });
  return out;
}

function allDefinitions(css: string): string[] {
  const props: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    if (d.prop.startsWith("--") && d.parent?.type === "rule" && d.parent.parent?.type === "root") props.push(d.prop);
  });
  return props;
}

const PALETTE: Record<string, string> = {
  "--p-cream": "#FFFDE9",
  "--p-white": "#FFFFFF",
  "--p-ink": "#0F1C00",
  "--p-deep": "#030500",
  "--p-olive": "#0F1C00",
  "--p-muted": "#63635A",
  "--p-muted-on-dark": "#A3A396",
  "--p-green": "#70FF00",
  "--p-green-text": "#367A00",
  "--p-input-border": "#8A8A7E",
  "--p-danger": "#B3261E",
  "--p-danger-on-dark": "#FF8A80",
  "--p-warning": "#8C5A00",
  "--p-warning-on-dark": "#FFB74D",
  "--p-success": "#1E6B2E",
  "--p-neutral-50": "#F5F5F4",
  "--p-neutral-900": "#292B26",
};

const SEMANTIC: Record<string, string> = {
  "--brand-accent": "var(--p-green)",
  "--brand-on-accent": "var(--p-ink)",
  "--brand-accent-text-on-light": "var(--p-green-text)",
  "--surface-base": "var(--p-cream)",
  "--surface-band": "var(--p-white)",
  "--surface-deep": "var(--p-deep)",
  "--surface-deep-alt": "var(--p-olive)",
  "--ink-strong": "var(--p-ink)",
  "--ink-muted": "var(--p-muted)",
  "--ink-inverse": "var(--p-cream)",
  "--ink-inverse-muted": "var(--p-muted-on-dark)",
  "--line-input": "var(--p-input-border)",
  "--status-danger": "var(--p-danger)",
  "--status-warning": "var(--p-warning)",
  "--status-success": "var(--p-success)",
  "--text-display-xl": "clamp(3rem, 1.4rem + 7.6vw, 8.75rem)",
  "--text-display": "clamp(2.5rem, 1.25rem + 5.6vw, 6.25rem)",
  "--text-h2": "clamp(1.875rem, 1.3rem + 2.5vw, 3.125rem)",
  "--text-h3": "clamp(1.375rem, 1.1rem + 0.9vw, 1.875rem)",
  "--text-cta": "clamp(3rem, 0.9rem + 9vw, 10rem)",
  "--text-lead": "clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem)",
  "--text-body": "1rem",
  "--text-small": "0.875rem",
  "--text-label": "0.875rem",
  "--tracking-display": "-0.04em",
  "--tracking-heading": "-0.03em",
  "--measure": "68ch",
  "--space-1": "0.25rem",
  "--space-5": "1.5rem",
  "--space-11": "10rem",
  "--section-gap": "clamp(4rem, 2rem + 6vw, 8rem)",
  "--layout-inset": "16px",
  "--layout-max": "1920px",
  "--header-h": "80px",
  "--header-h-compact": "64px",
  "--radius-sm": "2px",
  "--radius-md": "8px",
  "--radius-lg": "20px",
  "--radius-full": "9999px",
  "--motion-dur-fast": "150ms",
  "--motion-dur-base": "300ms",
  "--motion-dur-slow": "450ms",
  "--motion-dur-backdrop": "500ms",
  "--motion-dur-reveal": "1150ms",
  "--motion-delay-reveal": "150ms",
  "--motion-reveal-distance": "50px",
  "--motion-ease-out": "cubic-bezier(0.215, 0.61, 0.355, 1)",
  "--motion-ease-in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
  "--motion-parallax-shift": "8%",
  "--motion-drift-max": "12%",
  "--motion-vt-dur": "250ms",
  "--focus-width": "2px",
  "--focus-offset": "2px",
};

describe("UI-T-129 token files (DES-060)", () => {
  it("palette.css defines the raw values once each with the documented value", () => {
    const root = topLevel(read("palette.css")).get(":root")!;
    for (const [token, value] of Object.entries(PALETTE)) expect(root.get(token), token).toBe(value);
    const defs = allDefinitions(read("palette.css"));
    expect(new Set(defs).size).toBe(defs.length);
    expect(defs.every((d) => d.startsWith("--p-"))).toBe(true);
    expect([...topLevel(read("palette.css")).get(":root")!.values()].join(" ")).not.toMatch(/D920E5/i);
  });

  it("semantic.css maps every DES-060 role once with the documented value", () => {
    const root = topLevel(read("semantic.css")).get(":root")!;
    for (const [token, value] of Object.entries(SEMANTIC)) expect(root.get(token), token).toBe(value);
    const defs = allDefinitions(read("semantic.css"));
    expect(new Set(defs).size).toBe(defs.length);
  });

  it("type, tracking and layout roles are redefined inside the breakpoints (DES-057)", () => {
    const css = read("semantic.css");
    expect(css).toMatch(/@media \(--bp-md\)\s*\{\s*:root\s*\{[^}]*--tracking-display:\s*-0\.055em/);
    expect(css).toMatch(/@media \(--bp-lg\)\s*\{\s*:root\s*\{[^}]*--tracking-heading:\s*-0\.05em/);
    expect(css).toMatch(/@media \(--bp-xl\)\s*\{\s*:root\s*\{[^}]*--tracking-display:\s*-0\.07em/);
    expect(read("media.css")).toMatch(/--bp-md \(min-width: 768px\)[\s\S]*--bp-lg \(min-width: 1024px\)[\s\S]*--bp-xl \(min-width: 1440px\)/);
  });

  it("--p-* is read only by semantic.css among the token files", () => {
    for (const name of ["surfaces.css", "global.css", "motion.css", "fonts.css"]) {
      expect(read(name), name).not.toMatch(/var\(--p-/);
    }
  });

  it("scroll-padding-top keeps focus targets clear of the header (REQ-085, WCAG 2.4.11)", () => {
    expect(topLevel(read("global.css")).get("html")?.get("scroll-padding-top")).toBe("var(--header-h)");
  });
});

describe("UI-T-130 Section and surfaces.css", () => {
  it.each(SURFACES)("renders data-surface=%s", (surface) => {
    render(
      <Section surface={surface} aria-label={`s-${surface}`}>
        x
      </Section>,
    );
    expect(screen.getByRole("region", { name: `s-${surface}` })).toHaveAttribute("data-surface", surface);
  });

  it("deep surfaces map accent/focus to green; base/band map them to #367A00 / ink; muted per surface", () => {
    const rules = topLevel(read("surfaces.css"));
    const light = rules.get(':root,\n[data-surface="base"],\n[data-surface="band"]')!;
    const deep = rules.get('[data-surface="deep"],\n[data-surface="deep-alt"]')!;
    expect(light.get("--accent-on-surface")).toBe("var(--brand-accent-text-on-light)");
    expect(light.get("--focus-on-surface")).toBe("var(--ink-strong)");
    expect(light.get("--on-surface-muted")).toBe("var(--ink-muted)");
    expect(light.get("--indicator-on-surface")).toBe("var(--ink-strong)");
    expect(deep.get("--accent-on-surface")).toBe("var(--brand-accent)");
    expect(deep.get("--focus-on-surface")).toBe("var(--brand-accent)");
    expect(deep.get("--on-surface-muted")).toBe("var(--ink-inverse-muted)");
    expect(deep.get("--indicator-on-surface")).toBe("var(--brand-accent)");
    expect(rules.get('[data-surface="band"]')?.get("--surface")).toBe("var(--surface-band)");
    expect(rules.get('[data-surface="deep-alt"]')?.get("--surface")).toBe("var(--surface-deep-alt)");
  });

  it("no component stylesheet uses --brand-accent as a text colour on a light surface (DES-051)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".module.css")) {
          postcss.parse(readFileSync(full, "utf8")).walkDecls("color", (d) => {
            if (d.value.includes("--brand-accent") && !d.value.includes("text-on-light")) offenders.push(`${entry.name}: ${d.value}`);
          });
        }
      }
    };
    walk(SRC_DIR);
    // Text in brand green only on fills (--brand-on-accent); green text is never used, on any surface.
    expect(offenders).toEqual([]);
  });
});
