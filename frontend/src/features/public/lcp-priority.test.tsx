import { describe, expect, it } from "vitest";
import { render } from "@/entry-server";
import { createFixtureSource } from "@/test/fixture-source";
import * as fx from "@/test/fixtures";

const SITE_URL = "https://mitali.example.com";

function mainImages(html: string): HTMLImageElement[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return [...doc.querySelectorAll<HTMLImageElement>("main img")];
}

describe("REQ-NFR-004 LCP image priority in the pre-rendered markup", () => {
  it.each(["/work", "/writing"])("%s: only the first card image is eager + fetchpriority=high", async (url) => {
    const result = await render(url, { source: createFixtureSource(), siteUrl: SITE_URL });
    const cards = mainImages(result.html).filter((img) => img.closest("article"));
    expect(cards.length).toBeGreaterThan(1);
    expect(cards[0]!.getAttribute("loading")).toBe("eager");
    expect(cards[0]!.getAttribute("fetchpriority")).toBe("high");
    for (const img of cards.slice(1)) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.hasAttribute("fetchpriority")).toBe(false);
    }
  });

  it.each([`/work/${fx.caseStudies[0]!.slug}`, `/writing/${fx.writingSamples[0]!.slug}`])(
    "%s: the cover image (first image) is eager + fetchpriority=high",
    async (url) => {
      const result = await render(url, { source: createFixtureSource(), siteUrl: SITE_URL });
      const first = mainImages(result.html)[0]!;
      expect(first.getAttribute("loading")).toBe("eager");
      expect(first.getAttribute("fetchpriority")).toBe("high");
    },
  );
});
