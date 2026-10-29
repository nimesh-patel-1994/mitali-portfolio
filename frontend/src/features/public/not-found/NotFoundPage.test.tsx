import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render as renderServer } from "@/entry-server";
import { createFixtureSource } from "@/test/fixture-source";
import { renderRoute } from "@/test/render";

describe("UI-T-069 not-found page", () => {
  it("renders * with an h1, Back to home and View work links, and the page-not-found title", async () => {
    await renderRoute("/no/such/page");
    const main = screen.getByRole("main");
    const h1 = within(main).getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("This page took a day off");
    expect(h1.closest("section")).toHaveAttribute("data-surface", "deepest");
    expect(within(main).getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    expect(within(main).getByRole("link", { name: "View work" })).toHaveAttribute("href", "/work");
    await waitFor(() => expect(document.title).toBe("Page not found — Mitali"));
    // Floating header over the dark statement section.
    expect(screen.getByRole("banner")).not.toHaveAttribute("data-compact");
  });

  it("server render: noindex meta and title; the 404.html document render has status 404", async () => {
    const options = { source: createFixtureSource(), siteUrl: "https://mitali.example.com" };
    const page = await renderServer("/no/such/page", options);
    expect(page.head).toContain('<meta name="robots" content="noindex"');
    expect(page.head).toContain("<title>Page not found — Mitali</title>");
    expect(page.head).not.toContain('rel="canonical"');
    const doc = await renderServer("/__not-found__", { ...options, notFoundDocument: true });
    expect(doc.status).toBe(404);
    expect(doc.html).toContain("This page took a day off");
  });
});
