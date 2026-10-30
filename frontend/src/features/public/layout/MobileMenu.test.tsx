import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "@/test/render";
import { TABLET_QUERY } from "./MobileMenu";

/** Controllable matchMedia: narrow viewport by default; `setWide(true)` fires a change for the tablet query. */
function installMatchMedia() {
  let wide = false;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = (query: string) =>
    ({
      media: query,
      get matches() {
        return query === TABLET_QUERY ? wide : false;
      },
      addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
        if (query === TABLET_QUERY) listeners.add(cb);
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

describe("UI-T-037 mobile menu dialog", () => {
  beforeEach(() => {
    installMatchMedia();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a modal dialog, moves focus inside, traps Tab, Escape closes and returns focus", async () => {
    const user = userEvent.setup();
    await renderRoute("/work");
    const button = menuButton();
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
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
});

describe("UI-T-038 mobile menu closing and inert background", () => {
  let media: ReturnType<typeof installMatchMedia>;
  beforeEach(() => {
    media = installMatchMedia();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("background is inert and scrolling locked while open; activating Writing navigates and closes", async () => {
    const user = userEvent.setup();
    const { container } = await renderRoute("/");
    await user.click(menuButton());
    const dialog = await screen.findByRole("dialog");
    expect(container).toHaveAttribute("inert");
    expect(document.documentElement).toHaveAttribute("data-scroll-locked", "true");
    expect(dialog.closest("[inert]")).toBeNull();

    await user.click(within(dialog).getByRole("link", { name: "Writing" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Writing" })).toBeInTheDocument();
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
      await router.navigate("/faqs");
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("growing past 810 px closes it", async () => {
    const user = userEvent.setup();
    await renderRoute("/");
    await user.click(menuButton());
    await screen.findByRole("dialog");
    act(() => media.setWide(true));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("the dialog contains the Book a call button", async () => {
    const user = userEvent.setup();
    await renderRoute("/");
    await user.click(menuButton());
    await screen.findByRole("dialog");
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: /Book a call/ })).toHaveAttribute(
      "href",
      "https://booking.example.com/mitali",
    );
  });
});

describe("UI-T-038 / UI-REV-008 mobile menu: current link and aria-controls", () => {
  beforeEach(() => {
    installMatchMedia();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("closed: no aria-controls (the dialog does not exist); on /work/<slug> Work is the current page", async () => {
    const user = userEvent.setup();
    await renderRoute("/work/case-study-1");
    const button = menuButton();
    expect(button).not.toHaveAttribute("aria-controls");
    await user.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    expect(button).toHaveAttribute("aria-controls", dialog.id);
    expect(within(dialog).getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
    expect(within(dialog).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button).not.toHaveAttribute("aria-controls");
  });
});
