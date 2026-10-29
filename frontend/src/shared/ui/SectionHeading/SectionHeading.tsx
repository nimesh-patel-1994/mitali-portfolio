/**
 * SectionHeading (UI-007): uppercase display heading with a decorative rotated "tape" block drawn as a CSS
 * `::before` behind the first letters (not in the accessibility tree). Optional eyebrow label and an action slot
 * (e.g. "View all work") that sits top-right on tablet/desktop and stacks under the heading on mobile.
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./SectionHeading.module.css";

export interface SectionHeadingProps {
  level: 1 | 2 | 3;
  /** Visual size; defaults to `h1` for level 1, `h2` otherwise. */
  size?: "hero" | "h1" | "h2" | "h3";
  eyebrow?: ReactNode;
  action?: ReactNode;
  /** Draws the tape (default true). */
  tape?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function SectionHeading({
  level,
  size,
  eyebrow,
  action,
  tape = true,
  id,
  className,
  children,
}: SectionHeadingProps) {
  const Tag = `h${level}` as const;
  const visualSize = size ?? (level === 1 ? "h1" : "h2");
  return (
    <div className={cx(styles.wrapper, className)}>
      <div className={styles.titles}>
        {eyebrow !== undefined && <p className={styles.eyebrow}>{eyebrow}</p>}
        <Tag id={id} className={cx(styles.heading, styles[visualSize], tape && styles.taped)}>
          <span className={styles.text}>{children}</span>
        </Tag>
      </div>
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </div>
  );
}
