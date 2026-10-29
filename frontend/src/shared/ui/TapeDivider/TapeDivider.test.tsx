import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
