/**
 * Page meta (UI-004, TS-005 step 4). Each public route declares `handle.meta(loaderData, site)`; the deepest
 * match with a meta function wins. Loader 404s and route errors get fixed `noindex` meta.
 */
import type { ImageRef, SiteBundle } from "@/api/types";
import { pages } from "@/features/public/content/copy";

export interface PageMeta {
  /** Full document title (already in the `<Page> — Mitali` pattern). */
  title: string;
  description: string;
  /** Route path used for canonical and og:url; null for pages without a canonical (404, error). */
  path: string | null;
  image?: ImageRef | null;
  type: "website" | "article";
  noindex?: boolean;
}

export type RouteMeta = Omit<PageMeta, "path" | "type"> & { type?: PageMeta["type"] };

export type MetaFunction<Data> = (data: Data, site: SiteBundle | undefined) => RouteMeta;

export interface RouteHandle {
  meta?: MetaFunction<never>;
}

/** Typed helper for route handles: `handle: defineMeta<HomeData>((data, site) => ({ ... }))`. */
export function defineMeta<Data>(meta: MetaFunction<Data>): RouteHandle {
  return { meta: meta as MetaFunction<never> };
}

export interface MetaMatch {
  pathname: string;
  handle: unknown;
  loaderData: unknown;
}

export const notFoundMeta: PageMeta = {
  title: pages.notFound.title,
  description: pages.notFound.description,
  path: null,
  type: "website",
  noindex: true,
};

export const errorMeta: PageMeta = {
  title: pages.error.title,
  description: pages.error.description,
  path: null,
  type: "website",
  noindex: true,
};

/** Canonical path: no trailing slash except the root. */
export function canonicalPath(pathname: string): string {
  if (pathname === "/" || pathname === "") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function hasMeta(handle: unknown): handle is { meta: MetaFunction<unknown> } {
  return typeof handle === "object" && handle !== null && typeof (handle as RouteHandle).meta === "function";
}

/**
 * Resolves the meta for the current matches. `status` is the HTTP status of the render
 * (404 → not-found meta, ≥ 400 → error meta).
 */
export function resolveMeta(matches: MetaMatch[], site: SiteBundle | undefined, status = 200): PageMeta {
  if (status === 404) return notFoundMeta;
  if (status >= 400) return errorMeta;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    if (match && hasMeta(match.handle)) {
      let meta: RouteMeta;
      try {
        meta = match.handle.meta(match.loaderData, site);
      } catch {
        return errorMeta;
      }
      return {
        ...meta,
        type: meta.type ?? "website",
        path: meta.noindex ? null : canonicalPath(match.pathname),
      };
    }
  }
  return { ...pages.home, path: canonicalPath(matches.at(-1)?.pathname ?? "/"), type: "website" };
}
