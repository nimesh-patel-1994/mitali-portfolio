import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { Chip, FilterChip, StatusChip } from "./Chip";

describe("UI-T-021 Chip, FilterChip, StatusChip", () => {
  it("Chip renders its label", () => {
    renderWithRouter(<Chip>Brand launch</Chip>);
    expect(screen.getByText("Brand launch")).toBeInTheDocument();
  });

  it("active FilterChip has aria-current=true; inactive has none", () => {
    renderWithRouter(
      <>
        <FilterChip to="/writing?format=email" active>
          Email
        </FilterChip>
        <FilterChip to="/writing" active={false}>
          All
        </FilterChip>
      </>,
    );
    const email = screen.getByRole("link", { name: "Email" });
    expect(email).toHaveAttribute("aria-current", "true");
    expect(email).toHaveAttribute("href", "/writing?format=email");
    expect(email.className).toContain("active");
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current");
  });

  it.each([
    ["success", "Published"],
    ["neutral", "Draft"],
    ["warning", "Sample"],
    ["danger", "New"],
  ] as const)("StatusChip %s shows the text label %s (not colour alone)", (tone, label) => {
    renderWithRouter(<StatusChip tone={tone}>{label}</StatusChip>);
    const chip = screen.getByText(label);
    expect(chip.className).toContain(tone);
  });
});
