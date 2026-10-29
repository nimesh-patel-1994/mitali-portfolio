import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CaseStudySummary } from "@/api/types";
import { createApiContentSource } from "@/app/content-source.api";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { API_BASE, publicApiHandlers } from "@/test/handlers";
import { renderRoute, renderWithRouter } from "@/test/render";
import { EngagementModels } from "./EngagementModels";
import { FeaturedWork } from "./FeaturedWork";
import { ServicesSection } from "./ServicesSection";
import { TestimonialsSection } from "./TestimonialsSection";

const server = setupServer(...publicApiHandlers());
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function sectionHeadings(): string[] {
  return screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
}

describe("UI-T-041 Home page", () => {
  it("one h1 (hero), Book a call and View work actions, sections in the specified order", async () => {
    await renderRoute("/");
    const main = screen.getByRole("main");
    const h1s = within(main).getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Words witha job to do");

    const hero = h1s[0]!.closest("section")!;
    expect(hero).toHaveAttribute("data-surface", "deepest");
    expect(within(hero).getByRole("link", { name: /Book a call/ })).toHaveAttribute(
      "href",
      "https://booking.example.com/mitali",
    );
    expect(within(hero).getByRole("link", { name: "View work" })).toHaveAttribute("href", "/work");

    expect(sectionHeadings().slice(0, 6)).toEqual([
      "Selected work",
      "What I do",
      "Ways to work together",
      "The person behind the words",
      "What clients say",
      "Good questions",
    ]);
    const surfaces = Array.from(main.querySelectorAll(":scope > section")).map((s) => s.getAttribute("data-surface"));
    expect(surfaces).toEqual(["deepest", "cream", "dark", "cream", "cream", "dark", "cream"]);
  });

  it("each data section hides itself when empty", async () => {
    const source = createFixtureSource({
      home: () => ({
        featured_case_studies: [],
        services: [],
        engagement_models: [],
        testimonials: [],
        faq_preview: [],
      }),
    });
    await renderRoute("/", source);
    expect(sectionHeadings().filter((h) => !["Explore", "Follow along", "Say hello"].includes(h))).toEqual([
      "The person behind the words",
    ]);
  });
});

describe("UI-T-042 home aggregate + featured work", () => {
  it("API returns 5 featured: 4 cards in position order and a View all link", async () => {
    const featured = fx.caseStudies.filter((cs) => cs.is_featured);
    expect(featured).toHaveLength(5);
    const home = await createApiContentSource({ baseUrl: API_BASE }).get("home");
    expect(home.featured_case_studies.map((c) => c.slug)).toEqual(featured.slice(0, 4).map((c) => c.slug));

    renderWithRouter(<FeaturedWork caseStudies={home.featured_case_studies} />);
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => within(c).getByRole("heading", { level: 3 }).textContent)).toEqual(
      featured.slice(0, 4).map((c) => c.title),
    );
    expect(screen.getByRole("link", { name: "View all work" })).toHaveAttribute("href", "/work");
  });

  it("API returns 0 featured: section hidden", async () => {
    server.use(http.get(`${API_BASE}/api/public/case-studies`, () => HttpResponse.json<CaseStudySummary[]>([])));
    const home = await createApiContentSource({ baseUrl: API_BASE }).get("home");
    expect(home.featured_case_studies).toEqual([]);
    const { container } = renderWithRouter(<FeaturedWork caseStudies={home.featured_case_studies} />);
    expect(container.querySelector("section")).toBeNull();
  });

  it("never shows more than 4 even if handed more", () => {
    renderWithRouter(<FeaturedWork caseStudies={fx.caseStudies} />);
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });
});

describe("UI-T-043 services section", () => {
  it("5 rows in order; expanding one shows its description and deliverables list", async () => {
    const user = userEvent.setup();
    renderWithRouter(<ServicesSection services={fx.services} />);
    const section = screen.getByRole("region", { name: "What I do" });
    expect(section).toHaveAttribute("data-surface", "dark");
    const buttons = within(section).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(fx.services.map((s) => s.name));
    for (const b of buttons) expect(b).toHaveAttribute("aria-expanded", "false");
    expect(within(section).getAllByRole("heading", { level: 3 })).toHaveLength(5);

    await user.click(buttons[1]!);
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(buttons[1]!.getAttribute("aria-controls")!)!;
    expect(panel).toBeVisible();
    expect(within(panel).getByText(fx.services[1]!.description)).toBeInTheDocument();
    const items = within(within(panel).getByRole("list")).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(fx.services[1]!.deliverables);
    expect(buttons[0]).toHaveAttribute("aria-expanded", "false");
  });

  it("empty → hidden", () => {
    const { container } = renderWithRouter(<ServicesSection services={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("UI-T-044 engagement models", () => {
  it("3 cards in order with feature lists; actions follow cta_target with cta_label", () => {
    renderWithRouter(<EngagementModels models={fx.engagementModels} bookingUrl="https://booking.example.com/mitali" />);
    const cards = screen.getAllByRole("article");
    expect(cards.map((c) => within(c).getByRole("heading", { level: 3 }).textContent)).toEqual(
      fx.engagementModels.map((m) => m.name),
    );
    cards.forEach((card, i) => {
      const model = fx.engagementModels[i]!;
      expect(card).toHaveAttribute("data-surface", "dark");
      expect(within(card).getAllByRole("listitem").map((li) => li.textContent)).toEqual(model.features);
      const link = within(card).getByRole("link", { name: new RegExp(model.cta_label) });
      if (model.cta_target === "booking") {
        expect(link).toHaveAttribute("href", "https://booking.example.com/mitali");
        expect(link).toHaveAttribute("target", "_blank");
      } else {
        expect(link).toHaveAttribute("href", "/contact");
        expect(link).not.toHaveAttribute("target");
      }
    });
    expect(screen.queryByText(/£|\$|€/)).toBeNull();
  });

  it("booking target without a valid booking URL falls back to /contact", () => {
    renderWithRouter(<EngagementModels models={fx.engagementModels} bookingUrl={null} />);
    expect(screen.getByRole("link", { name: "Book a call" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Plan a workshop" })).toHaveAttribute("href", "/contact");
  });

  it("empty → hidden", () => {
    const { container } = renderWithRouter(<EngagementModels models={[]} bookingUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("UI-T-045 testimonials section", () => {
  it("renders the carousel; the case-study link only where a slug exists", () => {
    renderWithRouter(<TestimonialsSection testimonials={fx.testimonials} />);
    expect(screen.getByRole("heading", { level: 2, name: "What clients say" })).toBeInTheDocument();
    const carousel = screen.getByRole("region", { name: "Client testimonials" });
    expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
    const slides = within(carousel).getAllByRole("group", { hidden: true });
    expect(slides).toHaveLength(5);
    expect(within(slides[0]!).getByRole("link", { name: "Read the case study" })).toHaveAttribute(
      "href",
      "/work/case-study-1",
    );
    for (const slide of slides.slice(1)) {
      expect(within(slide).queryByRole("link", { name: "Read the case study", hidden: true })).toBeNull();
    }
  });

  it("single testimonial: no controls; none: nothing rendered", () => {
    const { unmount } = renderWithRouter(<TestimonialsSection testimonials={fx.testimonials.slice(0, 1)} />);
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    const { container } = renderWithRouter(<TestimonialsSection testimonials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
