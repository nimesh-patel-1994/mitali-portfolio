/**
 * Wordmark (UI-108, DES-065, DES-002, REQ-005): the "MITALI" text wordmark in Antonio 700 uppercase; ink on light
 * surfaces, green on deep ones (through --indicator-on-surface). The only component that renders the brand mark: a
 * supplied logo from assets/brand/ would replace the text here, with no layout change elsewhere.
 */
import { a11y } from "@/features/public/content/copy";
import { cx } from "@/shared/utils/cx";
import { AppLink } from "../AppLink/AppLink";
import styles from "./Wordmark.module.css";

export const BRAND_TEXT = "MITALI";

export interface WordmarkProps {
  size?: "header" | "footer";
  /** When set, the wordmark is a link with the accessible name "Mitali, home". */
  to?: string;
  className?: string;
}

export function Wordmark({ size = "header", to, className }: WordmarkProps) {
  const classes = cx(styles.wordmark, styles[size], className);
  if (to !== undefined) {
    return (
      <AppLink to={to} className={classes} aria-label={a11y.wordmarkHome}>
        {BRAND_TEXT}
      </AppLink>
    );
  }
  return (
    <span className={classes} role="img" aria-label="Mitali">
      {BRAND_TEXT}
    </span>
  );
}
