/**
 * Admin session state held in module memory only (UI-035, SEC-UI-006, UI-REV-014).
 * - The CSRF token comes from `adminLogin` / `getAdminMe` and is sent as `X-CSRF-Token` on every non-GET request.
 *   It is never written to localStorage, sessionStorage, IndexedDB, URLs or cookies by the app.
 * - The admin app registers one handler for "the session has ended" (any 401 outside login/me): it clears the
 *   query cache and navigates to the login page with `next`.
 */

let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

/** Registers the session-ended handler; returns an unregister function. */
export function setUnauthorizedHandler(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function notifyUnauthorized(): void {
  clearCsrfToken();
  unauthorizedHandler?.();
}
