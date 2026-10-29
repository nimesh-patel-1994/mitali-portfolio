/**
 * Home: engagement models (UI-025, REQ-013). Cream section with dark-olive cards (3 / 2+1 / 1 columns): green h3
 * name, description, feature checklist and an action using `cta_label`. `cta_target` decides the link:
 * `booking` → Book a call behaviour (booking URL or /contact), `contact` → /contact. Never a free URL; no prices.
 */
import { useId } from "react";
import type { EngagementModel } from "@/api/types";
import { homeSections } from "@/features/public/content/copy";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { ButtonLink } from "@/shared/ui/Button/ButtonLink";
import { CheckIcon } from "@/shared/ui/Icon/Icon";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import styles from "./HomeSections.module.css";

export interface EngagementModelsProps {
  models: EngagementModel[];
  bookingUrl: string | null | undefined;
}

export function EngagementModels({ models, bookingUrl }: EngagementModelsProps) {
  const headingId = useId();
  if (models.length === 0) return null;
  return (
    <Section surface="cream" aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId}>
        {homeSections.engagement}
      </SectionHeading>
      <p className={styles.intro}>{homeSections.engagementIntro}</p>
      <ul className={styles.models}>
        {models.map((model) => (
          <li key={model.id} className={styles.modelItem}>
            <article className={styles.model} data-surface="dark">
              <h3 className={styles.modelName}>{model.name}</h3>
              <p className={styles.modelText}>{model.description}</p>
              {model.features.length > 0 && (
                <ul className={styles.features}>
                  {model.features.map((feature, i) => (
                    <li key={`${i}-${feature}`} className={styles.feature}>
                      <CheckIcon className={styles.check} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.modelAction}>
                {model.cta_target === "booking" ? (
                  <BookCallLink bookingUrl={bookingUrl} fullWidth>
                    {model.cta_label}
                  </BookCallLink>
                ) : (
                  <ButtonLink href="/contact" fullWidth>
                    {model.cta_label}
                  </ButtonLink>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}
