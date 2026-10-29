/**
 * Hydration data (TS-005 steps 5 and 10, SEC-UI-002, UI-REV-022).
 * Serialized as a non-executed `<script type="application/json" id="__ROUTER_DATA__">` block with `<`, `>`, `&`,
 * U+2028 and U+2029 escaped, read back with `JSON.parse(textContent)`. React Router's own inline hydration
 * script is disabled (`StaticRouterProvider hydrate={false}`), so pages need no inline executable script (CSP).
 */
import {
  isRouteErrorResponse,
  matchRoutes,
  UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
  type HydrationState,
  type RouteObject,
} from "react-router";

export const ROUTER_DATA_ID = "__ROUTER_DATA__";

type SerializedError =
  | { __type: "RouteErrorResponse"; status: number; statusText: string; data: unknown }
  | { __type: "Error"; message: string };

export interface HydrationPayload {
  loaderData: Record<string, unknown>;
  actionData: Record<string, unknown> | null;
  errors: Record<string, SerializedError> | null;
  /** Set on `404.html`: the client marks the deepest matched route as a 404 before hydrating. */
  notFound?: boolean;
}

export function serializeErrors(errors: Record<string, unknown> | null | undefined): HydrationPayload["errors"] {
  if (!errors) return null;
  const out: Record<string, SerializedError> = {};
  for (const [routeId, error] of Object.entries(errors)) {
    if (isRouteErrorResponse(error)) {
      out[routeId] = {
        __type: "RouteErrorResponse",
        status: error.status,
        statusText: error.statusText,
        data: error.data ?? null,
      };
    } else {
      // Never serialize stack traces or internals into public HTML.
      out[routeId] = { __type: "Error", message: "Unexpected error" };
    }
  }
  return out;
}

export function deserializeErrors(errors: HydrationPayload["errors"]): HydrationState["errors"] {
  if (!errors) return null;
  const out: Record<string, unknown> = {};
  for (const [routeId, error] of Object.entries(errors)) {
    out[routeId] =
      error.__type === "RouteErrorResponse"
        ? new ErrorResponseImpl(error.status, error.statusText, error.data)
        : new Error(error.message);
  }
  return out;
}

const JSON_SCRIPT_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** JSON safe to embed inside a `<script type="application/json">` element. */
export function escapeJsonForHtml(json: string): string {
  return json.replace(/[<>&\u2028\u2029]/g, (ch) => JSON_SCRIPT_ESCAPES[ch] ?? ch);
}

export function serializeHydrationScript(payload: HydrationPayload): string {
  const json = escapeJsonForHtml(JSON.stringify(payload));
  return `<script type="application/json" id="${ROUTER_DATA_ID}">${json}</script>`;
}

/** Reads the payload from the document; null when absent (admin shell, dev server). */
export function readHydrationPayload(doc: Document): HydrationPayload | null {
  const element = doc.getElementById(ROUTER_DATA_ID);
  if (!element || element.getAttribute("type") !== "application/json") return null;
  const text = element.textContent;
  if (!text) return null;
  return JSON.parse(text) as HydrationPayload;
}

/**
 * Builds the router's `hydrationData`. For `404.html` (served for any unknown URL) the deepest matched route
 * that has a loader is marked with a 404 error, so the client renders the same not-found markup as the server
 * without running loaders for data that does not exist.
 */
export function toHydrationState(
  payload: HydrationPayload,
  routes: RouteObject[],
  pathname: string,
): HydrationState {
  const errors = deserializeErrors(payload.errors) ?? {};
  if (payload.notFound) {
    const matches = matchRoutes(routes, pathname) ?? [];
    const deepestWithLoader = [...matches].reverse().find((m) => m.route.loader && !(m.route.id! in payload.loaderData));
    if (deepestWithLoader?.route.id) {
      errors[deepestWithLoader.route.id] = new ErrorResponseImpl(404, "Not Found", null);
    }
  }
  return {
    loaderData: payload.loaderData,
    actionData: payload.actionData,
    errors: Object.keys(errors).length > 0 ? errors : null,
  };
}
