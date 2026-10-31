/**
 * UI-T-137 / UI-106 / DES-053: dialog semantics, focus moved in, trapped and returned, `inert` on the background,
 * scroll-lock attribute on <html>, closes on link choice, route change and growing to ≥ 768 px; the closing slide
 * runs only when motion is allowed. (Ported from frontend/ UI-T-037/038 with the frontend-2 breakpoint.)
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render";
import { MD_QUERY } from "./MobileMenu";

/** Controllable matchMedia: narrow viewport and reduced motion by default; `setWide(true)` fires the md query. */
function installMatchMedia(motion = false) {
  let wide = false;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = (query: string) =>
    ({
      media: query,
      get matches() {
        if (query === MD_QUERY) return wide;
        if (query.includes("no-preference")) return motion;
        if (query.includes("reduce")) return !motion;
        return false;
      },
      addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
        if (query === MD_QUERY) listeners.add(cb);
      },
      removeEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => listeners.delete(cb),
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(mql));
  return {
    setWide(value: boolean) {
      wide = value;
      for (const cb of listeners) cb({ matches: value } as MediaQueryListEvent);
    },
  };
}

function menuButton(): HTMLElement {
  return within(screen.getByRole("banner")).getByRole("button", { name: "Menu" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UI-T-137 mobile menu dialog", () => {
  beforeEach(() => {
    installMatchMedia();
  });

  it("opens a modal dialog, focuses the first link, traps Tab, Escape closes and returns focus", async () => {
    const user = userEvent.setup();
    await renderRoute("/work/case-study-1");
    const button = menuButton();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-controls");

    await user.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("data-surface", "deep");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", dialog.id);

    const links = within(dialog).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Home",
      "Work",
      "Writing",
      "About",
      "Contact",
      "FAQs",
      "Book a call (opens in a new tab)",
    ]);
    await waitFor(() => expect(document.activeElement).toBe(links[0]));
    expect(within(dialog).getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
    expect(within(dialog).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");

    // Tab from the last element wraps to the first focusable (the close button); Shift+Tab wraps back.
    const close = within(dialog).getByRole("button", { name: "Close menu" });
    links.at(-1)!.focus();
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(links.at(-1));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("the close button closes the dialog and returns focus to Menu", async () => {
    const user = userEvent.setup();
    await renderRoute("/");
    await user.click(menuButton());
    await user.click(await screen.findByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(menuButton()));
  });

  it("background is inert and scroll locked while open; choosing a link navigates and closes", async () => {
    const user = userEvent.setup();
    const { container } = await renderRoute("/");
    await user.click(menuButton());
    const dialog = await screen.findByRole("dialog");
    expect(container).toHaveAttribute("inert");
    expect(document.documentElement).toHaveAttribute("data-scroll-locked", "true");
    expect(dialog.closest("[inert]")).toBeNull();

    // Writing arrives in PH-3: until then it shows the not-found page (TS-023 step 5).
    await user.click(within(dialog).getByRole("link", { name: "Writing" }));
    expect(await screen.findByRole("heading", { level: 1, name: "This page took a day off" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container).not.toHaveAttribute("inert");
    expect(document.documentElement).not.toHaveAttribute("data-scroll-locked");
  });

  it("any route change closes it", async () => {
    const user = userEvent.setup();
    const { router } = await renderRoute("/");
    await user.click(menuButton());
    await screen.findByRole("dialog");
    await act(async () => {
      await router.navigate("/work/case-study-2");
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the dialog contains Book a call with the booking URL", async () => {
    const user = userEvent.setup();
    await renderRoute("/");
    await user.click(menuButton());
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: /Book a call/ })).toHaveAttribute("href", "https://booking.example.com/mitali");
  });
});

describe("UI-T-137 resize and motion", () => {
  it("growing to ≥ 768 px closes it", async () => {
    const media = installMatchMedia();
    const user = userEvent.setup();
    await renderRoute("/");
    await user.click(menuButton());
    await screen.findByRole("dialog");
    act(() => media.setWide(true));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("motion allowed: closing keeps the panel for the slide-out (inert, hidden from AT), then removes it", async () => {
    installMatchMedia(true);
    const user = userEvent.setup();
    await renderRoute("/");
    await user.click(menuButton());
    const dialog = await screen.findByRole("dialog");
    expect(dialog.parentElement).toHaveAttribute("data-state", "open");
    await user.keyboard("{Escape}");
    const layer = dialog.parentElement!;
    expect(layer).toHaveAttribute("data-state", "closing");
    expect(layer).toHaveAttribute("inert");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-scroll-locked");
    await waitFor(() => expect(document.activeElement).toBe(menuButton()));
    // Removed after the slide (animationend, or the fallback timeout where the event never fires, as in jsdom).
    await waitFor(() => expect(document.body.contains(dialog)).toBe(false), { timeout: 2000 });
  });
});
