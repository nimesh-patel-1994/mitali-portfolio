/**
 * Screen states (UI-040, UI-REV-006): loading, empty, error (+ Retry), not found (+ back link), and the admin page
 * frame that sets `document.title` ("<Screen> — Admin — Mitali") and moves focus to the `h1` on navigation (UI-037).
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/shared/ui/Button/Button";
import { isApiError } from "../api/errors";
import styles from "./Kit.module.css";

export function adminTitle(screen: string): string {
  return `${screen} — Admin — Mitali`;
}

export interface AdminPageProps {
  title: string;
  /** Heading text when it differs from the document title (e.g. the item's name). */
  heading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminPage({ title, heading, actions, children }: AdminPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = adminTitle(title);
  }, [title]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.pageTitle}>
          {heading ?? title}
        </h1>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className={styles.loading}>
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </p>
  );
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(error)) {
    if (error.isNetwork) return "The server could not be reached. Check that the backend is running, then try again.";
    if (error.status >= 500) return "The server had a problem. Please try again.";
    return error.message || fallback;
  }
  return fallback;
}

export function ErrorState({ error, onRetry, title = "This could not be loaded" }: { error: unknown; onRetry: () => void; title?: string }) {
  return (
    <div role="alert" className={styles.state}>
      <p className={styles.stateTitle}>{title}</p>
      <p>{errorMessage(error)}</p>
      <Button variant="ghost" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <p className={styles.stateTitle}>{title}</p>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function NotFoundState({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  return (
    <div role="alert" className={styles.state}>
      <p className={styles.stateTitle}>This item no longer exists</p>
      <p>It may have been deleted in another tab.</p>
      <Link to={backTo} className={styles.link}>
        {backLabel}
      </Link>
    </div>
  );
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}
