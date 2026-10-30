/**
 * Work page (UI-027, REQ-020, REQ-006): h1 with tape, short intro, every published case study in display order,
 * then the FAQ preview on dark. Empty → "New case studies are on the way" with a link to Contact.
 */
import { useId } from "react";
import { useLoaderData } from "react-router";
import type { WorkData } from "@/app/content-types";
import { workPage } from "@/features/public/content/copy";
import { ButtonLink } from "@/shared/ui/Button/ButtonLink";
import { CardGrid, CaseStudyCard } from "@/shared/ui/Card/Card";
import { FaqPreview } from "@/shared/ui/FaqPreview/FaqPreview";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { TapeDivider } from "@/shared/ui/TapeDivider/TapeDivider";
import styles from "@/features/public/content/PageIntro.module.css";

export function WorkPage() {
  const data = useLoaderData() as WorkData;
  const headingId = useId();
  const empty = data.case_studies.length === 0;
  return (
    <>
      <Section surface="cream" first aria-labelledby={headingId}>
        <SectionHeading level={1} id={headingId}>
          {workPage.heading}
        </SectionHeading>
        <p className={styles.intro}>{workPage.intro}</p>
        {empty ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyHeading}>{workPage.emptyHeading}</h2>
            <p>{workPage.emptyBody}</p>
            <ButtonLink href="/contact" variant="primary">
              {workPage.emptyAction}
            </ButtonLink>
          </div>
        ) : (
          <CardGrid>
            {data.case_studies.map((cs, index) => (
              // The first card's image is the page's LCP element (REQ-NFR-004).
              <CaseStudyCard key={cs.slug} caseStudy={cs} headingLevel={2} priority={index === 0} />
            ))}
          </CardGrid>
        )}
      </Section>
      {data.faq_preview.length > 0 && <TapeDivider side="right" />}
      <FaqPreview faqs={data.faq_preview} surface="dark" />
    </>
  );
}
