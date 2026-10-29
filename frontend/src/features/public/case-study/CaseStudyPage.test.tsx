import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CaseStudyDetailRaw } from "@/api/types";
import { mapCaseStudyDetail } from "@/app/content-mappers";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

const SLUG = "case-study-1";

function detail(overrides: Partial<CaseStudyDetailRaw> = {}): CaseStudyDetailRaw {
  return { ...fx.caseStudyDetail(SLUG)!, ...overrides };
}

async function renderCaseStudy(overrides: Partial<CaseStudyDetailRaw> = {}) {
  const source = createFixtureSource({ [`work/${SLUG}`]: () => mapCaseStudyDetail(detail(overrides)) });
  return renderRoute(`/work/${SLUG}`, source);
}

const results: CaseStudyDetailRaw["results"] = [
  { id: "r1", metric_label: "Organic sessions", value: "+48%", before_value: "12,000", change_text: "+5,760", period: "3 months", is_sample: false },
  { id: "r2", metric_label: "Email open rate", value: "41%", before_value: null, change_text: null, period: null, is_sample: true },
  { id: "r3", metric_label: "Demo requests", value: "2x", before_value: null, change_text: null, period: "Quarter", is_sample: false },
];

describe("UI-T-047 case-study details", () => {
  it("h1 title, campaign-type chip and dl rows in order", async () => {
    await renderCaseStudy();
    const cs = detail();
    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h1 = within(main).getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(cs.title);
    const detailsSection = h1.closest("section")!;
    expect(within(detailsSection).getAllByText(cs.campaign_type).length).toBeGreaterThan(0);

    const facts = main.querySelector<HTMLElement>('dl[aria-label="Project details"]')!;
    const terms = Array.from(facts.querySelectorAll("dt")).map((dt) => dt.textContent);
    const values = Array.from(facts.querySelectorAll("dd")).map((dd) => dd.textContent);
    expect(terms).toEqual(["Client", "Year", "Industry", "Timeline", "Campaign type", "Channels"]);
    expect(values).toEqual([cs.client_name, String(cs.year), cs.client_industry, cs.timeline, cs.campaign_type, "Blog, Email"]);
    expect(within(main).getByText(cs.summary)).toBeInTheDocument();

    expect(within(main).getByRole("heading", { level: 2, name: "The problem" })).toBeInTheDocument();
    expect(within(main).getByRole("heading", { level: 2, name: "The solution" })).toBeInTheDocument();
    expect(within(main).getByText("inconsistent").tagName).toBe("STRONG");
  });

  it("cover is the LCP image (eager, high priority) with the API alt", async () => {
    await renderCaseStudy();
    const cover = screen.getByRole("img", { name: detail().cover!.alt });
    expect(cover).toHaveAttribute("loading", "eager");
    expect(cover).toHaveAttribute("fetchpriority", "high");
  });

  it("unknown slug → not-found page", async () => {
    await renderRoute("/work/does-not-exist");
    expect(screen.getByRole("heading", { level: 1, name: "This page took a day off" })).toBeInTheDocument();
  });
});

describe("UI-T-048 case-study results and sample notes", () => {
  it("each value and label, change when present, 'Sample data' and 'Sample case study' notes", async () => {
    await renderCaseStudy({ results, is_sample: true });
    const section = screen.getByRole("region", { name: "Results" });
    expect(section).toHaveAttribute("data-surface", "dark");
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByText("+48%")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Organic sessions")).toBeInTheDocument();
    expect(within(items[0]!).getByText("12,000")).toBeInTheDocument();
    expect(within(items[0]!).getByText("+5,760")).toBeInTheDocument();
    expect(within(items[0]!).getByText("3 months")).toBeInTheDocument();
    expect(within(items[1]!).queryByText("Change")).toBeNull();
    expect(within(section).getByText("Sample data")).toBeInTheDocument();
    expect(screen.getByText("Sample case study")).toBeInTheDocument();
  });

  it("no sample flags → no notes", async () => {
    await renderCaseStudy({ results: results.map((r) => ({ ...r, is_sample: false })), is_sample: false });
    expect(screen.queryByText("Sample data")).toBeNull();
    expect(screen.queryByText("Sample case study")).toBeNull();
  });

  it("0 results → row hidden", async () => {
    await renderCaseStudy({ results: [] });
    expect(screen.queryByRole("region", { name: "Results" })).toBeNull();
  });
});

describe("UI-T-049 gallery and more work", () => {
  const images: CaseStudyDetailRaw["images"] = [
    { id: "g1", layout: "full", image: fx.imageRef("g1", "Full-width brand board"), caption: "The launch board" },
    { id: "g2", layout: "half", image: fx.imageRef("g2", "Email header draft"), caption: null },
    { id: "g3", layout: "half", image: fx.svgRef("g3", "Social tile set"), caption: "Social tiles" },
  ];

  it("tiles in order with layout classes, alt text and captions; 2 more-work cards and View all link", async () => {
    await renderCaseStudy({ images });
    const gallery = screen.getByRole("region", { name: "Gallery" });
    const tiles = within(gallery).getAllByRole("listitem");
    expect(tiles.map((t) => (t.className.includes("full") ? "full" : t.className.includes("half") ? "half" : "?"))).toEqual([
      "full",
      "half",
      "half",
    ]);
    expect(tiles.map((t) => within(t).getByRole("img").getAttribute("alt"))).toEqual(images.map((i) => i.image.alt));
    expect(within(tiles[0]!).getByText("The launch board").tagName).toBe("FIGCAPTION");
    expect(tiles[1]!.querySelector("figcaption")).toBeNull();

    const more = screen.getByRole("region", { name: "More work" });
    expect(within(more).getAllByRole("article")).toHaveLength(2);
    expect(within(more).getByRole("link", { name: "View all work" })).toHaveAttribute("href", "/work");
  });

  it("more_work empty: strip hidden, View all link kept in the previous section", async () => {
    await renderCaseStudy({ images, more_work: [] });
    expect(screen.queryByRole("region", { name: "More work" })).toBeNull();
    const gallery = screen.getByRole("region", { name: "Gallery" });
    expect(within(gallery).getByRole("link", { name: "View all work" })).toHaveAttribute("href", "/work");
  });

  it("no gallery, no results, no more work: link sits under the solution", async () => {
    await renderCaseStudy({ images: [], results: [], more_work: [] });
    expect(screen.queryByRole("region", { name: "Gallery" })).toBeNull();
    expect(screen.getByRole("link", { name: "View all work" })).toBeInTheDocument();
  });
});
