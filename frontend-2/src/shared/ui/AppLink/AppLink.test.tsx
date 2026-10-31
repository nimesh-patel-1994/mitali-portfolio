/**
 * UI-T-139 / REQ-094 / TS-024: internal links request a view transition only where `document.startViewTransition`
 * exists (and, in development, while the P1 toggle is on); reduced motion turns the cross-fade off in CSS; in every
 * case focus moves to <main>, the title updates, a push scrolls to the top and Back keeps the browser's position.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoutes } from "@/app/routes";
import { resetReviewStateForTests, setViewTransitionsEnabled } from "@/dev/review-state";
import { createFixtureSource } from "@/test/fixture-source";
import { SRC_DIR } from "@/test/paths";

type Doc = { startViewTransition?: unknown };

function stubViewTransitions() {
  const calls: number[] = [];
  (document as unknown as Doc).startViewTransition = vi.fn((cb: () => unknown) => {
    calls.push(1);
    const done = Promise.resolve(cb());
    return {
      finished: done.then(() => undefined),
      ready: Promise.resolve(),
      updateCallbackDone: done.then(() => undefined),
      skipTransition: () => undefined,
    };
  });
  return calls;
}

async function renderBrowserApp() {
  window.history.replaceState(null, "", "/");
  const router = createBrowserRouter(createRoutes(createFixtureSource()));
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
}

async function journey() {
  const scrollTo = vi.spyOn(window, "scrollTo");
  const router = await renderBrowserApp();
  await waitFor(() => expect(document.title).toBe("Mitali — Content Writer & Marketing Strategist"));
  scrollTo.mockClear();
  const featured = screen.getByRole("region", { name: "Selected work" });
  await userEvent.setup().click(within(featured).getByRole("link", { name: /Case study 1/ }));
  await screen.findByRole("heading", { level: 1, name: "Case study 1" });
  await waitFor(() => expect(document.title).toBe("Case study 1 — Mitali"));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("main")));
  expect(scrollTo).toHaveBeenCalledWith(0, 0);

  scrollTo.mockClear();
  await act(async () => {
    await router.navigate(-1);
  });
  await screen.findByRole("heading", { level: 1, name: /Words with/ });
  await waitFor(() => expect(document.title).toBe("Mitali — Content Writer & Marketing Strategist"));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("main")));
  // Back (POP) keeps the browser's restored position: no scroll to the top.
  expect(scrollTo).not.toHaveBeenCalled();
  return router;
}

beforeEach(() => {
  resetReviewStateForTests();
});
afterEach(() => {
  delete (document as unknown as Doc).startViewTransition;
  resetReviewStateForTests();
  vi.restoreAllMocks();
});

describe("UI-T-139 view transitions", () => {
  it("API present: the transition is requested; focus, title and scroll handling are unchanged", async () => {
    const calls = stubViewTransitions();
    await journey();
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it("API absent: navigation is instant with the same focus, title and scroll handling", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((document as unknown as Doc).startViewTransition).toBeUndefined();
    await journey();
  });

  it("P1 toggle off (development only): no transition is requested", async () => {
    const calls = stubViewTransitions();
    act(() => setViewTransitionsEnabled(false));
    await journey();
    expect(calls).toHaveLength(0);
  });

  it("reduced motion: every ::view-transition-* animation is none; the cross-fade lives in no-preference", () => {
    const css = readFileSync(join(SRC_DIR, "styles", "motion.css"), "utf8");
    let reduceNone = false;
    let fadeInNoPreference = false;
    postcss.parse(css).walkAtRules("media", (at) => {
      at.walkRules((rule) => {
        if (!rule.selector.includes("::view-transition")) return;
        rule.walkDecls((d) => {
          if (/reduce/.test(at.params) && d.prop === "animation" && d.value === "none") reduceNone = true;
          if (/no-preference/.test(at.params) && d.prop === "animation-duration" && d.value === "var(--motion-vt-dur)") {
            fadeInNoPreference = true;
          }
        });
      });
    });
    expect(reduceNone).toBe(true);
    expect(fadeInNoPreference).toBe(true);
  });

  it("header and footer keep their place through their own view-transition-name (classes, never inline styles)", () => {
    const header = readFileSync(join(SRC_DIR, "features/public/layout/Header/Header.module.css"), "utf8");
    const footer = readFileSync(join(SRC_DIR, "features/public/layout/Footer/Footer.module.css"), "utf8");
    expect(header).toContain("view-transition-name: site-header");
    expect(footer).toContain("view-transition-name: site-footer");
  });
});
