/**
 * SectionHeading (UI-110, DES-052, DES-057): light display heading (Inter Tight 300) with an optional small label
 * above it (Antonio 500 uppercase) and an action slot (e.g. "View all work") that sits at the end on wide screens
 * and stacks below the heading on narrow ones. Optionally wrapped in a Reveal (`reveal`).
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import { Reveal } from "../Reveal/Reveal";
import styles from "./SectionHeading.module.css";

const SIZE_CLASS = { "display-xl": "displayXl", display: "display", h2: "h2", h3: "h3" } as const;

export interface SectionHeadingProps {
  level: 1 | 2 | 3;
  /** Visual size; defaults to `display` for level 1 and `h2` otherwise. */
  size?: "display-xl" | "display" | "h2" | "h3";
  eyebrow?: ReactNode;
  action?: ReactNode;
  id?: string;
  /** `fade` / `slide` wrap the heading in a Reveal (the slide variant at most once per page). */
  reveal?: "fade" | "slide";
  className?: string;
  children: ReactNode;
}

export function SectionHeading({
  level,
  size,
  eyebrow,
  action,
  id,
  reveal,
  className,
  children,
}: SectionHeadingProps) {
  const Tag = `h${level}` as const;
  const visual = size ?? (level === 1 ? "display" : "h2");
  const titles = (
    <div className={styles.titles}>
      {eyebrow !== undefined && <p className={styles.eyebrow}>{eyebrow}</p>}
      <Tag id={id} className={cx(styles.heading, styles[SIZE_CLASS[visual]])}>
        {children}
      </Tag>
    </div>
  );
  return (
    <div className={cx(styles.wrapper, className)}>
      {reveal ? <Reveal variant={reveal}>{titles}</Reveal> : titles}
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </div>
  );
}
