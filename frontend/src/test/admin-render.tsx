/** Test helpers for the admin app: MSW server with the contract-shaped admin handlers and a memory-router render. */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, afterEach, beforeAll } from "vitest";
import { createAdminQueryClient } from "@/features/admin/api/query";
import { AdminApp, ErrorBoundary } from "@/features/admin/routes";
import { clearCsrfToken, setCsrfToken } from "@/features/admin/session/session-store";
import { ToastProvider } from "@/features/admin/ui/Toast";
import { adminHandlers, resetAdminDb } from "./admin-handlers";
import { SESSION } from "./admin-fixtures";

/** Starts an MSW server for the file; resets the store, recorded requests and the in-memory CSRF token per test. */
export function setupAdminServer() {
  const server = setupServer(...adminHandlers());
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => {
    server.resetHandlers();
    resetAdminDb();
    clearCsrfToken();
  });
  afterAll(() => server.close());
  return server;
}

/** Query client as in production, but retries of network/5xx failures run without the back-off delay. */
export function createTestQueryClient() {
  return createAdminQueryClient({ retryDelay: 0 });
}

/** Typing without per-key delays (the default 0 ms delay still yields to timers between keys). */
export function setupUser() {
  return userEvent.setup({ delay: null });
}

/**
 * Fills a field the way a paste does (one input event): for fields that are not under test, so slow per-key typing
 * is kept for the fields whose behaviour a test checks.
 */
export async function pasteInto(user: ReturnType<typeof setupUser>, element: HTMLElement, text: string) {
  await user.click(element);
  await user.paste(text);
}

/** Renders the whole admin app at `path` (public routes replaced by a stub). */
export function renderAdmin(path = "/admin") {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(
    [
      { path: "/admin/*", element: <AdminApp queryClient={queryClient} />, ErrorBoundary },
      { path: "*", element: <p>Public site stub</p> },
    ],
    { initialEntries: [path] },
  );
  const user = setupUser();
  const result = render(<RouterProvider router={router} />);
  return { router, user, queryClient, ...result };
}

/** Renders the admin app and waits for the screen's h1 (session check done). */
export async function renderAdminPage(path: string, heading?: string | RegExp) {
  const rendered = renderAdmin(path);
  await screen.findByRole("heading", { level: 1, ...(heading ? { name: heading } : {}) });
  return rendered;
}

/** Renders a component with a query client, toasts and a memory router (CSRF token set as after login). */
export function renderWithAdminProviders(ui: ReactElement, path = "/admin/test") {
  setCsrfToken(SESSION.csrf_token);
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <QueryClientProvider client={queryClient}>
            <ToastProvider>{ui}</ToastProvider>
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  const user = setupUser();
  const result = render(<RouterProvider router={router} />);
  return { router, user, queryClient, ...result };
}

/** Finds visible text and returns its enclosing live region (`role="alert"` or `role="status"`). */
export async function findInRegion(text: string | RegExp, role: "alert" | "status" = "alert"): Promise<HTMLElement> {
  const el = await screen.findByText(text);
  const region = el.closest(`[role="${role}"]`);
  if (!(region instanceof HTMLElement)) throw new Error(`"${String(text)}" is not inside role=${role}`);
  return region;
}
