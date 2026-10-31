/**
 * UI-T-141 / SEC-UI-009 / UI-109: ResponsiveImage (raster, SVG, priority, missing, load error, external URL),
 * MediaBand (priority cover, parallax only via CSS scroll timeline inside @supports + no-preference) and Collage
 * (REQ-021 tile classes, drift classes only on half tiles).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as fx from "@/test/fixtures";
import { SRC_DIR } from "@/test/paths";
import { Collage, driftClasses } from "../Collage/Collage";
import { MediaBand } from "../MediaBand/MediaBand";
import { ResponsiveImage } from "./ResponsiveImage";

const raster = fx.imageRef("cover-1", "Cover artwork");

describe("UI-T-141 ResponsiveImage", () => {
  it("raster: srcset, sizes, alt, width/height, slot ratio class, lazy by default", () => {
    const { container } = render(<ResponsiveImage image={raster} sizes="100vw" ratio="16x9" />);
    const img = screen.getByRole("img", { name: "Cover artwork" });
    expect(img).toHaveAttribute("src", "/media/seed/cover-1-1600.webp");
    expect(img.getAttribute("srcset")).toBe(
      "/media/seed/cover-1-480.webp 480w, /media/seed/cover-1-960.webp 960w, /media/seed/cover-1-1600.webp 1600w",
    );
    expect(img).toHaveAttribute("sizes", "100vw");
    expect(img).toHaveAttribute("width", "1600");
    expect(img).toHaveAttribute("height", "900");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).not.toHaveAttribute("fetchpriority");
    const frame = container.firstElementChild!;
    expect(frame).toHaveAttribute("data-ratio", "16x9");
    const css = readFileSync(join(SRC_DIR, "shared/ui/ResponsiveImage/ResponsiveImage.module.css"), "utf8");
    for (const ratio of ["16x9", "4x3", "3x2", "5x6", "1x1"]) expect(css).toContain(`.frame[data-ratio="${ratio}"]`);
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("SVG: no srcset and no sizes", () => {
    render(<ResponsiveImage image={fx.svgRef("logo", "Diagram")} sizes="100vw" ratio="4x3" />);
    const img = screen.getByRole("img", { name: "Diagram" });
    expect(img).not.toHaveAttribute("srcset");
    expect(img).not.toHaveAttribute("sizes");
  });

  it("priority: eager + fetchpriority=high", () => {
    render(<ResponsiveImage image={raster} sizes="100vw" ratio="16x9" priority />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("missing ref: fallback block in the same reserved frame", () => {
    const { container } = render(<ResponsiveImage image={null} sizes="100vw" ratio="5x6" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-ratio", "5x6");
    expect(container.querySelector('[data-fallback="true"]')).toHaveAttribute("aria-hidden", "true");
  });

  it("load error: fallback in the same frame, labelled with the alt text", () => {
    const { container } = render(<ResponsiveImage image={raster} sizes="100vw" ratio="16x9" />);
    fireEvent.error(screen.getByRole("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Cover artwork" })).toHaveAttribute("data-fallback", "true");
    expect(container.firstElementChild).toHaveAttribute("data-ratio", "16x9");
  });

  it("external or unsafe URL: fallback, never an <img src>", () => {
    for (const url of ["https://evil.example/x.png", "/static/x.png", "/media/../x.png", "javascript:alert(1)"]) {
      const { container, unmount } = render(<ResponsiveImage image={{ ...raster, url }} sizes="100vw" ratio="16x9" />);
      expect(container.querySelector("img"), url).toBeNull();
      unmount();
    }
    const { container } = render(
      <ResponsiveImage image={{ ...raster, srcset: [{ width: 480, url: "https://evil.example/a.webp" }] }} sizes="100vw" ratio="16x9" />,
    );
    expect(container.querySelector("img")).not.toHaveAttribute("srcset");
  });

  it("decorative: empty alt", () => {
    const { container } = render(<ResponsiveImage image={raster} sizes="100vw" ratio="16x9" decorative />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});

describe("UI-T-141 MediaBand and Collage", () => {
  it("MediaBand renders the cover as the priority image in a 16:9 frame; parallax is CSS-only and guarded", () => {
    render(<MediaBand image={raster} priority />);
    expect(screen.getByRole("img")).toHaveAttribute("fetchpriority", "high");
    const css = readFileSync(join(SRC_DIR, "shared/ui/MediaBand/MediaBand.module.css"), "utf8");
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)\s*\{\s*@media \(prefers-reduced-motion: no-preference\)/);
  });

  it("Collage keeps full/half tiles in order and gives drift classes to half tiles only", () => {
    const items = (["full", "half", "half", "full", "half"] as const).map((layout, i) => ({
      key: `t${i}`,
      layout,
      content: <span>tile {i}</span>,
    }));
    render(<Collage items={items} aria-label="Gallery" />);
    const tiles = screen.getAllByRole("listitem");
    expect(tiles.map((t) => t.getAttribute("data-layout"))).toEqual(["full", "half", "half", "full", "half"]);
    expect(driftClasses(items)).toEqual([null, "drift1", "drift2", null, "drift3"]);
    expect(tiles[0]!.firstElementChild!.className).not.toMatch(/drift/);
    expect(tiles[1]!.firstElementChild!.className).toMatch(/drift1/);
  });
});
