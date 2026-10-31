/**
 * UI-T-144 / UI-111 / REQ-010..015, REQ-006, REQ-082: Home with contract fixtures (MSW for the api content source).
 * One h1; sections in the TS-026 order and surfaces; both hero actions; up to 4 featured units; empty sections hidden.
 */
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CaseStudySummary, Testimonial } from "@/api/types";
import { createApiContentSource } from "@/app/content-source.api";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { API_BASE, publicApiHandlers } from "@/test/handlers";
import { renderRoute, renderWithRouter } from "@/test/render";
import { EngagementModels } from "./EngagementModels";
import { FeaturedWork } from "./FeaturedWork";
import { ServicesSection } from "./ServicesSection";

const server = setupServer(...publicApiHandlers());
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function mainSectionHeadings(): string[] {
  return within(screen.getByRole("main"))
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent ?? "");
}

describe("UI-T-144 Home page", () => {
  it("one h1, both hero actions, sections in the TS-026 order and surfaces (data via the generated client + MSW)", async () => {
    await renderRoute("/", createApiContentSource({ baseUrl: API_BASE }));
    const main = screen.getByRole("main");
    const h1s = within(main).getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Words witha job to do");

    const hero = h1s[0]!.closest("section")!;
    expect(hero).toHaveAttribute("data-surface", "base");
    expect(within(hero).getByRole("link", { name: /Book a call/ })).toHaveAttribute("href", "https://booking.example.com/mitali");
    expect(within(hero).getByRole("link", { name: "View work" })).toHaveAttribute("href", "/work");

    expect(mainSectionHeadings()).toEqual([
      "Selected work",
      "What I do",
      "Ways to work together",
      "The person behind the words",
      "What clients say",
      "Good questions",
    ]);
    const surfaces = Array.from(main.querySelectorAll(":scope > section")).map((s) => s.getAttribute("data-surface"));
    expect(surfaces).toEqual(["base", "base", "deep-alt", "band", "base", "deep", "base"]);
    // Blocks below the hero carry the reveal marker; the hero itself never waits for motion.
    expect(hero.querySelector("[data-reveal]")).toBeNull();
    expect(main.querySelectorAll("[data-reveal]").length).toBeGreaterThan(5);
  });

  it("0 featured and 0 testimonials: those sections are hidden; every data section hides when empty", async () => {
    server.use(
      http.get(`${API_BASE}/api/public/case-studies`, () => HttpResponse.json<CaseStudySummary[]>([])),
      http.get(`${API_BASE}/api/public/testimonials`, () => HttpResponse.json<Testimonial[]>([])),
    );
    await renderRoute("/", createApiContentSource({ baseUrl: API_BASE }));
    expect(mainSectionHeadings()).toEqual(["What I do", "Ways to work together", "The person behind the words", "Good questions"]);

    const empty = createFixtureSource({
      home: () => ({ featured_case_studies: [], services: [], engagement_models: [], testimonials: [], faq_preview: [] }),
    });
    cleanup();
    await renderRoute("/", empty);
    expect(mainSectionHeadings()).toEqual([
      "The person behind the words",
    ]);
  });
});

describe("UI-T-144 Home sections", () => {
  it("featured work: at most 4 units in position order and a View all work link", () => {
    renderWithRouter(<FeaturedWork caseStudies={fx.caseStudies} />);
    const units = screen.getAllByRole("article");
    expect(units.map((u) => within(u).getByRole("heading", { level: 3 }).textContent)).toEqual(
      fx.caseStudies.slice(0, 4).map((c) => c.title),
    );
    expect(screen.getByRole("link", { name: "View all work" })).toHaveAttribute("href", "/work");
  });

  it("services: 5 accordion rows on deep-alt; one expands to description and deliverables", async () => {
    renderWithRouter(<ServicesSection services={fx.services} />);
    const section = screen.getByRole("region", { name: "What I do" });
    expect(section).toHaveAttribute("data-surface", "deep-alt");
    const buttons = within(section).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(fx.services.map((s) => s.name));
    await userEvent.setup().click(buttons[1]!);
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(buttons[1]!.getAttribute("aria-controls")!)!;
    expect(within(panel).getByText(fx.services[1]!.description)).toBeInTheDocument();
    expect(within(within(panel).getByRole("list")).getAllByRole("listitem").map((i) => i.textContent)).toEqual(
      fx.services[1]!.deliverables,
    );
  });

  it("engagement models: 3 units with features; actions follow cta_target with cta_label; no prices", () => {
    renderWithRouter(<EngagementModels models={fx.engagementModels} bookingUrl="https://booking.example.com/mitali" />);
    expect(screen.getByRole("region", { name: "Ways to work together" })).toHaveAttribute("data-surface", "band");
    const units = screen.getAllByRole("article");
    units.forEach((unit, i) => {
      const model = fx.engagementModels[i]!;
      expect(within(unit).getByRole("heading", { level: 3 })).toHaveTextContent(model.name);
      expect(within(unit).getAllByRole("listitem").map((li) => li.textContent)).toEqual(model.features);
      const link = within(unit).getByRole("link", { name: new RegExp(model.cta_label) });
      expect(link).toHaveAttribute("href", model.cta_target === "booking" ? "https://booking.example.com/mitali" : "/contact");
    });
    expect(screen.queryByText(/£|\$|€/)).toBeNull();
  });

  it("engagement models: booking without a valid URL falls back to /contact", () => {
    renderWithRouter(<EngagementModels models={fx.engagementModels} bookingUrl={null} />);
    expect(screen.getByRole("link", { name: "Plan a workshop" })).toHaveAttribute("href", "/contact");
  });
});
