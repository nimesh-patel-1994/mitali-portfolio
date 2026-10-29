/**
 * Client entry (UI-002, TS-005 step 10).
 * - Pre-rendered public page: `__ROUTER_DATA__` present → `createBrowserRouter(routes, { hydrationData })` +
 *   `hydrateRoot` (loaders do not re-run for the first page).
 * - Admin shell and the Vite dev server: no data block → `createRoot` (client render).
 * Content source: production build reads `/data/<key>.json`; `npm run dev` composes data from the API via the
 * dev proxy (the API source is dynamically imported so it is not part of the production bundle).
 */
import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { ContentSource } from "./app/content-source";
import { createStaticContentSource } from "./app/content-source.static";
import { readHydrationPayload, toHydrationState } from "./app/hydration";
import { createRoutes } from "./app/routes";

async function createContentSource(): Promise<ContentSource> {
  if (import.meta.env.DEV) {
    const { createApiContentSource } = await import("./app/content-source.api");
    return createApiContentSource({ baseUrl: window.location.origin });
  }
  return createStaticContentSource();
}

async function start(): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing #root element");

  const routes = createRoutes(await createContentSource());
  const payload = readHydrationPayload(document);

  if (payload?.notFound) {
    // 404.html is served for any unknown URL; its markup was rendered for a probe path, so URL-dependent markup
    // (e.g. the active nav link) can differ. Render fresh from the embedded data instead of hydrating.
    const router = createBrowserRouter(routes, {
      hydrationData: toHydrationState(payload, routes, window.location.pathname),
    });
    createRoot(container).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
    return;
  }

  if (payload) {
    const router = createBrowserRouter(routes, {
      hydrationData: toHydrationState(payload, routes, window.location.pathname),
    });
    hydrateRoot(
      container,
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
    return;
  }

  const router = createBrowserRouter(routes);
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void start();
