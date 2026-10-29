/**
 * FAQs page (UI-032, REQ-041): h1 with tape; one group per category in category order (h2 + accordion of h3 items,
 * two columns from tablet up), then the CTA band. No groups → "No questions published yet" + CTA band.
 */
import { useId } from "react";
import { useLoaderData } from "react-router";
import type { FaqGroup } from "@/api/types";
import type { FaqsData } from "@/app/content-types";
import { faqsPage } from "@/features/public/content/copy";
import intro from "@/features/public/content/PageIntro.module.css";
import { useSiteData } from "@/features/public/layout/RootLayout";
import { Accordion } from "@/shared/ui/Accordion/Accordion";
import { CtaBand } from "@/shared/ui/CtaBand/CtaBand";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { toParagraphs } from "@/shared/utils/text";
import styles from "./FaqsPage.module.css";

function FaqGroupBlock({ group }: { group: FaqGroup }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={styles.group}>
      <h2 id={headingId} className={styles.groupHeading}>
        {group.name}
      </h2>
      <Accordion
        columns={2}
        headingLevel={3}
        items={group.faqs.map((faq) => ({
          id: faq.id,
          title: faq.question,
          content: toParagraphs(faq.answer).map((paragraph, i) => <p key={i}>{paragraph}</p>),
        }))}
      />
    </section>
  );
}

export function FaqsPage() {
  const data = useLoaderData() as FaqsData;
  const site = useSiteData();
  const headingId = useId();
  const groups = data.groups.filter((g) => g.faqs.length > 0);
  return (
    <>
      <Section surface="cream" first aria-labelledby={headingId}>
        <SectionHeading level={1} id={headingId}>
          {faqsPage.heading}
        </SectionHeading>
        <p className={intro.intro}>{faqsPage.intro}</p>
        {groups.length === 0 ? (
          <div className={intro.empty}>
            <h2 className={intro.emptyHeading}>{faqsPage.empty}</h2>
            <p>{faqsPage.emptyBody}</p>
          </div>
        ) : (
          <div className={styles.groups}>
            {groups.map((group) => (
              <FaqGroupBlock key={group.id} group={group} />
            ))}
          </div>
        )}
      </Section>
      <CtaBand bookingUrl={site?.settings.booking_url} />
    </>
  );
}
