/**
 * Home hero (UI-022, REQ-010): the page's only h1 (uppercase statement, `--text-hero`, green on the deepest
 * surface), intro, highlighted tagline, Book a call (primary) and View work (secondary), and the drifting glow.
 * Desktop: statement on top, intro and actions in a lower right column; mobile: stacked.
 */
import { useId } from "react";
import { actions, homeHero } from "@/features/public/content/copy";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { ButtonLink } from "@/shared/ui/Button/ButtonLink";
import { Section } from "@/shared/ui/Section/Section";
import { HeroGlow } from "./HeroGlow";
import styles from "./HomeHero.module.css";

export interface HomeHeroProps {
  bookingUrl: string | null | undefined;
}

export function HomeHero({ bookingUrl }: HomeHeroProps) {
  const headingId = useId();
  return (
    <Section surface="deepest" padded={false} container="none" aria-labelledby={headingId} className={styles.hero}>
      <HeroGlow />
      <div className={`container ${styles.content}`}>
        <h1 id={headingId} className={styles.statement}>
          {homeHero.lines.map((line) => (
            <span key={line} className={styles.line}>
              {line}
            </span>
          ))}
        </h1>
        <div className={styles.aside}>
          <p className={styles.intro}>{homeHero.intro}</p>
          <p className={styles.tagline}>{homeHero.tagline}</p>
          <div className={styles.actions}>
            <BookCallLink bookingUrl={bookingUrl} variant="primary" />
            <ButtonLink href="/work" variant="secondary">
              {actions.viewWork}
            </ButtonLink>
          </div>
        </div>
      </div>
    </Section>
  );
}
