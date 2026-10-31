/**
 * IntroSplit (UI-110, DES-061): 50/50 intro split from --bp-lg (heading or label left, text right); stacked below.
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import { Reveal } from "../Reveal/Reveal";
import styles from "./IntroSplit.module.css";

export interface IntroSplitProps {
  aside: ReactNode;
  children: ReactNode;
  className?: string;
}

export function IntroSplit({ aside, children, className }: IntroSplitProps) {
  return (
    <Reveal className={cx(styles.split, className)}>
      <div className={styles.aside}>{aside}</div>
      <div className={styles.body}>{children}</div>
    </Reveal>
  );
}
