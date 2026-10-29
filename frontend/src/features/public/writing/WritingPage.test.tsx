import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readHydrationPayload, toHydrationState } from "@/app/hydration";
import { createRoutes } from "@/app/routes";
import { render as renderServer } from "@/entry-server";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

const SITE_URL = "https://mitali.example.com";

function filterNav(): HTMLElement {
  return screen.getByRole("navigation", { name: "Filter by format" });
}

function current(): string[] {
  return within(filterNav())
    .getAllByRole("link")
    .filter((l) => l.getAttribute("aria-current") === "true")
    .map((l) => l.textContent ?? "");
}

function cardTitles(): string[] {
  return within(screen.getByRole("main"))
    .queryAllByRole("article")
    .map((a) => within(a).getByRole("heading", { level: 2 }).textContent ?? "");
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("UI-T-050 Writing page (server render)", () => {
  it("/writing?format=email on the server lists all 12 samples with All current", async () => {
    const result = await renderServer("/writing?format=email", { source: createFixtureSource(), siteUrl: SITE_URL });
    const doc = new DOMParser().parseFromString(`<body>${result.html}</body>`, "text/html");
    expect(doc.querySelectorAll("main article")).toHaveLength(12);
    const currentChips = Array.from(doc.querySelectorAll('nav[aria-label="Filter by format"] a[aria-current="true"]'));
    expect(currentChips.map((a) => a.textContent)).toEqual(["All"]);
    const hrefs = Array.from(doc.querySelectorAll('nav[aria-label="Filter by format"] a')).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/writing",
      "/writing?format=blog",
      "/writing?format=web_copy",
      "/writing?format=email",
      "/writing?format=social",
      "/writing?format=landing_page",
      "/writing?format=newsletter",
    ]);
    expect(doc.querySelector('[aria-live="polite"]')?.textContent).toBe("");
  });
});

describe("UI-T-051 Writing page (client, after hydration)", () => {
  it("hydrating ?format=email shows only email samples, Email current and a live count", async () => {
    const result = await renderServer("/writing?format=email", { source: createFixtureSource(), siteUrl: SITE_URL });
    window.history.replaceState(null, "", "/writing?format=email");
    document.body.innerHTML = `<div id="root">${result.html}</div>${result.hydrationScript}`;
    const container = document.getElementById("root")!;
    const errors: unknown[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
    const routes = createRoutes(createFixtureSource());
    const router = createBrowserRouter(routes, {
      hydrationData: toHydrationState(readHydrationPayload(document)!, routes, window.location.pathname),
    });
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <RouterProvider router={router} />, { onRecoverableError: (e) => errors.push(e) });
    });

    const emails = fx.writingSamples.filter((s) => s.format === "email");
    await waitFor(() => expect(cardTitles()).toEqual(emails.map((s) => s.title)));
    expect(current()).toEqual(["Email"]);
    expect(screen.getByText(`Showing ${emails.length} email samples`)).toHaveAttribute("aria-live", "polite");
    expect(errors).toEqual([]);
    act(() => root?.unmount());
    router.dispose();
  });
});

describe("UI-T-052 Writing filter chip", () => {
  it("clicking Social sets ?format=social, filters the list and does not refetch", async () => {
    const user = userEvent.setup();
    const source = createFixtureSource();
    const spy = vi.spyOn(source, "get");
    const { router } = await renderRoute("/writing", source);
    expect(cardTitles()).toHaveLength(12);
    const callsBefore = spy.mock.calls.length;

    await user.click(within(filterNav()).getByRole("link", { name: "Social" }));
    await waitFor(() => expect(router.state.location.search).toBe("?format=social"));
    const socials = fx.writingSamples.filter((s) => s.format === "social");
    expect(cardTitles()).toEqual(socials.map((s) => s.title));
    expect(current()).toEqual(["Social"]);
    expect(screen.getByText(`Showing ${socials.length} social samples`)).toBeInTheDocument();
    expect(spy.mock.calls.length).toBe(callsBefore);

    // Back restores All (history navigation, still no refetch).
    await act(async () => {
      await router.navigate(-1);
    });
    expect(cardTitles()).toHaveLength(12);
    expect(current()).toEqual(["All"]);
    expect(screen.getByText("Showing all 12 samples")).toBeInTheDocument();
    expect(spy.mock.calls.length).toBe(callsBefore);
  });
});

describe("UI-T-053 Writing filter with no matches", () => {
  it("shows the empty state with a Show all link", async () => {
    const onlyBlog = fx.writingSamples.filter((s) => s.format === "blog");
    await renderRoute("/writing?format=email", createFixtureSource({ writing: () => ({ samples: onlyBlog }) }));
    expect(screen.getByRole("heading", { level: 2, name: "No samples in this format yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all" })).toHaveAttribute("href", "/writing");
    expect(cardTitles()).toEqual([]);
    expect(screen.getByText("Showing 0 email samples")).toBeInTheDocument();
  });

  it("no samples at all: coming-soon message and no filter bar", async () => {
    await renderRoute("/writing", createFixtureSource({ writing: () => ({ samples: [] }) }));
    expect(screen.getByRole("heading", { level: 2, name: "Writing samples coming soon" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Filter by format" })).toBeNull();
  });
});

describe("UI-T-054 unknown format", () => {
  it("?format=poetry lists every sample with All current and no error", async () => {
    await renderRoute("/writing?format=poetry");
    expect(cardTitles()).toHaveLength(12);
    expect(current()).toEqual(["All"]);
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it("writing cards show the Sample chip only when flagged", async () => {
    await renderRoute("/writing");
    const cards = within(screen.getByRole("main")).getAllByRole("article");
    cards.forEach((card, i) => {
      expect(within(card).queryByText("Sample") !== null).toBe(fx.writingSamples[i]!.is_sample);
    });
  });
});
