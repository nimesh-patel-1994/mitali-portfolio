/**
 * DEV ONLY — P1 review tools (TS-021 step 5, TS-024; PH-2 P1 review). Loaded from entry-client.tsx behind
 * `import.meta.env.DEV` and therefore absent from production builds (scripts/check-dist.ts proves it).
 * - `?base=white` → `<html data-base="white">`: the base surface becomes white and the band cream (review-base.css).
 * - A small "P1 review" panel (own React root outside the app, so hydration is unaffected) switches the base
 *   surface and route view transitions on/off, and links to the type specimen `/__review/type`.
 * - `?review=off` hides the panel (e.g. for automated screenshots).
 * State lives in memory and in the URL only (never localStorage/sessionStorage).
 */
import "./review-base.css";
import { getReviewState, setReviewBase, type ReviewBase } from "./review-state";

export const BASE_PARAM = "base";
export const PANEL_PARAM = "review";

/** Reads `?base=white` (anything else = cream). */
export function baseFromSearch(search: string): ReviewBase {
  return new URLSearchParams(search).get(BASE_PARAM) === "white" ? "white" : "cream";
}

/** Applies the base surface to <html> and mirrors it in the URL (replaceState, no navigation). */
export function applyBase(base: ReviewBase, doc: Document = document, updateUrl = false): void {
  if (base === "white") doc.documentElement.dataset.base = "white";
  else delete doc.documentElement.dataset.base;
  setReviewBase(base);
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (base === "white") url.searchParams.set(BASE_PARAM, "white");
    else url.searchParams.delete(BASE_PARAM);
    window.history.replaceState(window.history.state, "", url);
  }
}

export function installReviewTools(doc: Document = document): void {
  applyBase(baseFromSearch(window.location.search), doc);
  if (new URLSearchParams(window.location.search).get(PANEL_PARAM) === "off") return;
  void import("./ReviewPanel").then(({ mountReviewPanel }) => mountReviewPanel(doc));
}

export { getReviewState };
