/**
 * Admin API client (UI-035, TS-016 note 2, SEC-UI-006): the generated `openapi-fetch` client with a fetch wrapper.
 * - `credentials: "same-origin"`; cookies carry the session (HttpOnly) — nothing in browser storage.
 * - Adds `X-CSRF-Token` (in-memory token) to every non-GET request.
 * - 403 `csrf_failed`: calls `getAdminMe` once to refresh the token and retries the request once; a second failure
 *   is returned to the caller.
 * - 401 on any request other than login/me: the session has ended → clear the token and notify the admin app
 *   (clears the query cache and navigates to login with `next`).
 */
import createClient from "openapi-fetch";
import type { components, paths } from "@/api/schema";
import { getCsrfToken, notifyUnauthorized, setCsrfToken } from "../session/session-store";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export const LOGIN_PATH = "/api/admin/auth/login";
export const ME_PATH = "/api/admin/auth/me";

function pathOf(request: Request): string {
  return new URL(request.url).pathname;
}

function send(request: Request): Promise<Response> {
  const token = getCsrfToken();
  if (!SAFE_METHODS.has(request.method) && token !== null) request.headers.set("X-CSRF-Token", token);
  return globalThis.fetch(request);
}

async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { error?: { code?: unknown } };
    return typeof body.error?.code === "string" ? body.error.code : null;
  } catch {
    return null;
  }
}

/** Fetches `getAdminMe` and stores the fresh CSRF token. Returns the `me` status (200 = refreshed). */
async function refreshCsrfToken(origin: string): Promise<number> {
  const response = await globalThis.fetch(new Request(`${origin}${ME_PATH}`, { credentials: "same-origin" }));
  if (!response.ok) return response.status;
  const session = (await response.json()) as components["schemas"]["AdminSession"];
  setCsrfToken(session.csrf_token);
  return response.status;
}

function isSessionEndpoint(path: string): boolean {
  return path === LOGIN_PATH || path === ME_PATH;
}

export async function adminFetch(request: Request): Promise<Response> {
  const path = pathOf(request);
  const retryCopy = SAFE_METHODS.has(request.method) || path === LOGIN_PATH ? null : request.clone();
  let response = await send(request);

  if (response.status === 403 && retryCopy !== null && (await errorCode(response)) === "csrf_failed") {
    const status = await refreshCsrfToken(new URL(request.url).origin);
    if (status === 200) response = await send(retryCopy);
    else if (status === 401) notifyUnauthorized();
  }

  if (response.status === 401 && !isSessionEndpoint(path)) notifyUnauthorized();
  return response;
}

function defaultBaseUrl(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function createAdminClient(baseUrl: string = defaultBaseUrl()) {
  return createClient<paths>({ baseUrl, credentials: "same-origin", fetch: adminFetch });
}

/** Lazily created so the base URL is read in the browser at first use. */
let shared: ReturnType<typeof createAdminClient> | null = null;

export function adminClient(): ReturnType<typeof createAdminClient> {
  shared ??= createAdminClient();
  return shared;
}
