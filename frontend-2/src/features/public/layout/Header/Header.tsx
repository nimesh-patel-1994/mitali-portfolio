/**
 * Header (UI-105, REQ-085, REQ-002, REQ-003 as varied by REQ-082, TS-023 steps 1-2, DES-056, DES-065).
 * - Fixed, on the base surface: transparent at the top, compact (64 px, base background + bottom hairline) once a
 *   zero-height sentinel at the header's height has left the viewport (IntersectionObserver, as frontend/ UI-019).
 *   Pages that do not start on the base surface (not-found, error) ask for a solid header (`solid`).
 * - Hides on scroll down and comes back on scroll up through the single passive, once-per-frame scroll listener of
 *   SD-118 (`watchScrollDirection`, which toggles `data-hidden` directly on the element: no re-render). Never hidden
 *   while it contains focus or while the mobile menu is open; never hidden under reduced motion.
 * - Wordmark → Home; `<nav aria-label="Main">` (Work current on /work/*, Writing on /writing/*); Book a call.
 *   Below --bp-md the nav and the button are replaced by the Menu button (UI-106).
 * Rendering is deterministic: scroll state only changes after mount.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteBundle } from "@/api/types";
import { nav } from "@/features/public/content/copy";
import { showHeader, watchScrollDirection } from "@/shared/motion/scroll-direction";
import { AppNavLink } from "@/shared/ui/AppLink/AppLink";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { Wordmark } from "@/shared/ui/Wordmark/Wordmark";
import { cx } from "@/shared/utils/cx";
import { MobileMenu } from "../MobileMenu/MobileMenu";
import styles from "./Header.module.css";

export const NAV_LINKS = [
  { to: "/work", label: nav.work },
  { to: "/writing", label: nav.writing },
  { to: "/about", label: nav.about },
  { to: "/contact", label: nav.contact },
] as const;

/** True once the sentinel (placed at the header's height) has scrolled out of view. */
function useScrolledPast(): [boolean, (node: HTMLDivElement | null) => void] {
  const [scrolled, setScrolled] = useState(false);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setScrolled(!entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [scrolled, setNode];
}

export interface HeaderProps {
  site: SiteBundle | undefined;
  /** Solid (compact) from the start: the page does not begin on the base surface. */
  solid?: boolean;
}

export function Header({ site, solid = false }: HeaderProps) {
  const [scrolledPast, sentinelRef] = useScrolledPast();
  const headerRef = useRef<HTMLElement>(null);
  const menuOpen = useRef(false);
  const compact = solid || scrolledPast;
  const bookingUrl = site?.settings.booking_url;

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;
    return watchScrollDirection(header, { isLocked: () => menuOpen.current });
  }, []);

  const onMenuOpenChange = useCallback((open: boolean) => {
    menuOpen.current = open;
    if (open && headerRef.current) showHeader(headerRef.current);
  }, []);

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <header ref={headerRef} className={styles.header} data-surface="base" data-compact={compact ? "true" : undefined}>
        <div className={cx("bleed", styles.inner)}>
          <Wordmark to="/" size="header" />
          <nav aria-label={nav.mainLabel} className={styles.nav}>
            <ul className={styles.list}>
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <AppNavLink to={link.to} className={styles.link}>
                    {link.label}
                  </AppNavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.cta}>
            <BookCallLink bookingUrl={bookingUrl} />
          </div>
          <MobileMenu bookingUrl={bookingUrl} className={styles.menu} onOpenChange={onMenuOpenChange} />
        </div>
      </header>
    </>
  );
}
