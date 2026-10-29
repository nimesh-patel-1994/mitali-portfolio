/**
 * Header (UI-019, REQ-002, REQ-003; our design per DES-040).
 * - Fixed to the top, `--header-h` tall and transparent over a dark hero. A zero-height sentinel at the top of the
 *   document is watched by an IntersectionObserver (no scroll listeners); once it leaves the viewport the header
 *   switches to `data-compact` (`--header-h-compact`, deepest background, hairline border).
 * - Pages without a dark hero (route handle `darkHero` not set) start compact.
 * - Wordmark → Home; `<nav aria-label="Main">` with NavLinks (Work is current on /work/*, Writing on /writing/*);
 *   Book a call. Below 810 px links and button are replaced by the Menu button (UI-020).
 * Rendering is deterministic: the scroll state only changes after mount.
 */
import { useEffect, useState } from "react";
import { NavLink, useMatches } from "react-router";
import type { SiteBundle } from "@/api/types";
import { nav } from "@/features/public/content/copy";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { Wordmark } from "@/shared/ui/Wordmark/Wordmark";
import { cx } from "@/shared/utils/cx";
import styles from "./Header.module.css";
import { MobileMenu } from "./MobileMenu";

export const NAV_LINKS = [
  { to: "/work", label: nav.work },
  { to: "/writing", label: nav.writing },
  { to: "/about", label: nav.about },
  { to: "/contact", label: nav.contact },
] as const;

/** Route handles may set `darkHero: true` when the page starts with a dark hero the header can float over. */
export interface HeroHandle {
  darkHero?: boolean;
}

function hasDarkHero(handle: unknown): boolean {
  return typeof handle === "object" && handle !== null && (handle as HeroHandle).darkHero === true;
}

/** True when the deepest matched route declares a dark hero. */
function useDarkHero(): boolean {
  const matches = useMatches();
  const deepest = matches.at(-1);
  return deepest !== undefined && hasDarkHero(deepest.handle);
}

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
}

export function Header({ site }: HeaderProps) {
  const darkHero = useDarkHero();
  const [scrolledPast, sentinelRef] = useScrolledPast();
  const compact = !darkHero || scrolledPast;
  const bookingUrl = site?.settings.booking_url;

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <header className={styles.header} data-surface="deepest" data-compact={compact ? "true" : undefined}>
        <div className={cx("container-wide", styles.inner)}>
          <Wordmark to="/" size="header" />
          <nav aria-label={nav.mainLabel} className={styles.nav}>
            <ul className={styles.list}>
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} className={styles.link}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.cta}>
            <BookCallLink bookingUrl={bookingUrl} />
          </div>
          <MobileMenu bookingUrl={bookingUrl} className={styles.menu} />
        </div>
      </header>
    </>
  );
}
