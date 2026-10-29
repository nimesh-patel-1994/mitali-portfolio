/**
 * TapeDivider (UI-008): decorative rotated green block overlapping the seam between a dark and a cream section.
 * Zero-height, `aria-hidden`, no pointer events; the page clips it horizontally (`overflow-x: clip` on body).
 * Place it between two sections and alternate `side` per page.
 */
import { cx } from "@/shared/utils/cx";
import styles from "./TapeDivider.module.css";

export interface TapeDividerProps {
  side: "left" | "right";
  className?: string;
}

export function TapeDivider({ side, className }: TapeDividerProps) {
  return <div aria-hidden="true" className={cx(styles.tape, styles[side], className)} />;
}
