/**
 * Public root layout (UI-002): skip link (first focusable element) → Header → <main id="main"> → Footer.
 * - Navigation pending: thin top progress bar after 150 ms; `aria-busy` on <main> while loading.
 * - Client navigation to a new path: document title updates from the route meta and focus moves to <main>.
 * Rendering is deterministic (no clocks, randomness or window reads during render).
 */
import { useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import {
  isRouteErrorResponse,
  Outlet,
  UNSAFE_DataRouterDataContext as DataRouterDataContext,
  useLocation,
  useMatches,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import type { SiteBundle } from "@/api/types";
import { a11y } from "@/features/public/content/copy";
import { resolveMeta } from "@/features/public/seo/meta";
import { useDelayedFlag } from "@/shared/hooks/useDelayedFlag";
import { Footer } from "./Footer";
import { Header } from "./Header";
import styles from "./RootLayout.module.css";

export const ROOT_ROUTE_ID = "root";
export const PROGRESS_DELAY_MS = 150;

export function useSiteData(): SiteBundle | undefined {
  return useRouteLoaderData(ROOT_ROUTE_ID) as SiteBundle | undefined;
}

/** Status of the current render derived from route errors (404 for loader not-found, 500 otherwise). */
function useRenderStatus(): number {
  // The layout cannot call useRouteError for its children; the data router state holds their errors.
  const state = useContext(DataRouterDataContext);
  const errors = state?.errors ? Object.values(state.errors) : [];
  if (errors.length === 0) return 200;
  return errors.some((e) => isRouteErrorResponse(e) && e.status === 404) ? 404 : 500;
}

/** Updates document.title after client navigations (the pre-rendered HTML already has the right title). */
function useDocumentTitle(site: SiteBundle | undefined, status: number): void {
  const matches = useMatches();
  const meta = resolveMeta(
    matches.map((m) => ({ pathname: m.pathname, handle: m.handle, loaderData: m.loaderData })),
    site,
    status,
  );
  useEffect(() => {
    if (document.title !== meta.title) document.title = meta.title;
  }, [meta.title]);
}

/** Moves focus to <main> when the path changes after the first render (route change announcement). */
function useFocusMainOnNavigation(mainRef: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    mainRef.current?.focus({ preventScroll: false });
  }, [pathname, mainRef]);
}

export interface PublicFrameProps {
  site: SiteBundle | undefined;
  children: ReactNode;
  /** HTTP-like status of the page for the document title; derived from route errors when omitted. */
  status?: number;
}

/** Shared frame for the layout route and its error boundary (header and footer stay visible on errors). */
export function PublicFrame({ site, children, status }: PublicFrameProps) {
  const derivedStatus = useRenderStatus();
  const navigation = useNavigation();
  const loading = navigation.state === "loading";
  const showProgress = useDelayedFlag(loading, PROGRESS_DELAY_MS);
  const mainRef = useRef<HTMLElement>(null);
  useDocumentTitle(site, status ?? derivedStatus);
  useFocusMainOnNavigation(mainRef);

  return (
    <>
      <a href="#main" className={styles.skipLink}>
        {a11y.skipToContent}
      </a>
      <div className={styles.progress} data-visible={showProgress ? "true" : "false"} aria-hidden="true" />
      <Header site={site} />
      <main id="main" tabIndex={-1} ref={mainRef} className={styles.main} aria-busy={loading ? true : undefined}>
        {children}
      </main>
      <Footer site={site} />
    </>
  );
}

export function RootLayout() {
  const site = useSiteData();
  return (
    <PublicFrame site={site}>
      <Outlet />
    </PublicFrame>
  );
}
