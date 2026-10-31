/**
 * HairlineList (UI-108, DES-052, DES-061): a list whose items are separated by 1 px hairlines instead of boxes.
 * `columns` lays the items out in a grid (1 column below --bp-md, 2 from --bp-md, optionally 3 from --bp-lg).
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./HairlineList.module.css";

export interface HairlineListProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  /** `vertical` = hairlines between columns (side by side units), `top` = a hairline above each item. */
  rule?: "top" | "vertical";
  className?: string;
  "aria-label"?: string;
}

export function HairlineList({ children, columns = 1, rule = "top", className, ...rest }: HairlineListProps) {
  return (
    <ul className={cx(styles.list, styles[`cols${columns}`], styles[rule], className)} {...rest}>
      {children}
    </ul>
  );
}
