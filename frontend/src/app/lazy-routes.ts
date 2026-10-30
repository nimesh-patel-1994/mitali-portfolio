/**
 * Resolves the `lazy` route modules matched by `pathname` in place, so a router created afterwards starts
 * initialised and can hydrate pre-rendered markup without a fallback render (no hydration mismatch). Used by the
 * client entry before `hydrateRoot`/`createRoot` for the first page; later navigations load lazily as usual.
 */
import { matchRoutes, type RouteObject } from "react-router";

/** Route properties a lazy module may supply; other exports of the module are ignored. */
const LAZY_KEYS = [
  "Component",
  "element",
  "ErrorBoundary",
  "errorElement",
  "HydrateFallback",
  "hydrateFallbackElement",
  "loader",
  "action",
  "handle",
  "shouldRevalidate",
] as const;

export async function resolveLazyMatches(routes: RouteObject[], pathname: string): Promise<void> {
  const matches = matchRoutes(routes, pathname) ?? [];
  await Promise.all(
    matches.map(async ({ route }) => {
      const lazy = route.lazy;
      if (typeof lazy !== "function") return;
      const resolved = (await lazy()) as Partial<Record<(typeof LAZY_KEYS)[number], unknown>>;
      const picked: Record<string, unknown> = {};
      for (const key of LAZY_KEYS) {
        if (resolved[key] !== undefined) picked[key] = resolved[key];
      }
      Object.assign(route, picked, { lazy: undefined });
    }),
  );
}
