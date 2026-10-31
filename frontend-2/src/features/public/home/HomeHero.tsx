/**
 * Home hero (UI-111, REQ-010 as varied by REQ-082, DES-057): on the base surface (not dark, no glow). The page's
 * only h1 in Inter Tight 300 at --text-display-xl, then an offset block with the intro, the tagline and the two
 * actions ("Book a call" primary, "View work" secondary). The clamp caps keep both actions visible without
 * scrolling at 1440×900 and 390×844 (checked by E2E UI-T-148). The hero is above the fold: no reveal.
 */
import { useId } from "react";
import { actions, homeHero } from "@/features/public/content/copy";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { ButtonLink } from "@/shared/ui/Button/ButtonLink";
import { Section } from "@/shared/ui/Section/Section";
import styles from "./Home.module.css";

export interface HomeHeroProps {
  bookingUrl: string | null | undefined;
}

export function HomeHero({ bookingUrl }: HomeHeroProps) {
  const headingId = useId();
  return (
    <Section surface="base" aria-labelledby={headingId} className={styles.hero}>
      <h1 id={headingId} className={styles.statement}>
        {homeHero.lines.map((line) => (
          <span key={line} className={styles.line}>
            {line}
          </span>
        ))}
      </h1>
      <div className={`grid12 ${styles.heroGrid}`}>
        <div className={`offset ${styles.aside}`}>
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
