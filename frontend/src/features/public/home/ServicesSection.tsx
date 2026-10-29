/**
 * Home: services (UI-024, REQ-012). Dark-olive section with an accordion of services: name (display, green on dark)
 * and plus icon; the panel shows the description and a deliverables list. 3 / 2 / 1 columns, DOM order = API order.
 */
import { useId } from "react";
import type { Service } from "@/api/types";
import { homeSections } from "@/features/public/content/copy";
import { Accordion } from "@/shared/ui/Accordion/Accordion";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import styles from "./HomeSections.module.css";

export interface ServicesSectionProps {
  services: Service[];
}

export function ServicesSection({ services }: ServicesSectionProps) {
  const headingId = useId();
  if (services.length === 0) return null;
  return (
    <Section surface="dark" aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId}>
        {homeSections.services}
      </SectionHeading>
      <p className={styles.intro}>{homeSections.servicesIntro}</p>
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
    </Section>
  );
}
