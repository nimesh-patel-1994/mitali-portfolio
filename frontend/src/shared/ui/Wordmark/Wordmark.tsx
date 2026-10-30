/**
 * Wordmark (UI-005, DES-002). The only component that renders the brand mark. When a logo is supplied it is
 * imported here from `assets/brand/` (unmodified) and replaces the text; no layout changes elsewhere.
 */
import { Link } from "react-router";
import { a11y } from "@/features/public/content/copy";
import { cx } from "@/shared/utils/cx";
import styles from "./Wordmark.module.css";

const BRAND_TEXT = "MITALI";

export interface WordmarkProps {
  size?: "header" | "footer" | "admin";
  /** `onDark`: green (--color-primary); `onLight`: --color-dark (DES-013: never green on cream). */
  tone?: "onDark" | "onLight";
  /** When set, the wordmark is a link with the accessible name "Mitali, home" (or `label`). */
  to?: string;
  /** Accessible name of the link (e.g. the admin's "Mitali admin, dashboard"). */
  label?: string;
  className?: string;
}

export function Wordmark({ size = "header", tone = "onDark", to, label, className }: WordmarkProps) {
  const classes = cx(styles.wordmark, styles[size], tone === "onDark" ? styles.onDark : styles.onLight, className);
  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-label={label ?? a11y.wordmarkHome}>
        {BRAND_TEXT}
      </Link>
    );
  }
  return (
    <span className={classes} role="img" aria-label="Mitali">
      {BRAND_TEXT}
    </span>
  );
}
