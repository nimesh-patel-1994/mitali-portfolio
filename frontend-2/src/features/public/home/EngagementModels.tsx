/**
 * Home: engagement models (UI-111, REQ-013) on the white band: units without card chrome, separated by vertical
 * hairlines from --bp-lg; name (h3, display 300), description, feature list and an action using `cta_label`.
 * `cta_target` decides the link: `booking` → Book a call behaviour (booking URL or /contact), `contact` → /contact.
 * Never a free URL; no prices.
 */
import { useId } from "react";
import type { EngagementModel } from "@/api/types";
import { homeSections } from "@/features/public/content/copy";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { ButtonLink } from "@/shared/ui/Button/ButtonLink";
import { HairlineList } from "@/shared/ui/HairlineList/HairlineList";
import { CheckIcon } from "@/shared/ui/Icon/Icon";
import { Reveal } from "@/shared/ui/Reveal/Reveal";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import styles from "./Home.module.css";

export interface EngagementModelsProps {
  models: EngagementModel[];
  bookingUrl: string | null | undefined;
}

export function EngagementModels({ models, bookingUrl }: EngagementModelsProps) {
  const headingId = useId();
  if (models.length === 0) return null;
  return (
    <Section surface="band" aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId} reveal="fade">
        {homeSections.engagement}
      </SectionHeading>
      <p className={styles.intro}>{homeSections.engagementIntro}</p>
      <Reveal>
        <HairlineList columns={3} rule="vertical">
          {models.map((model) => (
            <li key={model.id}>
              <article className={styles.model}>
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
                    <BookCallLink bookingUrl={bookingUrl} variant="secondary" fullWidth>
                      {model.cta_label}
                    </BookCallLink>
                  ) : (
                    <ButtonLink href="/contact" variant="secondary" fullWidth>
                      {model.cta_label}
                    </ButtonLink>
                  )}
                </div>
              </article>
            </li>
          ))}
        </HairlineList>
      </Reveal>
    </Section>
  );
}
