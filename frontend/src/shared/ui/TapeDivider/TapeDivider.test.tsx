import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SRC_DIR } from "@/test/paths";
import { TapeDivider } from "./TapeDivider";

describe("UI-T-020 TapeDivider", () => {
  it.each(["left", "right"] as const)("side %s is aria-hidden with the side class", (side) => {
    const { container } = render(<TapeDivider side={side} />);
    const tape = container.firstElementChild;
    expect(tape).toHaveAttribute("aria-hidden", "true");
    expect(tape?.className).toContain(side);
    expect(tape?.textContent).toBe("");
  });
});

describe("UI-T-103 TapeDivider never widens the page", () => {
  it("the block that runs past the screen edge is clipped horizontally by the full-width divider itself", () => {
    const css = readFileSync(resolve(SRC_DIR, "shared/ui/TapeDivider/TapeDivider.module.css"), "utf8");
    const tapeRule = /\.tape\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    // `clip`, not `hidden`: no scroll container, vertical overflow (the rotated block) stays visible.
    expect(tapeRule).toMatch(/overflow-x:\s*clip;/);
    expect(tapeRule).not.toMatch(/overflow(-y)?:\s*(hidden|clip)\b/);
    expect(tapeRule).not.toMatch(/(?:width|margin-inline|padding-inline)\s*:/);
  });
});
