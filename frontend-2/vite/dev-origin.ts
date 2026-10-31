/**
 * Dev-only Origin rewrite for the frontend-2 Vite dev server (TS-027, SD-112, SEC-UI-014, UI-REV-029).
 *
 * The backend's Origin allow-list (SEC-BE-004 layer 2, `ALLOWED_ORIGINS`) contains the 5173 and 8000 origins only,
 * and the user decided not to change it or any `.env`. So, in the Vite **dev server** proxy only, `/api/admin`
 * requests whose `Origin` is exactly the frontend-2 dev origin are forwarded with the backend's own origin.
 *
 * Rules (each one is pinned by vite/dev-origin.test.ts):
 * - only the `Origin` header changes (never `Referer`, `Host` or cookies);
 * - only for `/api/admin` and `/api/admin/...` (not `/api/administrator`, not public paths);
 * - only when the incoming Origin is `http://localhost:5174` or `http://127.0.0.1:5174`; any other Origin (or none)
 *   is passed through unchanged, so the backend still rejects foreign origins with `403 origin_rejected`;
 * - wired only for `vite` serve (never `vite preview` or a build) from vite.config.ts; nothing in `src/` imports
 *   this module, so the build output cannot contain it (dist scan, scripts/check-dist.ts);
 * - it never logs anything (no headers, no cookies).
 */
import type { ClientRequest, IncomingMessage } from "node:http";

/** The backend origin the rewritten requests carry (in `ALLOWED_ORIGINS`). */
export const BACKEND_ORIGIN = "http://127.0.0.1:8000";

/** The only two origins that are rewritten: the frontend-2 dev server. */
export const DEV_ORIGINS: readonly string[] = ["http://localhost:5174", "http://127.0.0.1:5174"];

const ADMIN_PREFIX = "/api/admin";

/** True for `/api/admin` and `/api/admin/...` (query string ignored); false for e.g. `/api/administrator`. */
export function isAdminApiPath(path: string): boolean {
  const pathname = path.split("?")[0]?.split("#")[0] ?? "";
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

/**
 * Pure rewrite rule: returns the backend origin only for an admin path with a frontend-2 dev origin; otherwise the
 * incoming origin unchanged (including `undefined`).
 */
export function devAdminOrigin(path: string, origin: string | undefined): string | undefined {
  if (origin !== undefined && isAdminApiPath(path) && DEV_ORIGINS.includes(origin)) return BACKEND_ORIGIN;
  return origin;
}

/** The subset of the proxy server API this module uses (Vite 8.3 emits `proxyReq` on its proxy). */
export interface ProxyLike {
  on(
    event: "proxyReq",
    listener: (proxyReq: Pick<ClientRequest, "setHeader">, req: Pick<IncomingMessage, "url" | "headers">) => void,
  ): unknown;
}

/** Attaches the rewrite to the `/api` proxy entry (`configure` hook). Logs nothing. */
export function wireDevOriginRewrite(proxy: ProxyLike): void {
  proxy.on("proxyReq", (proxyReq, req) => {
    const incoming = req.headers.origin;
    const origin = Array.isArray(incoming) ? incoming[0] : incoming;
    const next = devAdminOrigin(req.url ?? "", origin);
    if (next !== undefined && next !== origin) proxyReq.setHeader("origin", next);
  });
}
