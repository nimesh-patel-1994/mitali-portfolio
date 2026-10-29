import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ImageRef } from "@/api/types";
import { imageRef, svgRef } from "@/test/fixtures";
import { ResponsiveImage } from "./ResponsiveImage";

const sizes = "(min-width: 810px) 50vw, 100vw";

describe("UI-T-029 ResponsiveImage", () => {
  it("raster ref: src, srcset, sizes, width, height, alt, lazy by default", () => {
    render(<ResponsiveImage image={imageRef("cover", "A cover")} sizes={sizes} />);
    const img = screen.getByRole("img", { name: "A cover" });
    expect(img).toHaveAttribute("src", "/media/seed/cover-1600.webp");
    expect(img.getAttribute("srcset")).toBe(
      "/media/seed/cover-480.webp 480w, /media/seed/cover-960.webp 960w, /media/seed/cover-1600.webp 1600w",
    );
    expect(img).toHaveAttribute("sizes", sizes);
    expect(img).toHaveAttribute("width", "1600");
    expect(img).toHaveAttribute("height", "900");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).not.toHaveAttribute("fetchpriority");
    expect(img).not.toHaveAttribute("style");
  });

  it("SVG ref has no srcset", () => {
    render(<ResponsiveImage image={svgRef("cover", "Vector cover")} sizes={sizes} />);
    const img = screen.getByRole("img", { name: "Vector cover" });
    expect(img).not.toHaveAttribute("srcset");
    expect(img).toHaveAttribute("src", "/media/seed/cover.svg");
  });

  it("priority → eager + fetchpriority=high", () => {
    render(<ResponsiveImage image={imageRef("cover", "LCP")} sizes="100vw" priority />);
    const img = screen.getByRole("img", { name: "LCP" });
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("decorative → alt empty", () => {
    const { container } = render(<ResponsiveImage image={imageRef("x", "ignored")} sizes="100vw" decorative />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("missing ref → fallback block with the requested ratio, no img", () => {
    const { container } = render(<ResponsiveImage image={null} sizes="100vw" fallbackRatio={{ width: 4, height: 5 }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-fallback='true'] svg")).toHaveAttribute("viewBox", "0 0 4 5");
  });

  it("load error → fallback block labelled with the alt, same ratio", () => {
    const { container } = render(<ResponsiveImage image={imageRef("broken", "Broken one")} sizes="100vw" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Broken one" })).toHaveAttribute("data-fallback", "true");
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1600 900");
  });
});

describe("SEC-UI-009 media URLs", () => {
  it.each(["https://evil.example/x.png", "javascript:alert(1)", "//evil.example/x.png", "/media/../etc/passwd"])(
    "%s → fallback, no img src",
    (url) => {
      const ref: ImageRef = { ...imageRef("x", "Bad"), url };
      const { container } = render(<ResponsiveImage image={ref} sizes="100vw" />);
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("[data-fallback='true']")).not.toBeNull();
    },
  );

  it("drops srcset entries that are not under /media/", () => {
    const ref: ImageRef = {
      ...imageRef("x", "Mixed"),
      srcset: [
        { width: 480, url: "https://evil.example/x.webp" },
        { width: 960, url: "/media/seed/x-960.webp" },
      ],
    };
    render(<ResponsiveImage image={ref} sizes="100vw" />);
    expect(screen.getByRole("img", { name: "Mixed" })).toHaveAttribute("srcset", "/media/seed/x-960.webp 960w");
  });
});
