import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRevealObserverForTests, Reveal } from "./Reveal";

type Callback = (entries: Array<Pick<IntersectionObserverEntry, "isIntersecting" | "target">>) => void;

let observerCallback: Callback | null = null;

class FakeObserver {
  constructor(callback: Callback) {
    observerCallback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function mockMotion(allowed: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("no-preference") ? allowed : !allowed, media: query })),
  );
  window.matchMedia = globalThis.matchMedia;
}

beforeEach(() => {
  resetRevealObserverForTests();
  observerCallback = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-T-014 Reveal", () => {
  it("before hydration (server HTML) the content is visible with no hidden state", () => {
    const html = renderToString(<Reveal>Pre-rendered</Reveal>);
    expect(html).toContain('data-reveal="static"');
    expect(html).toContain("Pre-rendered");
  });

  it("reduced motion: stays static", () => {
    mockMotion(false);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Reveal>Calm content</Reveal>);
    expect(screen.getByText("Calm content")).toHaveAttribute("data-reveal", "static");
    expect(observerCallback).toBeNull();
  });

  it("no IntersectionObserver: stays static", () => {
    mockMotion(true);
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Reveal>Old browser</Reveal>);
    expect(screen.getByText("Old browser")).toHaveAttribute("data-reveal", "static");
  });

  it("motion allowed after hydration: below-the-fold content hides, then reveals on entry", () => {
    mockMotion(true);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Reveal>Below fold</Reveal>);
    const el = screen.getByText("Below fold");
    act(() => observerCallback?.([{ isIntersecting: false, target: el }]));
    expect(el).toHaveAttribute("data-reveal", "hidden");
    act(() => observerCallback?.([{ isIntersecting: true, target: el }]));
    expect(el).toHaveAttribute("data-reveal", "shown");
  });

  it("motion allowed: content already in view is never hidden", () => {
    mockMotion(true);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    render(<Reveal>Above fold</Reveal>);
    const el = screen.getByText("Above fold");
    act(() => observerCallback?.([{ isIntersecting: true, target: el }]));
    expect(el).toHaveAttribute("data-reveal", "static");
  });
});
