/**
 * UI-T-136 / REQ-085 / SD-118 / UI-REV-035: header states. Compact after its height (sentinel); hidden on scroll
 * down past the header height, shown on scroll up; movements under 8 px change nothing; always shown near the top,
 * with focus inside and while the menu is open; never hidden under reduced motion; Work current on /work/*;
 * the skip link is the first focusable element.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DIRECTION_THRESHOLD, watchScrollDirection } from "@/shared/motion/scroll-direction";
import { renderRoute } from "@/test/render";

/** Minimal IntersectionObserver stand-in that lets the test drive the sentinel. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly targets: Element[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  fire(isIntersecting: boolean) {
    const entries = this.targets.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry);
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

/** Runs rAF callbacks synchronously and lets tests set scrollY. */
function installScroll(reduce = false) {
  let y = 0;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0; // synchronous in tests: no frame left pending

  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduce") ? reduce : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
  return (next: number) => {
    y = next;
    fireEvent.scroll(window);
  };
}

function header(): HTMLElement {
  return screen.getByRole("banner");
}

beforeEach(() => {
  FakeObserver.instances = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-T-136 Header", () => {
  it("compact after the header height (sentinel); scrollY 0 → 300 → 600 → 500: hidden on down, shown on up", async () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const scrollTo = installScroll();
    await renderRoute("/");
    expect(header()).not.toHaveAttribute("data-compact");
    act(() => FakeObserver.instances[0]!.fire(false));
    expect(header()).toHaveAttribute("data-compact", "true");

    scrollTo(300);
    expect(header()).toHaveAttribute("data-hidden", "true");
    scrollTo(600);
    expect(header()).toHaveAttribute("data-hidden", "true");
    scrollTo(500);
    expect(header()).not.toHaveAttribute("data-hidden");
  });

  it(`ignores movements under ${DIRECTION_THRESHOLD} px and is always shown near the top`, async () => {
    const scrollTo = installScroll();
    await renderRoute("/");
    scrollTo(400);
    expect(header()).toHaveAttribute("data-hidden");
    scrollTo(395);
    expect(header()).toHaveAttribute("data-hidden");
    scrollTo(390);
    expect(header()).not.toHaveAttribute("data-hidden");
    scrollTo(396);
    expect(header()).not.toHaveAttribute("data-hidden");
    scrollTo(500);
    expect(header()).toHaveAttribute("data-hidden");
    scrollTo(40);
    expect(header()).not.toHaveAttribute("data-hidden");
  });

  it("focusing a header link while hidden shows it; it is not hidden while it holds focus", async () => {
    const scrollTo = installScroll();
    await renderRoute("/");
    scrollTo(600);
    expect(header()).toHaveAttribute("data-hidden");
    const wordmark = within(header()).getByRole("link", { name: "Mitali, home" });
    act(() => wordmark.focus());
    expect(header()).not.toHaveAttribute("data-hidden");
    scrollTo(900);
    expect(header()).not.toHaveAttribute("data-hidden");
  });

  it("stays visible while the mobile menu is open", async () => {
    const scrollTo = installScroll();
    await renderRoute("/");
    scrollTo(600);
    await userEvent.setup().click(within(header()).getByRole("button", { name: "Menu" }));
    expect(header()).not.toHaveAttribute("data-hidden");
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    scrollTo(900);
    expect(header()).not.toHaveAttribute("data-hidden");
  });

  it("reduced motion: never hidden", async () => {
    const scrollTo = installScroll(true);
    await renderRoute("/");
    scrollTo(600);
    scrollTo(1200);
    expect(header()).not.toHaveAttribute("data-hidden");
  });

  it("/work/<slug>: Work is aria-current; skip link is the first focusable element", async () => {
    await renderRoute("/work/case-study-2");
    const nav = header().querySelector<HTMLElement>('nav[aria-label="Main"]')!;
    const links = within(nav).getAllByRole("link", { hidden: true });
    expect(links.map((l) => l.textContent)).toEqual(["Work", "Writing", "About", "Contact"]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    for (const l of links.slice(1)) expect(l).not.toHaveAttribute("aria-current");
    const first = screen.getAllByRole("link")[0]!;
    expect(first).toHaveTextContent("Skip to content");
    expect(first).toHaveAttribute("href", "#main");
    const book = within(header())
      .getAllByRole("link", { hidden: true })
      .find((l) => l.textContent?.startsWith("Book a call"))!;
    expect(book).toHaveAttribute("href", "https://booking.example.com/mitali");
    expect(book).toHaveAttribute("target", "_blank");
  });

  it("the not-found page gets a solid header from the start (header ink never on a deep surface)", async () => {
    await renderRoute("/writing");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page took a day off");
    expect(header()).toHaveAttribute("data-compact", "true");
  });
});

describe("SD-118 watchScrollDirection (unit)", () => {
  it("adds exactly one passive scroll listener and removes it on cleanup", () => {
    installScroll();
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const el = document.createElement("header");
    const stop = watchScrollDirection(el, { topZone: 80 });
    const scrollAdds = add.mock.calls.filter(([type]) => type === "scroll");
    expect(scrollAdds).toHaveLength(1);
    expect(scrollAdds[0]?.[2]).toEqual({ passive: true });
    stop();
    expect(remove.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(1);
  });

  it("coalesces scroll events to one frame and reads only scrollY", () => {
    installScroll();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    const el = document.createElement("header");
    const rect = vi.spyOn(el, "getBoundingClientRect");
    watchScrollDirection(el, { topZone: 80 });
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    expect(frames).toHaveLength(1);
    expect(rect).not.toHaveBeenCalled();
  });
});
