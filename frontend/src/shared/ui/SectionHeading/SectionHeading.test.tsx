import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { SectionHeading } from "./SectionHeading";

describe("UI-T-019 SectionHeading", () => {
  it("level 1 renders an h1 whose accessible name is only the text (tape not announced)", () => {
    renderWithRouter(<SectionHeading level={1}>Work</SectionHeading>);
    const heading = screen.getByRole("heading", { level: 1, name: "Work" });
    expect(heading.className).toContain("taped");
    expect(heading.className).toContain("h1");
    // The tape is a CSS pseudo-element: no extra DOM nodes, nothing aria-visible.
    expect(heading.querySelectorAll("*")).toHaveLength(1);
  });

  it("level 2 with eyebrow and action renders the action link", () => {
    renderWithRouter(
      <SectionHeading level={2} eyebrow="Selected" action={<a href="/work">View all work</a>}>
        Featured work
      </SectionHeading>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Featured work" })).toBeInTheDocument();
    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all work" })).toHaveAttribute("href", "/work");
  });

  it("tape can be switched off", () => {
    renderWithRouter(
      <SectionHeading level={3} size="h3" tape={false}>
        Plain
      </SectionHeading>,
    );
    expect(screen.getByRole("heading", { level: 3 }).className).not.toContain("taped");
  });
});
