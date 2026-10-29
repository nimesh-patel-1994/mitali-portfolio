/** Test helpers: render components inside a memory data router, or the full public route tree from fixtures. */
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createRoutes } from "@/app/routes";
import type { ContentSource } from "@/app/content-source";
import { createFixtureSource } from "./fixture-source";

export function renderWithRouter(ui: ReactElement, path = "/") {
  const router = createMemoryRouter([{ path: "*", element: ui }], { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}

/** Renders the real public route tree at `path` with fixture data and waits for the page's h1. */
export async function renderRoute(path: string, source: ContentSource = createFixtureSource()) {
  const router = createMemoryRouter(createRoutes(source), { initialEntries: [path] });
  const result = render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return { router, ...result };
}
