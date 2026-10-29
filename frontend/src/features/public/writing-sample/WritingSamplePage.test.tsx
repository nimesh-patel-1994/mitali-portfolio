import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WritingSampleDetailRaw } from "@/api/types";
import { mapWritingSampleDetail } from "@/app/content-mappers";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";
import { formatPublishedDate } from "./WritingSamplePage";

const SLUG = "writing-sample-1";

function sample(overrides: Partial<WritingSampleDetailRaw> = {}): WritingSampleDetailRaw {
  return { ...fx.writingSampleDetail(SLUG)!, ...overrides };
}

async function renderSample(overrides: Partial<WritingSampleDetailRaw> = {}) {
  const source = createFixtureSource({ [`writing/${SLUG}`]: () => mapWritingSampleDetail(sample(overrides)) });
  return renderRoute(`/writing/${SLUG}`, source);
}

describe("UI-T-055 writing-sample page", () => {
  it("h1, format, client, UTC date in <time>, reading time, tags, Sample note and sanitized body", async () => {
    await renderSample({ published_on: "2026-01-01", is_sample: true, client_name: "Harbour Tea Co." });
    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h1 = within(main).getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(sample().title);
    const header = h1.closest("section")!;
    expect(header).toHaveAttribute("data-surface", "dark");
    expect(within(header).getByText("Blog")).toBeInTheDocument();
    expect(within(header).getByText("Harbour Tea Co.")).toBeInTheDocument();

    const time = header.querySelector("time")!;
    expect(time).toHaveAttribute("datetime", "2026-01-01");
    expect(time).toHaveTextContent("January 1, 2026");
    expect(within(header).getByText(`${sample().reading_time_min} min read`)).toBeInTheDocument();

    const tags = within(header).getByRole("list", { name: "Tags" });
    expect(within(tags).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["tone", "conversion"]);
    expect(within(header).getByText("Sample")).toBeInTheDocument();

    expect(within(main).getByRole("heading", { level: 2, name: "Opening" })).toBeInTheDocument();
    expect(within(main).getByRole("link", { name: "link" })).toHaveAttribute("href", "https://example.com");
    expect(within(main).getByRole("link", { name: "Back to writing" })).toHaveAttribute("href", "/writing");
    expect(within(main).getByRole("link", { name: /Book a call/ })).toBeInTheDocument();
  });

  it("thumbnail is the LCP image when present; omitted when null; no client row when null", async () => {
    await renderSample({ client_name: null, is_sample: false });
    const thumb = screen.getByRole("img", { name: sample().thumbnail!.alt });
    expect(thumb).toHaveAttribute("fetchpriority", "high");
    expect(screen.queryByText("Client")).toBeNull();
    expect(screen.queryByText("Sample")).toBeNull();
  });

  it("no date shift in any time zone: the date is formatted in UTC", () => {
    expect(formatPublishedDate("2026-03-01")).toBe("March 1, 2026");
    expect(formatPublishedDate("2026-12-31")).toBe("December 31, 2026");
    expect(formatPublishedDate("not-a-date")).toBeNull();
  });

  it("unknown slug → not found", async () => {
    await renderRoute("/writing/missing-sample");
    expect(screen.getByRole("heading", { level: 1, name: "This page took a day off" })).toBeInTheDocument();
  });
});
