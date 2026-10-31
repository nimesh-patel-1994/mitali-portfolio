import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during the server render and during hydration, true afterwards (UI-002, UI-029).
 * Lets components render the server markup first and apply browser-only state after hydration,
 * so pre-rendered HTML and the first client render always match.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
