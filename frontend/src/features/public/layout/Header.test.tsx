import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function header(): HTMLElement {
  return screen.getByRole("banner");
}

// jsdom does not evaluate @media rules, so the tablet/desktop navigation is display:none under the mobile-first
// styles there (and hidden elements have no computed accessible name); these checks read the DOM directly.
describe("UI-T-035 Header navigation", () => {
  it.each([
    ["/work", "Work"],
    ["/work/case-study-2", "Work"],
    ["/writing", "Writing"],
    ["/writing/writing-sample-3", "Writing"],
    ["/about", "About"],
  ])("%s marks %s as the current page", async (path, current) => {
    await renderRoute(path);
    const nav = header().querySelector<HTMLElement>('nav[aria-label="Main"]')!;
    const links = within(nav).getAllByRole("link", { hidden: true });
    expect(links.map((l) => l.textContent)).toEqual(["Work", "Writing", "About", "Contact"]);
    for (const link of links) {
      if (link.textContent === current) expect(link).toHaveAttribute("aria-current", "page");
      else expect(link).not.toHaveAttribute("aria-current");
    }
    expect(within(header()).getByRole("link", { name: "Mitali, home" })).toHaveAttribute("href", "/");
    const book = within(header())
      .getAllByRole("link", { hidden: true })
      .find((l) => l.textContent?.startsWith("Book a call"))!;
    expect(book).toHaveAttribute("href", "https://booking.example.com/mitali");
    expect(book).toHaveAttribute("target", "_blank");
    expect(within(header()).getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("header text uses the dark-surface aliases", async () => {
    await renderRoute("/work");
    expect(header()).toHaveAttribute("data-surface", "deepest");
  });
});

describe("UI-T-036 Header compact state", () => {
  beforeEach(() => {
    FakeObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sentinelObserver(): FakeObserver {
    const observer = FakeObserver.instances.find((o) =>
      o.targets.some((t) => t.getAttribute("class")?.includes("sentinel")),
    );
    if (!observer) throw new Error("sentinel not observed");
    return observer;
  }

  it("dark-hero page: transparent at the top, compact when the sentinel leaves, transparent again on re-entry", async () => {
    await renderRoute("/");
    expect(header()).not.toHaveAttribute("data-compact");
    const observer = sentinelObserver();
    act(() => observer.fire(false));
    expect(header()).toHaveAttribute("data-compact", "true");
    act(() => observer.fire(true));
    expect(header()).not.toHaveAttribute("data-compact");
  });

  it("page without a dark hero starts compact", async () => {
    await renderRoute("/work");
    expect(header()).toHaveAttribute("data-compact", "true");
    act(() => sentinelObserver().fire(true));
    expect(header()).toHaveAttribute("data-compact", "true");
  });

  it("without IntersectionObserver the header stays in its initial state", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    await renderRoute("/about");
    expect(header()).not.toHaveAttribute("data-compact");
  });
});
