import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

describe("UI-T-046 Work page", () => {
  it("6 case-study cards in display order, then the FAQ preview on dark", async () => {
    await renderRoute("/work");
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
    const cards = within(main).getAllByRole("article");
    expect(cards).toHaveLength(6);
    expect(cards.map((c) => within(c).getByRole("link").getAttribute("href"))).toEqual(
      fx.caseStudies.map((cs) => `/work/${cs.slug}`),
    );
    // Card titles are h2 on this page (no skipped levels under the h1).
    expect(within(cards[0]!).getByRole("heading", { level: 2 })).toHaveTextContent(fx.caseStudies[0]!.title);

    const faq = within(main).getByRole("region", { name: "Good questions" });
    expect(faq).toHaveAttribute("data-surface", "dark");
    expect(within(faq).getAllByRole("button")).toHaveLength(fx.faqPreview.length);
  });

  it("empty: message with a Contact link and no grid", async () => {
    await renderRoute("/work", createFixtureSource({ work: () => ({ case_studies: [], faq_preview: [] }) }));
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 2, name: "New case studies are on the way" })).toBeInTheDocument();
    expect(within(main).getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "/contact");
    expect(within(main).queryByRole("article")).toBeNull();
    expect(within(main).queryByRole("region", { name: "Good questions" })).toBeNull();
  });
});
