/**
 * Reveal engine (TS-022 step 1, REQ-084, UI-REV-028). Progressive enhancement:
 * - `<Reveal>` renders a stable `data-reveal` attribute on server and client and registers its element here.
 * - Nothing is hidden until `initMotion()` runs once after hydration. It does nothing unless motion is allowed
 *   (`prefers-reduced-motion: no-preference`) and IntersectionObserver exists. It first marks every registered
 *   element whose top is already above ~85 % of the viewport as revealed (one read per element, so nothing visible
 *   disappears), then sets `html[data-motion="on"]` and observes the rest with ONE shared observer.
 * - On intersection the element gets `data-revealed` and is unobserved (plays once, never hidden again).
 * - Attributes are written to the DOM directly (no React state, no re-render). Any error leaves the page
 *   without the motion flag, i.e. fully visible.
 */

/** Blocks start revealing when their top crosses ~85 % of the viewport height. */
export const REVEAL_LINE = 0.85;
const ROOT_MARGIN = "0px 0px -15% 0px";

const registered = new Set<Element>();
let observer: IntersectionObserver | null = null;
let active = false;

function reveal(element: Element): void {
  element.setAttribute("data-revealed", "");
  observer?.unobserve(element);
}

function motionAllowed(win: Window): boolean {
  return (
    typeof win.matchMedia === "function" &&
    win.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
    typeof (win as Window & typeof globalThis).IntersectionObserver === "function"
  );
}

/** Called by `<Reveal>`'s ref callback when its element mounts. */
export function registerReveal(element: Element): void {
  registered.add(element);
  if (active && observer && !element.hasAttribute("data-revealed")) observer.observe(element);
}

/** Called by `<Reveal>`'s ref callback when its element unmounts. */
export function unregisterReveal(element: Element): void {
  registered.delete(element);
  observer?.unobserve(element);
}

/** Turns motion on once (client entry, after hydration). Returns true when the motion flag was set. */
export function initMotion(win: Window = window): boolean {
  if (active) return true;
  try {
    if (!motionAllowed(win)) return false;
    const line = win.innerHeight * REVEAL_LINE;
    for (const element of registered) {
      if (element.getBoundingClientRect().top < line) element.setAttribute("data-revealed", "");
    }
    const Observer = (win as Window & typeof globalThis).IntersectionObserver;
    const created = new Observer(
      (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 },
    );
    observer = created;
    for (const element of registered) if (!element.hasAttribute("data-revealed")) created.observe(element);
    win.document.documentElement.dataset.motion = "on";
    active = true;
    return true;
  } catch {
    // Leave the page without the flag: everything stays visible.
    observer?.disconnect();
    observer = null;
    delete win.document.documentElement.dataset.motion;
    return false;
  }
}

/** Test helper: back to the initial state. */
export function resetMotionForTests(): void {
  observer?.disconnect();
  observer = null;
  active = false;
  registered.clear();
  if (typeof document !== "undefined") delete document.documentElement.dataset.motion;
}
