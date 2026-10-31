/**
 * UI-T-145 / UI-112 / REQ-021..023: case-study page with 3 results (1 sample), gallery full/half/half and 2 "more
 * work" units; sample notes; sections hidden when empty; unknown slug → not-found page.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mapCaseStudyDetail } from "@/app/content-mappers";
import type { CaseStudyDetail } from "@/app/content-types";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

function detail(overrides: Partial<CaseStudyDetail> = {}): CaseStudyDetail {
  const base = mapCaseStudyDetail(fx.caseStudyDetail("case-study-1")!);
  return {
    ...base,
    results: [
      { ...base.results[0]!, id: "r1", is_sample: true },
      { id: "r2", metric_label: "Email sign-ups", value: "2,400", before_value: null, change_text: null, period: null, is_sample: false },
      { id: "r3", metric_label: "Open rate", value: "41%", before_value: "29%", change_text: "+12 pts", period: "Q2", is_sample: false },
    ],
    images: [
      { id: "g1", layout: "full", image: fx.imageRef("g1", "Full gallery image"), caption: null },
      { id: "g2", layout: "half", image: fx.imageRef("g2", "Half gallery image A"), caption: "A caption" },
      { id: "g3", layout: "half", image: fx.imageRef("g3", "Half gallery image B"), caption: null },
    ],
    ...overrides,
  };
}

const source = (cs: CaseStudyDetail) => createFixtureSource({ "work/case-study-1": () => cs });

describe("UI-T-145 case-study page", () => {
  it("h1, chip, sample note, priority cover, meta <dl>, story, results, gallery tiles and 2 more-work units", async () => {
    await renderRoute("/work/case-study-1", source(detail()));
    const main = screen.getByRole("main");
    const h1 = within(main).getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Case study 1");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getAllByText("Brand launch").length).toBeGreaterThan(0);
    expect(within(main).getByText("Sample case study")).toBeInTheDocument();

    const cover = within(main).getByRole("img", { name: "Cover artwork for case study 1" });
    expect(cover).toHaveAttribute("loading", "eager");
    expect(cover).toHaveAttribute("fetchpriority", "high");
    expect(main.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    expect(cover.closest("[data-parallax]")).not.toBeNull();

    const dl = main.querySelector('dl[aria-label="Project details"]')!;
    expect([...dl.querySelectorAll("dt")].map((d) => d.textContent)).toEqual([
      "Client",
      "Year",
      "Industry",
      "Timeline",
      "Campaign type",
      "Channels",
    ]);
    expect([...dl.querySelectorAll("dd")].map((d) => d.textContent)).toEqual([
      "Client 1 Ltd",
      "2025",
      "Retail",
      "8 weeks",
      "Brand launch",
      "Blog, Email",
    ]);

    expect(within(main).getByRole("heading", { level: 2, name: "The problem" })).toBeInTheDocument();
    expect(within(main).getByText("inconsistent").tagName).toBe("STRONG");
    expect(within(main).getByRole("heading", { level: 2, name: "The solution" })).toBeInTheDocument();

    const results = within(main).getByRole("region", { name: "Results" });
    expect(results).toHaveAttribute("data-surface", "deep");
    expect(within(results).getByText("Sample data")).toBeInTheDocument();
    const items = within(results).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByText("+48%")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Organic sessions")).toBeInTheDocument();
    expect(within(items[0]!).getByText("+5,760")).toBeInTheDocument();
    expect(within(items[1]!).queryByRole("term")).toBeNull();

    const gallery = within(main).getByRole("region", { name: "Gallery" });
    const tiles = within(gallery).getAllByRole("listitem");
    expect(tiles.map((t) => t.getAttribute("data-layout"))).toEqual(["full", "half", "half"]);
    expect(within(gallery).getByText("A caption")).toBeInTheDocument();

    const more = within(main).getByRole("region", { name: "More work" });
    const units = within(more).getAllByRole("article");
    expect(units).toHaveLength(2);
    expect(units.map((u) => within(u).getByRole("link").getAttribute("href"))).not.toContain("/work/case-study-1");
    expect(within(more).getByRole("link", { name: "View all work" })).toHaveAttribute("href", "/work");
    // The single slide-in reveal of the page sits on the "More work" heading.
    expect(main.querySelectorAll('[data-reveal="slide"]')).toHaveLength(1);
    expect(within(more).getByRole("heading", { level: 2 }).closest('[data-reveal="slide"]')).not.toBeNull();
  });

  it("not sample: no sample notes", async () => {
    const cs = detail({ is_sample: false, results: detail().results.map((r) => ({ ...r, is_sample: false })) });
    await renderRoute("/work/case-study-1", source(cs));
    expect(screen.queryByText("Sample case study")).toBeNull();
    expect(screen.queryByText("Sample data")).toBeNull();
  });

  it("0 results, no gallery, no more work: sections hidden, View all work moves to the story section", async () => {
    await renderRoute("/work/case-study-1", source(detail({ results: [], images: [], more_work: [] })));
    const main = screen.getByRole("main");
    expect(within(main).queryByRole("region", { name: "Results" })).toBeNull();
    expect(within(main).queryByRole("region", { name: "Gallery" })).toBeNull();
    expect(within(main).queryByRole("region", { name: "More work" })).toBeNull();
    expect(within(main).getByRole("link", { name: "View all work" })).toHaveAttribute("href", "/work");
  });

  it("unknown slug → not-found page", async () => {
    await renderRoute("/work/unknown-slug");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page took a day off");
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("invalid slug shape → not-found page", async () => {
    await renderRoute("/work/Not_A_Slug");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page took a day off");
  });
});
