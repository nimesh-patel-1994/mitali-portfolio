import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { Wordmark } from "./Wordmark";

describe("UI-T-016 Wordmark", () => {
  it("renders MITALI as a home link named 'Mitali, home' on dark", () => {
    renderWithRouter(<Wordmark to="/" tone="onDark" />);
    const link = screen.getByRole("link", { name: "Mitali, home" });
    expect(link).toHaveTextContent("MITALI");
    expect(link).toHaveAttribute("href", "/");
    expect(link.className).toContain("onDark");
  });

  it("uses the light-surface class on cream", () => {
    renderWithRouter(<Wordmark to="/" tone="onLight" size="footer" />);
    const link = screen.getByRole("link", { name: "Mitali, home" });
    expect(link.className).toContain("onLight");
    expect(link.className).toContain("footer");
  });

  it("renders as a named image when not a link", () => {
    renderWithRouter(<Wordmark size="admin" />);
    expect(screen.getByRole("img", { name: "Mitali" })).toHaveTextContent("MITALI");
  });
});
