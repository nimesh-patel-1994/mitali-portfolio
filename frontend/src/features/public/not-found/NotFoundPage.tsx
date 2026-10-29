/**
 * Not-found and route error content (UI-034, REQ-001, REQ-022). Dark (deepest) statement section with an h1, a
 * one-line explanation and two actions. Rendered for `*`, for loader 404s and as `404.html`; head meta is `noindex`
 * with the title "Page not found — Mitali" (seo/meta.ts). The route error variant shares the layout with
 * "Something went wrong" copy and a reload link (a full document request to the same URL).
 */
import { useId } from "react";
import { useLocation } from "react-router";
import { actions, errorPage, notFoundPage } from "@/features/public/content/copy";
import { ButtonLink } from "@/shared/ui/Button/ButtonLink";
import { Section } from "@/shared/ui/Section/Section";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  const headingId = useId();
  return (
    <Section surface="deepest" aria-labelledby={headingId} className={styles.page}>
      <h1 id={headingId} className={styles.heading}>
        {notFoundPage.heading}
      </h1>
      <span className={styles.tape} aria-hidden="true" />
      <p className={styles.body}>{notFoundPage.body}</p>
      <div className={styles.actions}>
        <ButtonLink href="/" variant="primary">
          {actions.backHome}
        </ButtonLink>
        <ButtonLink href="/work" variant="secondary">
          {actions.viewWork}
        </ButtonLink>
      </div>
    </Section>
  );
}

export function ErrorContent() {
  const headingId = useId();
  const location = useLocation();
  return (
    <Section surface="deepest" aria-labelledby={headingId} className={styles.page}>
      <h1 id={headingId} className={styles.heading}>
        {errorPage.heading}
      </h1>
      <p className={styles.body}>{errorPage.body}</p>
      <div className={styles.actions}>
        {/* A plain <a> (not a router Link) makes a full document request: the "Try again" reload. */}
        <a href={`${location.pathname}${location.search}`} className={styles.reload}>
          {actions.tryAgain}
        </a>
        <ButtonLink href="/" variant="secondary">
          {actions.backHome}
        </ButtonLink>
      </div>
    </Section>
  );
}
