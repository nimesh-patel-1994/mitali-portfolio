import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

describe("UI-T-058 FAQs page", () => {
  it("4 h2 groups in order, FAQs in order, all collapsed, two-column accordions", async () => {
    await renderRoute("/faqs");
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "FAQs" })).toBeInTheDocument();
    const groups = fx.faqGroups;
    for (const group of groups) {
      const region = within(main).getByRole("region", { name: group.name });
      const buttons = within(region).getAllByRole("button");
      expect(buttons.map((b) => b.textContent)).toEqual(group.faqs.map((f) => f.question));
      for (const b of buttons) expect(b).toHaveAttribute("aria-expanded", "false");
      expect(within(region).getAllByRole("heading", { level: 3 })).toHaveLength(group.faqs.length);
      if (group.faqs.length > 1) expect(region.querySelector(".twoColumns")).not.toBeNull();
    }
    const h2s = within(main)
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(h2s.slice(0, 4)).toEqual(groups.map((g) => g.name));
    expect(within(main).getAllByRole("button")).toHaveLength(16);
    expect(screen.getByRole("region", { name: /Got something to say/ })).toBeInTheDocument();
  });
});

describe("UI-T-059 FAQs page without groups", () => {
  it("shows the empty message and still the CTA band", async () => {
    await renderRoute("/faqs", createFixtureSource({ faqs: () => ({ groups: [] }) }));
    expect(screen.getByRole("heading", { level: 2, name: "No questions published yet" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryAllByRole("button")).toHaveLength(0);
    const cta = screen.getByRole("region", { name: /Got something to say/ });
    expect(within(cta).getByRole("link", { name: "Send a message" })).toHaveAttribute("href", "/contact");
  });
});
