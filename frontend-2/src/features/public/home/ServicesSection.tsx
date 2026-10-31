/**
 * Home: services (UI-111, REQ-012) on the dark-olive band (deep-alt): hairline accordion rows with display-300
 * names; each panel shows the description and a deliverables list. 1 / 2 / 3 columns, DOM order = API order.
 */
import { useId } from "react";
import type { Service } from "@/api/types";
import { homeSections } from "@/features/public/content/copy";
import { Accordion } from "@/shared/ui/Accordion/Accordion";
import { Reveal } from "@/shared/ui/Reveal/Reveal";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import styles from "./Home.module.css";

export interface ServicesSectionProps {
  services: Service[];
}

export function ServicesSection({ services }: ServicesSectionProps) {
  const headingId = useId();
  if (services.length === 0) return null;
  return (
    <Section surface="deep-alt" aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId} reveal="fade">
        {homeSections.services}
      </SectionHeading>
      <p className={styles.intro}>{homeSections.servicesIntro}</p>
      <Reveal>
        <Accordion
          columns={3}
          headingLevel={3}
          titleVariant="display"
          items={services.map((service) => ({
            id: service.id,
            title: service.name,
            content: (
              <>
                <p>{service.description}</p>
                {service.deliverables.length > 0 && (
                  <>
                    <p className={styles.listLabel}>{homeSections.deliverablesLabel}</p>
                    <ul className={styles.bullets}>
                      {service.deliverables.map((item, i) => (
                        <li key={`${i}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ),
          }))}
        />
      </Reveal>
    </Section>
  );
}
