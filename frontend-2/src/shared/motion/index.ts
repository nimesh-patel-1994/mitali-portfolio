/**
 * Motion modules (TS-022, TS-023). Everything here counts towards the motion budget (≤ 2 KB gzip, REQ-NFR-009),
 * measured by scripts/check-motion-size.ts. No library; the only scroll listener is the header's (SD-118).
 */
export { initMotion, registerReveal, unregisterReveal, REVEAL_LINE } from "./reveal";
export { watchScrollDirection, showHeader, DIRECTION_THRESHOLD } from "./scroll-direction";
