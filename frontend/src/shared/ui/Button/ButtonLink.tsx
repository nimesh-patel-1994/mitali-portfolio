/**
 * ButtonLink (UI-006): a link styled as a button. Root-relative paths use the router `Link`; absolute http(s)
 * URLs open in a new tab with `rel="noopener noreferrer"` and a visually hidden "(opens in a new tab)"
 * (SEC-UI-004). Any other value (javascript:, data:, protocol-relative, malformed) renders nothing.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { a11y } from "@/features/public/content/copy";
import { isInternalPath, safeExternalUrl } from "@/shared/utils/url";
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
      <Link to={href} className={classes}>
        <span className={styles.label}>{children}</span>
      </Link>
    );
  }
  const external = safeExternalUrl(href);
  if (external === null) return null;
  return (
    <a href={external} target="_blank" rel="noopener noreferrer" className={classes}>
      <span className={styles.label}>{children}</span>
      <span className="visually-hidden"> {a11y.opensInNewTab}</span>
    </a>
  );
}
