/**
 * TextLink: small uppercase internal link with an arrow (e.g. "View all work", "Back to writing", "Show all").
 * Colour from `--link-on-surface` (dark on cream, green on dark; DES-013), always underlined.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "@/shared/utils/cx";
import { ArrowLeftIcon, ArrowRightIcon } from "../Icon/Icon";
import styles from "./TextLink.module.css";

export interface TextLinkProps {
  to: string;
  /** Arrow direction (`back` puts a left arrow before the text). */
  direction?: "forward" | "back";
  className?: string;
  children: ReactNode;
}

export function TextLink({ to, direction = "forward", className, children }: TextLinkProps) {
  return (
    <Link to={to} className={cx(styles.link, className)}>
      {direction === "back" && <ArrowLeftIcon />}
      {children}
      {direction === "forward" && <ArrowRightIcon />}
    </Link>
  );
}
