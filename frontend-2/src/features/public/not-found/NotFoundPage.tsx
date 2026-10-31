/**
 * Not-found and route error content (UI-115, REQ-001, REQ-022; copy and behaviour as frontend/ UI-034) on the deep
 * surface: an h1 in display 300, one line of explanation and two actions. Head meta is `noindex` with the title
 * "Page not found — Mitali" (seo/meta.ts). The error variant shows "Something went wrong" and a "Try again" reload
 * link (a full document request to the same URL). `404.html` and the 404 status arrive with the PH-3 pre-render.
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
    <Section surface="deep" aria-labelledby={headingId} className={styles.page}>
      <h1 id={headingId} className={styles.heading}>
        {notFoundPage.heading}
      </h1>
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
    <Section surface="deep" aria-labelledby={headingId} className={styles.page}>
      <h1 id={headingId} className={styles.heading}>
        {errorPage.heading}
      </h1>
      <p className={styles.body}>{errorPage.body}</p>
      <div className={styles.actions}>
        {/* A plain <a> (not a router link) makes a full document request: the "Try again" reload. */}
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
