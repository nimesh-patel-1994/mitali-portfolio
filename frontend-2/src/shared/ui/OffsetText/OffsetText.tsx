/**
 * OffsetText (UI-110, DES-061): a text block that starts at column 5 of the 12-column grid from --bp-lg (about
 * 37 % of the width) and spans the full width below. The heading sits above the text in the same column.
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import { Reveal } from "../Reveal/Reveal";
import styles from "./OffsetText.module.css";

export interface OffsetTextProps {
  heading: ReactNode;
  headingId?: string;
  children: ReactNode;
  className?: string;
}

export function OffsetText({ heading, headingId, children, className }: OffsetTextProps) {
  return (
    <Reveal className={cx("grid12", styles.block, className)}>
      <div className={cx("offset", styles.column)}>
        <h2 id={headingId} className={styles.heading}>
          {heading}
        </h2>
        {children}
      </div>
    </Reveal>
  );
}
