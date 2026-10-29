import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { createRoutes } from "@/app/routes";
import { createFixtureSource, fixtureData } from "@/test/fixture-source";

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

describe("UI-T-013 navigation indicator", () => {
  it("shows the progress bar after 150 ms with aria-busy on main, hidden after load", async () => {
    const pending = deferred<unknown>();
    await renderApp(createFixtureSource({ work: () => pending.promise }));
    const main = screen.getByRole("main");
    const bar = document.querySelector("[data-visible]")!;
    expect(bar).toHaveAttribute("data-visible", "false");
    expect(bar).toHaveAttribute("aria-hidden", "true");

    await userEvent.setup().click(screen.getAllByRole("link", { name: "Work" })[0]!);
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(bar).toHaveAttribute("data-visible", "false");
    await waitFor(() => expect(bar).toHaveAttribute("data-visible", "true"), { timeout: 1000 });

    await act(async () => pending.resolve(fixtureData("work")));
    await screen.findByRole("heading", { level: 1, name: "Work" });
    expect(main).not.toHaveAttribute("aria-busy");
    expect(bar).toHaveAttribute("data-visible", "false");
  });
});

describe("UI-002 layout on client navigation", () => {
  it("skip link is the first focusable element and targets main", async () => {
    await renderApp();
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Skip to content");
    expect(links[0]).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("updates the document title and moves focus to main after navigating", async () => {
    await renderApp();
    await waitFor(() => expect(document.title).toBe("Mitali — Content Writer & Marketing Strategist"));
    await userEvent.setup().click(screen.getAllByRole("link", { name: "About" })[0]!);
    await screen.findByRole("heading", { level: 1, name: /Clear words/ });
    await waitFor(() => expect(document.title).toBe("About — Mitali"));
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("loader 404 on client navigation shows the not-found page with its title", async () => {
    const router = await renderApp();
    await act(async () => {
      await router.navigate("/writing/unknown-sample");
    });
    expect(await screen.findByRole("heading", { level: 1, name: "This page took a day off" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Page not found — Mitali"));
  });
});
