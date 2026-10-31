/**
 * ArrowLink (UI-108, DES-052): internal link with text and a diagonal arrow in an `overflow: hidden` box. On
 * hover/focus the arrow leaves up-right and a second arrow enters from bottom-left (transform only, 300 ms,
 * instant under reduced motion); the text gains its underline. Both arrows are `aria-hidden`: the accessible name
 * is the text (or `label`).
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import { AppLink } from "../AppLink/AppLink";
import { ArrowUpRightIcon } from "../Icon/Icon";
import styles from "./ArrowLink.module.css";

export interface ArrowLinkProps {
  to: string;
  /** Accessible name when the visible text is not enough (e.g. the giant footer call-to-action). */
  label?: string;
  size?: "default" | "cta";
  className?: string;
  children: ReactNode;
}

export function ArrowLink({ to, label, size = "default", className, children }: ArrowLinkProps) {
  return (
    <AppLink to={to} className={cx(styles.link, styles[size], className)} aria-label={label}>
      <span className={styles.text}>{children}</span>
      <span className={styles.arrows} aria-hidden="true">
        <ArrowUpRightIcon className={cx(styles.arrow, styles.out)} />
        <ArrowUpRightIcon className={cx(styles.arrow, styles.in)} />
      </span>
    </AppLink>
  );
}
