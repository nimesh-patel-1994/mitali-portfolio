/**
 * Public root layout (UI-103, TS-026; behaviour ported from frontend/ UI-002): skip link (first focusable element)
 * → Header → <main id="main"> → Footer.
 * - Navigation pending: thin top progress bar after 150 ms; `aria-busy` on <main> while loading.
 * - Client navigation to a new path: the document title updates from the route meta; push/replace navigations
 *   scroll to the top, back/forward (POP) keeps the browser's position; focus then moves to <main> without
 *   scrolling. These steps run the same with or without a view transition (TS-024, REQ-094). No
 *   <ScrollRestoration> (it uses sessionStorage).
 * - Pages that do not start on the base surface (not found, errors, or a route handle `solidHeader`) get a solid
 *   header from the start, so the header's ink text never sits on a deep surface.
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
  useNavigationType,
  useRouteLoaderData,
} from "react-router";
import type { SiteBundle } from "@/api/types";
import { a11y } from "@/features/public/content/copy";
import { Footer } from "@/features/public/layout/Footer/Footer";
import { Header } from "@/features/public/layout/Header/Header";
import { resolveMeta } from "@/features/public/seo/meta";
import { useDelayedFlag } from "@/shared/hooks/useDelayedFlag";
import styles from "./RootLayout.module.css";

export const ROOT_ROUTE_ID = "root";
export const PROGRESS_DELAY_MS = 150;

/** Route handles may set `solidHeader: true` when the page does not start on the base surface. */
export interface HeaderHandle {
  solidHeader?: boolean;
}

export function useSiteData(): SiteBundle | undefined {
  return useRouteLoaderData(ROOT_ROUTE_ID) as SiteBundle | undefined;
}

/** Status of the current render derived from route errors (404 for loader not-found, 500 otherwise). */
function useRenderStatus(): number {
  const state = useContext(DataRouterDataContext);
  const errors = state?.errors ? Object.values(state.errors) : [];
  if (errors.length === 0) return 200;
  return errors.some((e) => isRouteErrorResponse(e) && e.status === 404) ? 404 : 500;
}

function useSolidHeaderHandle(): boolean {
  const deepest = useMatches().at(-1);
  const handle = deepest?.handle;
  return typeof handle === "object" && handle !== null && (handle as HeaderHandle).solidHeader === true;
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

/** After a path change: scroll to the top unless POP, then focus <main> with `preventScroll`. */
function useFocusMainOnNavigation(mainRef: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (navigationType !== "POP") window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, navigationType, mainRef]);
}

export interface PublicFrameProps {
  site: SiteBundle | undefined;
  children: ReactNode;
  /** HTTP-like status of the page; derived from route errors when omitted. */
  status?: number;
}

/** Shared frame for the layout route and its error boundary (header and footer stay visible on errors). */
export function PublicFrame({ site, children, status }: PublicFrameProps) {
  const derivedStatus = useRenderStatus();
  const effectiveStatus = status ?? derivedStatus;
  const solidHandle = useSolidHeaderHandle();
  const navigation = useNavigation();
  const loading = navigation.state === "loading";
  const showProgress = useDelayedFlag(loading, PROGRESS_DELAY_MS);
  const mainRef = useRef<HTMLElement>(null);
  useDocumentTitle(site, effectiveStatus);
  useFocusMainOnNavigation(mainRef);

  return (
    <>
      <a href="#main" className={styles.skipLink}>
        {a11y.skipToContent}
      </a>
      <div className={styles.progress} data-visible={showProgress ? "true" : "false"} aria-hidden="true" />
      <Header site={site} solid={solidHandle || effectiveStatus !== 200} />
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
