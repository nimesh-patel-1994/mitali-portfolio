import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

describe("UI-T-056 About values and staircase", () => {
  it("values in order; steps in an <ol> in DOM order 1-4 with staircase classes", async () => {
    await renderRoute("/about");
    const values = screen.getByRole("region", { name: "What I value" });
    expect(values).toHaveAttribute("data-surface", "cream");
    expect(within(values).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(
      fx.values.map((v) => v.title),
    );
    expect(within(values).getByText(fx.values[0]!.body)).toBeInTheDocument();

    const process = screen.getByRole("region", { name: "How we'll work" });
    expect(process).toHaveAttribute("data-surface", "dark");
    const list = within(process).getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(list).toHaveClass("staircase");
    const steps = within(list).getAllByRole("listitem");
    expect(steps.map((s) => within(s).getByRole("heading", { level: 3 }).textContent)).toEqual(
      fx.processSteps.map((s) => s.title),
    );
    for (const step of steps) expect(step).toHaveClass("step");
  });

  it("values and steps sections are hidden when empty", async () => {
    await renderRoute(
      "/about",
      createFixtureSource({ about: () => ({ values: [], process_steps: [], faq_preview: [] }) }),
    );
    expect(screen.queryByRole("region", { name: "What I value" })).toBeNull();
    expect(screen.queryByRole("region", { name: "How we'll work" })).toBeNull();
  });
});

describe("UI-T-057 About page structure", () => {
  it("one h1, origin statement, 2 vision blocks, StoryBlock, FaqPreview and CtaBand", async () => {
    await renderRoute("/about");
    const main = screen.getByRole("main");
    const h1s = within(main).getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    const hero = h1s[0]!.closest("section")!;
    expect(hero).toHaveAttribute("data-surface", "deepest");
    expect(within(hero).getByRole("link", { name: /Book a call/ })).toBeInTheDocument();
    expect(within(hero).getByRole("link", { name: "View work" })).toHaveAttribute("href", "/work");

    const origin = screen.getByRole("region", { name: "Where it starts" });
    expect(within(origin).getByText(fx.site.profile.origin_statement)).toBeInTheDocument();

    const vision = screen.getByRole("region", { name: "What I believe" });
    expect(within(vision).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(
      fx.site.profile.vision_blocks.map((b) => b.heading),
    );

    expect(screen.getByRole("region", { name: "The person behind the words" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Good questions" })).toBeInTheDocument();
    const cta = screen.getByRole("region", { name: /Got something to say/ });
    expect(cta).toHaveAttribute("data-surface", "dark");

    const order = Array.from(main.querySelectorAll(":scope > section")).map((s) => s.getAttribute("data-surface"));
    expect(order).toEqual(["deepest", "cream", "dark", "cream", "dark", "cream", "cream", "dark"]);
  });
});
