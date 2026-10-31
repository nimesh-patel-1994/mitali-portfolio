/**
 * AppLink / AppNavLink (TS-024, REQ-094, UI-104): every internal link of the public site goes through these, so a
 * navigation requests React Router's view transition (`viewTransition` on Link/NavLink). React Router uses
 * `document.startViewTransition` only where it exists; elsewhere navigation is instant. The cross-fade itself is
 * plain CSS (motion.css) and is switched off under reduced motion. Focus to <main>, title update and scroll reset
 * stay in RootLayout and run the same with or without the transition.
 * In development the reviewer panel (src/dev) can switch transitions off for comparison (in-memory flag); in production
 * builds the flag code is dead and removed (`import.meta.env.DEV`).
 */
import { forwardRef, type ComponentProps } from "react";
import { Link, NavLink } from "react-router";
import { useDevViewTransitions } from "@/dev/review-state";

/** True when links should request a view transition. Always true in production. */
export const useViewTransitionPreference: () => boolean = import.meta.env.DEV ? useDevViewTransitions : () => true;

export type AppLinkProps = Omit<ComponentProps<typeof Link>, "viewTransition">;

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(props, ref) {
  const viewTransition = useViewTransitionPreference();
  return <Link ref={ref} viewTransition={viewTransition} {...props} />;
});

export type AppNavLinkProps = Omit<ComponentProps<typeof NavLink>, "viewTransition">;

export const AppNavLink = forwardRef<HTMLAnchorElement, AppNavLinkProps>(function AppNavLink(props, ref) {
  const viewTransition = useViewTransitionPreference();
  return <NavLink ref={ref} viewTransition={viewTransition} {...props} />;
});
