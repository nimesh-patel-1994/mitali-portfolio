/**
 * CtaBand (UI-016): dark-olive band with a two-line uppercase statement (h2, green on dark), a hairline divider
 * and two actions: Book a call (primary) and a Contact link (secondary). Statement copy from copy.ts.
 */
import { useId } from "react";
import { actions, ctaBand } from "@/features/public/content/copy";
import { BookCallLink } from "../Button/BookCallLink";
import { ButtonLink } from "../Button/ButtonLink";
import { Section } from "../Section/Section";
import styles from "./CtaBand.module.css";

export interface CtaBandProps {
  bookingUrl: string | null | undefined;
}

export function CtaBand({ bookingUrl }: CtaBandProps) {
  const headingId = useId();
  return (
    <Section surface="dark" aria-labelledby={headingId} className={styles.band}>
      <h2 id={headingId} className={styles.statement}>
        {ctaBand.lines.map((line) => (
          <span key={line} className={styles.line}>
            {line}
          </span>
        ))}
      </h2>
      <div className={styles.divider} aria-hidden="true" />
      <div className={styles.actions}>
        <BookCallLink bookingUrl={bookingUrl} variant="primary" />
        <ButtonLink href="/contact" variant="secondary">
          {actions.contact}
        </ButtonLink>
      </div>
    </Section>
  );
}
