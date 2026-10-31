/**
 * ButtonLink (UI-108, UI-006 behaviour): a link styled as a button. Root-relative paths use AppLink (router link
 * with the view transition); absolute http(s) URLs open in a new tab with `rel="noopener noreferrer"` and a
 * visually hidden "(opens in a new tab)" (SEC-UI-004). Any other value (javascript:, data:, protocol-relative,
 * malformed) renders nothing.
 */
import type { ReactNode } from "react";
import { a11y } from "@/features/public/content/copy";
import { isInternalPath, safeExternalUrl } from "@/shared/utils/url";
import { AppLink } from "../AppLink/AppLink";
import { buttonClassName, type ButtonVariant } from "./Button";
import styles from "./Button.module.css";

export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ href, variant = "primary", fullWidth = false, className, children }: ButtonLinkProps) {
  const classes = buttonClassName(variant, fullWidth, className);
  if (isInternalPath(href)) {
    return (
      <AppLink to={href} className={classes}>
        <span className={styles.label}>{children}</span>
      </AppLink>
    );
  }
  const external = safeExternalUrl(href);
  if (external === null) return null;
  return (
    <a href={external} target="_blank" rel="noopener noreferrer" className={classes}>
      {/* The notice sits inside the label (inline), so the accessible name keeps its space in flex layouts. */}
      <span className={styles.label}>
        {children} <span className="visually-hidden">{a11y.opensInNewTab}</span>
      </span>
    </a>
  );
}
