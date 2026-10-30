/**
 * Mobile menu (UI-020, REQ-003; our design per DES-040). Shown below 810 px (CSS hides the trigger from tablet up).
 * - "Menu" button with `aria-expanded` (and `aria-controls` while the dialog exists) opens a full-screen dark dialog
 *   (`role="dialog" aria-modal="true" aria-label="Menu"`) rendered in a portal on <body>.
 * - Focus moves to the first link; Tab and Shift+Tab are trapped; Escape or the close button closes it and returns
 *   focus to the Menu button. Selecting a link closes it and navigates; any route change closes it; growing past
 *   810 px closes it.
 * - While open, every other child of <body> is `inert` and page scrolling is locked (`data-scroll-locked` on <html>,
 *   styled in global.css; no inline styles).
 * - Links are NavLinks, so the current section is marked like in the header (Work is current on /work/<slug>).
 * Nothing is rendered in the dialog on the server (it starts closed), so hydration is unaffected.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router";
import { nav } from "@/features/public/content/copy";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { CloseIcon, MenuIcon } from "@/shared/ui/Icon/Icon";
import { cx } from "@/shared/utils/cx";
import styles from "./MobileMenu.module.css";

/** Mirrors `--bp-tablet` in media.css (custom media cannot be read from JS). */
export const TABLET_QUERY = "(min-width: 810px)";

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
}

export function MobileMenu({ bookingUrl, className }: MobileMenuProps) {
  // The menu is open while the location equals the one it was opened at: any route change closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const dialogId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const { pathname, search } = useLocation();
  const location = `${pathname}${search}`;
  const open = openAt !== null && openAt === location;

  const close = useCallback((returnFocus: boolean) => {
    restoreFocus.current = returnFocus;
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

  // Growing past the mobile breakpoint closes it.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(TABLET_QUERY);
    const onChange = () => {
      if (query.matches) close(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open, close]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
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
      close(true);
      return;
    }
    // Portal container created on first open, from the event handler (client only).
    if (!portalNode) {
      const node = document.createElement("div");
      document.body.appendChild(node);
      setPortalNode(node);
    }
    setOpenAt(location);
  };

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
      {open &&
        portalNode &&
        createPortal(
          // The dialog handles Tab/Escape for its own focus trap (APG dialog pattern).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            ref={dialogRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-label={nav.menuLabel}
            className={styles.dialog}
            data-surface="deepest"
            onKeyDown={onKeyDown}
          >
            <div className={cx("container-wide", styles.top)}>
              <button type="button" className={styles.close} aria-label={nav.closeMenu} onClick={() => close(true)}>
                <CloseIcon className={styles.closeIcon} />
              </button>
            </div>
            <nav aria-label={nav.menuLabel} className={cx("container-wide", styles.body)}>
              <ul className={styles.list}>
                {MENU_LINKS.map((link) => (
                  <li key={link.to}>
                    <NavLink to={link.to} className={styles.link} onClick={() => close(false)}>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              {/* Closing on click covers the external booking link too (it opens in a new tab). */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div className={styles.cta} onClick={() => close(false)}>
                <BookCallLink bookingUrl={bookingUrl} fullWidth />
              </div>
            </nav>
          </div>,
          portalNode,
        )}
    </>
  );
}
