/**
 * Session query and actions (UI-035..UI-037). `getAdminMe` stores the CSRF token in memory on success.
 * Logout always clears the cache and the token and goes to login, even when the request fails (UI-T-076).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { authApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import { clearCsrfToken, setCsrfToken, setUnauthorizedHandler } from "./session-store";
import { loginPathFor } from "./next-path";

export const SESSION_ENDED_MESSAGE = "Your session has ended. Please log in again.";

export interface LoginLocationState {
  sessionEnded?: boolean;
  /** Set after "Log out": the login page then skips the already-logged-in check (even if logout failed). */
  loggedOut?: boolean;
}

async function fetchMe() {
  const session = await authApi.getAdminMe();
  setCsrfToken(session.csrf_token);
  return session;
}

export function useAdminMe(enabled = true) {
  return useQuery({ queryKey: adminKeys.me, queryFn: fetchMe, retry: false, staleTime: 60_000, enabled });
}

/** Registers the global "session ended" handler (401 outside login/me) for the admin app. */
export function useSessionEndedRedirect(): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(`${location.pathname}${location.search}`);

  useEffect(() => {
    pathRef.current = `${location.pathname}${location.search}`;
  }, [location.pathname, location.search]);

  useEffect(
    () =>
      setUnauthorizedHandler(() => {
        queryClient.clear();
        clearCsrfToken();
        // Already on the login page (e.g. a late response): keep its `next` and do not navigate again.
        if (pathRef.current.startsWith("/admin/login")) return;
        const state: LoginLocationState = { sessionEnded: true };
        navigate(loginPathFor(pathRef.current), { replace: true, state });
      }),
    [queryClient, navigate],
  );
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await authApi.adminLogout();
    } catch {
      // Logout failure still ends the session in this browser (UI-037).
    } finally {
      queryClient.clear();
      clearCsrfToken();
      const state: LoginLocationState = { loggedOut: true };
      navigate("/admin/login", { replace: true, state });
    }
  }, [queryClient, navigate]);
}
