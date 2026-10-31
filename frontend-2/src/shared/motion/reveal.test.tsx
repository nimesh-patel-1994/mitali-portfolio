/**
 * UI-T-133 / REQ-084 / UI-REV-028: reveals are progressive enhancement. Content is visible before hydration, under
 * reduced motion and without IntersectionObserver (no `data-motion` flag); with motion allowed, a block already
 * above ~85 % of the viewport is revealed at once, a block below is revealed on intersection, unobserved and never
 * hidden again. Server markup equals client markup.
 */
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "@/shared/ui/Reveal/Reveal";
import { initMotion, resetMotionForTests } from "./reveal";

class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly observed = new Set<Element>();
  readonly unobserved: Element[] = [];
  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
    this.unobserved.push(el);
  }
  disconnect() {
    this.observed.clear();
  }
  takeRecords() {
    return [];
  }
  fire(target: Element, isIntersecting: boolean) {
    this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function stubMotion(noPreference: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query.includes("no-preference") ? noPreference : !noPreference, media: query })),
  );
}

function placeAt(el: Element, top: number) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);
}

function renderTwoBlocks() {
  render(
    <>
      <Reveal>
        <p>Above the fold</p>
      </Reveal>
      <Reveal>
        <p>Below the fold</p>
      </Reveal>
    </>,
  );
  const above = screen.getByText("Above the fold").parentElement!;
  const below = screen.getByText("Below the fold").parentElement!;
  return { above, below };
}

beforeEach(() => {
  FakeObserver.instances = [];
  resetMotionForTests();
  vi.stubGlobal("innerHeight", 1000);
});
afterEach(() => {
  resetMotionForTests();
  vi.unstubAllGlobals();
});

describe("UI-T-133 Reveal + initMotion", () => {
  it("server and client render the same stable data-reveal attribute; nothing hidden before hydration", () => {
    const html = renderToString(
      <Reveal>
        <p>x</p>
      </Reveal>,
    );
    expect(html).toContain('data-reveal=""');
    expect(html).not.toContain("data-revealed");
    expect(renderToString(<Reveal variant="slide">x</Reveal>)).toContain('data-reveal="slide"');
    expect(document.documentElement).not.toHaveAttribute("data-motion");
  });

  it("reduced motion: no motion flag, everything stays visible", () => {
    stubMotion(false);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    renderTwoBlocks();
    expect(initMotion()).toBe(false);
    expect(document.documentElement).not.toHaveAttribute("data-motion");
    expect(FakeObserver.instances).toHaveLength(0);
  });

  it("no IntersectionObserver: no motion flag", () => {
    stubMotion(true);
    vi.stubGlobal("IntersectionObserver", undefined);
    renderTwoBlocks();
    expect(initMotion()).toBe(false);
    expect(document.documentElement).not.toHaveAttribute("data-motion");
  });

  it("no matchMedia (test runs, old browsers): no motion flag", () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    renderTwoBlocks();
    expect(initMotion()).toBe(false);
  });

  it("motion allowed: above-fold revealed at once, below-fold on intersect, unobserved, never hidden again", () => {
    stubMotion(true);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const { above, below } = renderTwoBlocks();
    placeAt(above, 200);
    placeAt(below, 900);

    expect(initMotion()).toBe(true);
    expect(document.documentElement.dataset.motion).toBe("on");
    const observer = FakeObserver.instances[0]!;
    expect(FakeObserver.instances).toHaveLength(1);
    expect(observer.options).toEqual({ rootMargin: "0px 0px -15% 0px", threshold: 0 });
    expect(above).toHaveAttribute("data-revealed");
    expect(below).not.toHaveAttribute("data-revealed");
    expect([...observer.observed]).toEqual([below]);

    observer.fire(below, false);
    expect(below).not.toHaveAttribute("data-revealed");
    observer.fire(below, true);
    expect(below).toHaveAttribute("data-revealed");
    expect(observer.unobserved).toContain(below);
    observer.fire(below, false);
    expect(below).toHaveAttribute("data-revealed");
  });

  it("one shared observer: blocks rendered after client navigation are observed by it", () => {
    stubMotion(true);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    initMotion();
    render(
      <Reveal>
        <p>Late block</p>
      </Reveal>,
    );
    const late = screen.getByText("Late block").parentElement!;
    expect(FakeObserver.instances).toHaveLength(1);
    expect(FakeObserver.instances[0]!.observed.has(late)).toBe(true);
    expect(initMotion()).toBe(true);
    expect(FakeObserver.instances).toHaveLength(1);
  });

  it("an error while starting leaves the page without the flag (content visible)", () => {
    stubMotion(true);
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor() {
          throw new Error("boom");
        }
      },
    );
    renderTwoBlocks();
    expect(initMotion()).toBe(false);
    expect(document.documentElement).not.toHaveAttribute("data-motion");
  });
});
