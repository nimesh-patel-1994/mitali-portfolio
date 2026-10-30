/**
 * Server entry (UI-002, UI-004, TS-005 step 4) used by `scripts/prerender.ts` through the Vite SSR build.
 * `render(url)` runs React Router's static handler with the content source, renders the route to HTML and
 * returns `{ html, head, hydrationScript, status }`.
 * `StaticRouterProvider hydrate={false}` stops React Router from emitting its inline executable hydration script;
 * the escaped JSON block from `serializeHydrationScript` is used instead (SEC-UI-002, CSP).
 */
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router";
import type { SiteBundle } from "@/api/types";
import { createApiContentSource } from "@/app/content-source.api";
import { createRecordingSource, type ContentSource } from "@/app/content-source";
import { serializeErrors, serializeHydrationScript, type HydrationPayload } from "@/app/hydration";
import { createRoutes, ROUTE_IDS } from "@/app/routes";
export { LAZY_ROUTE_MODULES } from "@/app/routes";
import { buildHead } from "@/features/public/seo/head";
import { notFoundMeta, resolveMeta, type PageMeta } from "@/features/public/seo/meta";

export { createApiContentSource, createRecordingSource };
export { buildSitemap, buildRobots, buildAdminHead } from "@/features/public/seo/site-files";

export interface RenderOptions {
  source: ContentSource;
  /** Canonical origin (`VITE_SITE_URL`). */
  siteUrl: string;
  /** Render the `*` route as the 404 document (`404.html`): status 404, noindex, client marks the route 404. */
  notFoundDocument?: boolean;
}

export interface RenderResult {
  status: number;
  html: string;
  head: string;
  meta: PageMeta;
  hydrationScript: string;
  hydration: HydrationPayload;
  /** Ids of the matched routes (outermost first); the pre-render adds asset links for lazy ones. */
  routeIds: string[];
}

/** Origin only used to build the Request for the static handler; never appears in output. */
const INTERNAL_ORIGIN = "http://prerender.invalid";

export async function render(url: string, options: RenderOptions): Promise<RenderResult> {
  const routes = createRoutes(options.source);
  const handler = createStaticHandler(routes);
  const request = new Request(new URL(url, INTERNAL_ORIGIN));
  const context = await handler.query(request);
  if (context instanceof Response) {
    throw new Error(`Route ${url} returned a redirect/response (${context.status}); public routes must render HTML`);
  }

  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(
    <StrictMode>
      <StaticRouterProvider router={router} context={context} hydrate={false} />
    </StrictMode>,
  );

  const status = options.notFoundDocument ? 404 : context.statusCode;
  const site = context.loaderData[ROUTE_IDS.root] as SiteBundle | undefined;
  const meta = options.notFoundDocument
    ? notFoundMeta
    : resolveMeta(
        context.matches.map((m) => ({
          pathname: m.pathname,
          handle: m.route.handle,
          loaderData: context.loaderData[m.route.id],
        })),
        site,
        status,
      );

  const hydration: HydrationPayload = {
    loaderData: context.loaderData,
    actionData: context.actionData,
    errors: serializeErrors(context.errors),
    ...(options.notFoundDocument ? { notFound: true } : {}),
  };

  return {
    status,
    html,
    head: buildHead(meta, options.siteUrl),
    meta,
    hydrationScript: serializeHydrationScript(hydration),
    hydration,
    routeIds: context.matches.map((m) => m.route.id),
  };
}
