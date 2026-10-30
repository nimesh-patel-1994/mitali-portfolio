/**
 * TapeDivider (UI-008): decorative rotated green block overlapping the seam between a dark and a cream section.
 * Zero-height, `aria-hidden`, no pointer events; it clips its own block horizontally (`overflow-x: clip`), so it
 * never makes the page wider than the viewport (REQ-NFR-001, UI-T-103).
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
