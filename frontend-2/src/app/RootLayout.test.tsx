/** UI-103 (port of frontend/ UI-T-013 and the UI-002 layout checks): progress bar, skip link, title and focus. */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { createFixtureSource, fixtureData } from "@/test/fixture-source";
import { createRoutes } from "./routes";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function renderApp(source = createFixtureSource()) {
  const router = createMemoryRouter(createRoutes(source), { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
}

describe("UI-103 navigation indicator (port of UI-T-013)", () => {
  it("shows the progress bar after 150 ms with aria-busy on main, hidden after load", async () => {
    const pending = deferred<unknown>();
    await renderApp(createFixtureSource({ "work/case-study-1": () => pending.promise }));
    const main = screen.getByRole("main");
    const bar = document.querySelector("[data-visible]")!;
    expect(bar).toHaveAttribute("data-visible", "false");
    expect(bar).toHaveAttribute("aria-hidden", "true");

    const featured = screen.getByRole("region", { name: "Selected work" });
    await userEvent.setup().click(within(featured).getByRole("link", { name: /Case study 1/ }));
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(bar).toHaveAttribute("data-visible", "false");
    await waitFor(() => expect(bar).toHaveAttribute("data-visible", "true"), { timeout: 1000 });

    await act(async () => pending.resolve(fixtureData("work/case-study-1")));
    await screen.findByRole("heading", { level: 1, name: "Case study 1" });
    expect(main).not.toHaveAttribute("aria-busy");
    expect(bar).toHaveAttribute("data-visible", "false");
  });
});

describe("UI-103 layout on client navigation", () => {
  it("skip link first, main focusable; title and focus follow navigation; 404 title on unknown slug", async () => {
    const router = await renderApp();
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Skip to content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(document.title).toBe("Mitali — Content Writer & Marketing Strategist"));

    await act(async () => {
      await router.navigate("/work/case-study-2");
    });
    await screen.findByRole("heading", { level: 1, name: "Case study 2" });
    await waitFor(() => expect(document.title).toBe("Case study 2 — Mitali"));
    expect(document.activeElement).toBe(screen.getByRole("main"));

    await act(async () => {
      await router.navigate("/work/unknown-one");
    });
    expect(await screen.findByRole("heading", { level: 1, name: "This page took a day off" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Page not found — Mitali"));
  });
});
