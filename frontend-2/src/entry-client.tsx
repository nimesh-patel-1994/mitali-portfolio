/**
 * Client entry (UI-103, TS-026; behaviour of frontend/ TS-005 step 10).
 * - Pre-rendered page (PH-3): `__ROUTER_DATA__` present → `createBrowserRouter(routes, { hydrationData })` +
 *   `hydrateRoot`. Dev server: no data block → `createRoot`.
 * - Content source: production reads `/data/<key>.json`; `npm run dev` composes data from the API via the dev proxy
 *   (the API source is dynamically imported so it is not part of the production bundle).
 * - After the first render `initMotion()` turns the reveal motion on (TS-022; never an inline script).
 * - Development only: the reviewer aids (white-base switch, view-transition toggle, type specimen link) are loaded
 *   behind `import.meta.env.DEV`, which is false in builds (the import disappears; scripts/check-dist.ts).
 */
import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { ContentSource } from "./app/content-source";
import { createStaticContentSource } from "./app/content-source.static";
import { readHydrationPayload, toHydrationState } from "./app/hydration";
import { resolveLazyMatches } from "./app/lazy-routes";
import { createRoutes } from "./app/routes";
import { initMotion } from "./shared/motion/reveal";

async function createContentSource(): Promise<ContentSource> {
  if (import.meta.env.DEV) {
    const { createApiContentSource } = await import("./app/content-source.api");
    return createApiContentSource({ baseUrl: window.location.origin });
  }
  return createStaticContentSource();
}

/** Turns motion on once the first render has committed (reveals are progressive enhancement). */
function startMotionAfterPaint(): void {
  window.requestAnimationFrame(() => {
    initMotion();
  });
}

async function start(): Promise<void> {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing #root element");

  if (import.meta.env.DEV) {
    const { installReviewTools } = await import("./dev/review-switch");
    installReviewTools();
  }

  const routes = createRoutes(await createContentSource());
  const payload = readHydrationPayload(document);
  await resolveLazyMatches(routes, window.location.pathname);

  if (payload) {
    const router = createBrowserRouter(routes, {
      hydrationData: toHydrationState(payload, routes, window.location.pathname),
    });
    const app = (
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    );
    // 404.html is served for any unknown URL: render fresh from its data instead of hydrating (as frontend/).
    if (payload.notFound) createRoot(container).render(app);
    else hydrateRoot(container, app);
    startMotionAfterPaint();
    return;
  }

  const router = createBrowserRouter(routes);
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  startMotionAfterPaint();
}

void start();
