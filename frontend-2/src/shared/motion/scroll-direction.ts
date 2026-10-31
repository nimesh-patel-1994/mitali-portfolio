/**
 * Header scroll direction (SD-118, TS-023 step 1, REQ-085). The single deliberate exception to "no scroll
 * listeners" in the motion budget (REQ-NFR-009): ONE passive `scroll` listener, coalesced to once per animation
 * frame, that reads only `window.scrollY` (no layout reads) and toggles `data-hidden` on the header.
 * - Movements smaller than DIRECTION_THRESHOLD px (in either direction) change nothing.
 * - Near the top (within the header height, read once at setup) the header is always shown.
 * - Never hidden while the header contains focus (`:focus-within`) or while `isLocked()` (mobile menu open);
 *   a `focusin` inside the header shows it at once. CSS adds a `:focus-within` safety net.
 * - Under `prefers-reduced-motion: reduce` nothing is attached: the header never hides.
 * Hiding itself is a CSS `transform` (Header.module.css).
 */

export const DIRECTION_THRESHOLD = 8;
const FALLBACK_TOP_ZONE = 80;

export interface ScrollDirectionOptions {
  /** True while the header must stay visible (mobile menu open). */
  isLocked?: () => boolean;
  /** Top zone in px where the header is always visible; defaults to the header height. */
  topZone?: number;
  win?: Window;
}

export function showHeader(header: HTMLElement): void {
  header.removeAttribute("data-hidden");
}

function hasFocusWithin(header: HTMLElement): boolean {
  try {
    return header.matches(":focus-within");
  } catch {
    return header.contains(header.ownerDocument.activeElement);
  }
}

/** Attaches the listener; returns the cleanup. */
export function watchScrollDirection(header: HTMLElement, options: ScrollDirectionOptions = {}): () => void {
  const win = options.win ?? window;
  if (typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showHeader(header);
    return () => undefined;
  }
  const isLocked = options.isLocked ?? (() => false);
  const topZone = options.topZone ?? (header.offsetHeight || FALLBACK_TOP_ZONE);
  let lastY = win.scrollY;
  let frame = 0;

  const update = () => {
    frame = 0;
    const y = win.scrollY;
    if (y <= topZone) {
      lastY = y;
      showHeader(header);
      return;
    }
    const delta = y - lastY;
    if (Math.abs(delta) < DIRECTION_THRESHOLD) return;
    lastY = y;
    if (delta < 0) showHeader(header);
    else if (!isLocked() && !hasFocusWithin(header)) header.setAttribute("data-hidden", "true");
  };

  const onScroll = () => {
    if (frame === 0) frame = win.requestAnimationFrame(update);
  };
  const onFocusIn = () => showHeader(header);

  win.addEventListener("scroll", onScroll, { passive: true });
  header.addEventListener("focusin", onFocusIn);
  return () => {
    win.removeEventListener("scroll", onScroll);
    header.removeEventListener("focusin", onFocusIn);
    if (frame !== 0) win.cancelAnimationFrame(frame);
  };
}
