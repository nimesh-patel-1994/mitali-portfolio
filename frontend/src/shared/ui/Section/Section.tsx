import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./Section.module.css";

export type Surface = "deepest" | "dark" | "cream" | "white";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Declares the surface; global.css maps it to the contextual aliases (UI-001, DES-012). */
  surface: Surface;
  as?: "section" | "div" | "article" | "aside" | "footer" | "header";
  /** Wraps children in a centred container (`max` = 1100 px, `wide` = 1320 px) or none. */
  container?: "max" | "wide" | "none";
  /** Applies the vertical section padding (`--section-pad`). */
  padded?: boolean;
  /** First section of a page without a dark hero: adds room for the fixed header (UI-019). */
  first?: boolean;
  children?: ReactNode;
}

export function Section({
  surface,
  as: Tag = "section",
  container = "max",
  padded = true,
  first = false,
  className,
  children,
  ...rest
}: SectionProps) {
  return (
    <Tag data-surface={surface} className={cx(styles.section, padded && styles.padded, first && styles.first, className)} {...rest}>
      {container === "none" ? (
        children
      ) : (
        <div className={container === "wide" ? "container-wide" : "container"}>{children}</div>
      )}
    </Tag>
  );
}
