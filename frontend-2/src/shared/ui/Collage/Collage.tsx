/**
 * Collage (UI-109, TS-022 step 4, REQ-021): the case-study gallery. Full tiles span the content width; half tiles
 * sit side by side from --bp-md and stack below (the REQ-021 layout rules are unchanged by motion). Half tiles get
 * the drift classes drift1..drift4 in turn: where CSS scroll-driven animations exist and motion is allowed they
 * drift slightly (within ±--motion-drift-max, transform only); elsewhere the layout is static.
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./Collage.module.css";

export interface CollageItem {
  key: string;
  layout: "full" | "half";
  content: ReactNode;
}

export interface CollageProps {
  items: CollageItem[];
  className?: string;
  "aria-labelledby"?: string;
}

/** Drift class for each item: half tiles cycle drift1..drift4, full tiles never drift. */
export function driftClasses(items: Pick<CollageItem, "layout">[]): Array<string | null> {
  let halfIndex = 0;
  return items.map((item) => {
    if (item.layout !== "half") return null;
    halfIndex += 1;
    return `drift${((halfIndex - 1) % 4) + 1}`;
  });
}

export function Collage({ items, className, ...rest }: CollageProps) {
  const drifts = driftClasses(items);
  return (
    <ul className={cx(styles.collage, className)} {...rest}>
      {items.map((item, i) => {
        const drift = drifts[i];
        return (
          <li
            key={item.key}
            className={cx(styles.tile, item.layout === "half" ? styles.half : styles.full)}
            data-layout={item.layout}
          >
            <div className={cx(styles.inner, drift !== null && drift !== undefined && styles[drift])}>{item.content}</div>
          </li>
        );
      })}
    </ul>
  );
}
