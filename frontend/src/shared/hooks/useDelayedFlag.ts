import { useEffect, useState } from "react";

/** Returns `active` only after it has stayed true for `delayMs` (avoids flicker for fast navigations). */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!active) {
      // Reset asynchronously; the returned value is already false because it is gated by `active`.
      const reset = setTimeout(() => setDelayed(false), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return active && delayed;
}
