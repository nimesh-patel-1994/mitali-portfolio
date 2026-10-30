/**
 * Admin layout, guard, sidebar and logout (UI-037, DES-042, REQ-060).
 * - Guard: `getAdminMe`; while checking → full-page spinner; 401 → `/admin/login?next=<path>`; other errors → retry.
 * - Dark-olive sidebar (green wordmark, `<nav aria-label="Admin">`, active link `aria-current="page"` with a green
 *   marker, Enquiries badge "N new" from the shared dashboard query, "View site" in a new tab, "Log out").
 * - Log out with unsaved edits on the page asks "Discard unsaved changes?" first (Keep editing = no logout); a
 *   confirmed logout bypasses every page guard so the move to the login page cannot be blocked.
 * - Below 810 px the sidebar becomes a top bar with a Menu button opening a drawer dialog (focus trap, Escape).
 * - Light content area (`data-surface="white"`); each screen sets the title and focuses its h1 (`AdminPage`, with
 *   `preventScroll`). On a push/replace navigation to a new path the window scrolls to the top; back/forward (POP)
 *   and search-only changes (list filters, pages) do not scroll. No <ScrollRestoration> (sessionStorage, UI-REV-014).
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigationType } from "react-router";
import { CloseIcon, MenuIcon } from "@/shared/ui/Icon/Icon";
import { Wordmark } from "@/shared/ui/Wordmark/Wordmark";
import { cx } from "@/shared/utils/cx";
import { dashboardApi } from "../api/admin-api";
import { isApiError } from "../api/errors";
import { adminKeys } from "../api/query";
import { loginPathFor } from "../session/next-path";
import { useAdminMe, useLogout } from "../session/useSession";
import { ConfirmDialog, Dialog } from "../ui/Dialog";
import { GuardRegistryProvider, useGuardRegistry } from "../ui/UnsavedChangesGuard";
import { ErrorState, LoadingState } from "../ui/states";
import styles from "./AdminLayout.module.css";

export const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/case-studies", label: "Case studies" },
  { to: "/admin/writing", label: "Writing" },
  { to: "/admin/services", label: "Services" },
  { to: "/admin/engagement-models", label: "Engagement models" },
  { to: "/admin/testimonials", label: "Testimonials" },
  { to: "/admin/faqs", label: "FAQs" },
  { to: "/admin/values", label: "Values" },
  { to: "/admin/process-steps", label: "Process steps" },
  { to: "/admin/profile", label: "Profile" },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/enquiries", label: "Enquiries", badge: true },
] as const;

export const ADMIN_HOME_LABEL = "Mitali admin, dashboard";

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: adminKeys.dashboard,
    queryFn: dashboardApi.getAdminDashboard,
    refetchOnWindowFocus: true,
    enabled,
  });
}

function AdminNav({ newEnquiries, onLogout }: { newEnquiries: number; onLogout: () => void }) {
  return (
    <>
      <nav aria-label="Admin" className={styles.nav}>
        <ul className={styles.navList}>
          {ADMIN_NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={"end" in item ? item.end : false} className={styles.navLink}>
                <span>{item.label}</span>
                {"badge" in item && newEnquiries > 0 && <span className={styles.badge}>{newEnquiries} new</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.navFooter}>
        <a href="/" target="_blank" rel="noopener noreferrer" className={styles.navLink}>
          View site <span className="visually-hidden">(opens in a new tab)</span>
        </a>
        <button type="button" className={styles.logout} onClick={onLogout}>
          Log out
        </button>
      </div>
    </>
  );
}

/** Scrolls to the top after a push/replace navigation to another path (not on POP or search-only changes). */
function useScrollTopOnNavigation(pathname: string): void {
  const navigationType = useNavigationType();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [pathname, navigationType]);
}

export function AdminLayout() {
  // While logging out the session query must not refetch: `logout` clears the cache before navigating, and a
  // refetch from this still-mounted layout would store a CSRF token again after a failed logout (UI-T-076).
  const [loggingOut, setLoggingOut] = useState(false);
  const me = useAdminMe(!loggingOut);
  const location = useLocation();
  useScrollTopOnNavigation(location.pathname);
  const logout = useLogout();
  // Only after the session check, so a signed-out visit is a plain redirect (no "session ended" notice).
  const dashboard = useDashboard(me.isSuccess);
  const [drawerOpenAt, setDrawerOpenAt] = useState<string | null>(null);
  const guards = useGuardRegistry();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const here = `${location.pathname}${location.search}`;
  const drawerOpen = drawerOpenAt === here;

  // Safety net: once logging out with no session data left, always end on the login page.
  if (loggingOut && !me.data) {
    return <Navigate to="/admin/login" replace state={{ loggedOut: true }} />;
  }

  if (me.isPending) {
    return (
      <div className={styles.checking} data-surface="white">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (me.isError) {
    if (isApiError(me.error) && me.error.status === 401) {
      return <Navigate to={loginPathFor(here)} replace />;
    }
    return (
      <main id="main" className={styles.checking} data-surface="white">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} title="The admin could not start" />
      </main>
    );
  }

  const newEnquiries = dashboard.data?.new_enquiries ?? 0;
  const startLogout = () => {
    // Confirmed (or nothing unsaved): the navigation to the login page must not be blocked by any page guard.
    guards.bypassAll();
    setConfirmLogout(false);
    setLoggingOut(true);
    void logout();
  };
  // Unsaved edits: ask first; "Keep editing" cancels the logout entirely (no API call).
  const onLogout = () => {
    if (guards.anyDirty()) setConfirmLogout(true);
    else startLogout();
  };

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <aside className={styles.sidebar} data-surface="dark">
        <Wordmark size="admin" to="/admin" label={ADMIN_HOME_LABEL} />
        <AdminNav newEnquiries={newEnquiries} onLogout={onLogout} />
      </aside>

      <header className={styles.topbar} data-surface="dark">
        <Wordmark size="admin" to="/admin" label={ADMIN_HOME_LABEL} />
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          onClick={() => setDrawerOpenAt(here)}
        >
          <MenuIcon /> Menu
        </button>
      </header>

      {drawerOpen && (
        <Dialog title="Admin menu" onClose={() => setDrawerOpenAt(null)}>
          <div className={cx(styles.drawer)} data-surface="dark">
            <button type="button" className={styles.menuButton} onClick={() => setDrawerOpenAt(null)}>
              <CloseIcon /> Close menu
            </button>
            <AdminNav newEnquiries={newEnquiries} onLogout={onLogout} />
          </div>
        </Dialog>
      )}

      <main id="main" tabIndex={-1} className={styles.main} data-surface="white">
        <GuardRegistryProvider value={guards.registry}>
          <Outlet />
        </GuardRegistryProvider>
      </main>

      {confirmLogout && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="This page has changes that have not been saved. If you log out now they will be lost."
          confirmLabel="Discard and log out"
          cancelLabel="Keep editing"
          onConfirm={startLogout}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}
