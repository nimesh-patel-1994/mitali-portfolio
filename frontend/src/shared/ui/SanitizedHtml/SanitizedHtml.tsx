/**
 * SanitizedHtml (UI-014, SEC-UI-001, UI-REV-004): the single reviewed use of `dangerouslySetInnerHTML` in the
 * codebase. Accepts only the branded `SanitizedHtmlString` produced by the typed API response mappers from
 * backend-sanitized HTML (TS-012); a plain string does not type-check.
 */
import type { SanitizedHtmlString } from "@/api/sanitized";
import { cx } from "@/shared/utils/cx";
import styles from "./SanitizedHtml.module.css";

export interface SanitizedHtmlProps {
  html: SanitizedHtmlString;
  className?: string;
}

export function SanitizedHtml({ html, className }: SanitizedHtmlProps) {
  return (
    // eslint-disable-next-line react/no-danger -- reviewed single insertion point; input is branded sanitized HTML
    <div className={cx(styles.prose, className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
