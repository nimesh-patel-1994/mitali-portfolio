/**
 * Mobile menu (UI-106, DES-053; behaviour ported from frontend/ UI-020, REQ-003). Shown below --bp-md (768 px).
 * - "Menu" button with `aria-expanded` (and `aria-controls` while the dialog exists) opens a full-screen deep-surface
 *   dialog (`role="dialog" aria-modal="true" aria-label="Menu"`) rendered in a portal on <body>: the wordmark and
 *   the close button in a row, then hairline rows (≥ 56 px) and a full-width "Book a call".
 * - Focus moves to the first link; Tab/Shift+Tab are trapped; Escape or the close button closes it and returns focus
 *   to the Menu button. A link choice, any route change and growing to ≥ 768 px close it.
 * - While open every other child of <body> is `inert` and page scroll is locked (`data-scroll-locked` on <html>, no
 *   inline style). The header is kept visible while open (`onOpenChange`, REQ-085).
 * - Motion (no-preference only): panel slides in from the right (450 ms) over a fading backdrop (500 ms); on close
 *   the panel slides out before it is removed (it is `inert` and hidden from assistive technology meanwhile).
 *   Under reduced motion opening and closing are instant.
 * Nothing is rendered in the dialog on the server (it starts closed), so hydration is unaffected.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { nav } from "@/features/public/content/copy";
import { AppNavLink } from "@/shared/ui/AppLink/AppLink";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { CloseIcon, MenuIcon } from "@/shared/ui/Icon/Icon";
import { Wordmark } from "@/shared/ui/Wordmark/Wordmark";
import { cx } from "@/shared/utils/cx";
import styles from "./MobileMenu.module.css";

/** Mirrors `--bp-md` in media.css (custom media cannot be read from JS). */
export const MD_QUERY = "(min-width: 768px)";
const MOTION_QUERY = "(prefers-reduced-motion: no-preference)";
/** Upper bound for the closing slide (--motion-dur-slow) in case `animationend` never fires. */
const CLOSE_FALLBACK_MS = 600;

export const MENU_LINKS = [
  { to: "/", label: nav.home },
  { to: "/work", label: nav.work },
  { to: "/writing", label: nav.writing },
  { to: "/about", label: nav.about },
  { to: "/contact", label: nav.contact },
  { to: "/faqs", label: nav.faqs },
] as const;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

function motionAllowed(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(MOTION_QUERY).matches;
}

/** Makes every other child of <body> inert and locks page scroll while `active`. */
function useModalBackground(active: boolean, portalNode: HTMLElement | null): void {
  useEffect(() => {
    if (!active || !portalNode) return undefined;
    const others = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== portalNode && !el.hasAttribute("inert"),
    );
    for (const el of others) el.setAttribute("inert", "");
    document.documentElement.setAttribute("data-scroll-locked", "true");
    return () => {
      for (const el of others) el.removeAttribute("inert");
      document.documentElement.removeAttribute("data-scroll-locked");
    };
  }, [active, portalNode]);
}

export interface MobileMenuProps {
  bookingUrl: string | null | undefined;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export function MobileMenu({ bookingUrl, className, onOpenChange }: MobileMenuProps) {
  // The menu is open while the location equals the one it was opened at: any route change closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const dialogId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const { pathname, search } = useLocation();
  const location = `${pathname}${search}`;
  const open = openAt !== null && openAt === location;

  const close = useCallback((returnFocus: boolean, animate = false) => {
    restoreFocus.current = returnFocus;
    if (animate && motionAllowed()) setClosing(true);
    setOpenAt(null);
  }, []);

  // The portal container is removed on unmount.
  useEffect(
    () => () => {
      portalNode?.remove();
    },
    [portalNode],
  );

  useModalBackground(open, portalNode);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Focus: first link when opened; back to the Menu button after Escape / close button.
  useEffect(() => {
    if (open && portalNode && dialogRef.current) {
      const first = dialogRef.current.querySelector<HTMLElement>("a[href]");
      first?.focus();
      return;
    }
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [open, portalNode]);

  // The closing slide ends with `animationend`; a timeout covers browsers that never fire it.
  useEffect(() => {
    if (!closing) return undefined;
    const timer = setTimeout(() => setClosing(false), CLOSE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  // Growing past the mobile breakpoint closes it.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(MD_QUERY);
    const onChange = () => {
      if (query.matches) close(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open, close]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true, true);
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const items = focusableIn(dialogRef.current);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggle = () => {
    if (open) {
      close(true, true);
      return;
    }
    // Portal container created on first open, from the event handler (client only).
    if (!portalNode) {
      const node = document.createElement("div");
      document.body.appendChild(node);
      setPortalNode(node);
    }
    setClosing(false);
    setOpenAt(location);
  };

  const rendered = (open || closing) && portalNode;
  const state = open ? "open" : "closing";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cx(styles.trigger, className)}
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={toggle}
      >
        <MenuIcon className={styles.triggerIcon} />
        <span>{nav.menu}</span>
      </button>
      {rendered &&
        createPortal(
          <div className={styles.layer} data-state={state} inert={!open} aria-hidden={open ? undefined : true}>
            <div className={styles.backdrop} aria-hidden="true" />
            {/* The dialog handles Tab/Escape for its own focus trap (APG dialog pattern). */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
              ref={dialogRef}
              id={dialogId}
              role="dialog"
              aria-modal="true"
              aria-label={nav.menuLabel}
              className={styles.dialog}
              data-surface="deep"
              onKeyDown={onKeyDown}
              onAnimationEnd={() => {
                if (!open) setClosing(false);
              }}
            >
              <div className={cx("bleed", styles.top)}>
                <Wordmark size="header" />
                <button
                  type="button"
                  className={styles.close}
                  aria-label={nav.closeMenu}
                  onClick={() => close(true, true)}
                >
                  <CloseIcon className={styles.closeIcon} />
                </button>
              </div>
              <nav aria-label={nav.menuLabel} className={cx("bleed", styles.body)}>
                <ul className={styles.list}>
                  {MENU_LINKS.map((link) => (
                    <li key={link.to}>
                      <AppNavLink to={link.to} end={link.to === "/"} className={styles.link} onClick={() => close(false)}>
                        {link.label}
                      </AppNavLink>
                    </li>
                  ))}
                </ul>
                {/* Closing on click covers the external booking link too (it opens in a new tab). */}
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                <div className={styles.menuCta} onClick={() => close(false)}>
                  <BookCallLink bookingUrl={bookingUrl} fullWidth />
                </div>
              </nav>
            </div>
          </div>,
          portalNode,
        )}
    </>
  );
}
