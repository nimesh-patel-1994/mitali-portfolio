/**
 * P1 review state (dev only; TS-021 step 5, TS-024, PH-2 P1 review aids). In-memory only: no localStorage or
 * sessionStorage (SEC-UI-018); the base surface is also mirrored in the URL (`?base=white`) so a link can be shared.
 * Imported only behind `import.meta.env.DEV` (dead code in production builds; proved by scripts/check-dist.ts).
 * Removed after the P1 decision.
 */
import { useSyncExternalStore } from "react";

export type ReviewBase = "cream" | "white";

interface ReviewState {
  base: ReviewBase;
  viewTransitions: boolean;
}

let state: ReviewState = { base: "cream", viewTransitions: true };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getReviewState(): ReviewState {
  return state;
}

export function subscribeReview(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setViewTransitionsEnabled(enabled: boolean): void {
  state = { ...state, viewTransitions: enabled };
  emit();
}

export function setReviewBase(base: ReviewBase): void {
  state = { ...state, base };
  emit();
}

/** Hook used by AppLink in development: re-renders links when the P1 toggle changes. */
export function useDevViewTransitions(): boolean {
  return useSyncExternalStore(
    subscribeReview,
    () => state.viewTransitions,
    () => true,
  );
}

/** Test helper. */
export function resetReviewStateForTests(): void {
  state = { base: "cream", viewTransitions: true };
  emit();
}
