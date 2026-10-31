/**
 * FaqPreview (UI-110; behaviour of frontend/ UI-017, REQ-006): heading, the preview FAQs (API order) in a collapsed
 * two-column hairline accordion, and a "See all FAQs" ArrowLink to /faqs. Answers are plain text; blank lines
 * become paragraphs. Zero FAQs → nothing rendered.
 */
import { useId } from "react";
import type { Faq } from "@/api/types";
import { actions, faqPreview } from "@/features/public/content/copy";
import { toParagraphs } from "@/shared/utils/text";
import { Accordion } from "../Accordion/Accordion";
import { ArrowLink } from "../ArrowLink/ArrowLink";
import { Reveal } from "../Reveal/Reveal";
import { Section, type Surface } from "../Section/Section";
import { SectionHeading } from "../SectionHeading/SectionHeading";

export interface FaqPreviewProps {
  faqs: Faq[];
  surface?: Surface;
}

export function FaqPreview({ faqs, surface = "base" }: FaqPreviewProps) {
  const headingId = useId();
  if (faqs.length === 0) return null;
  return (
    <Section surface={surface} aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId} reveal="fade" action={<ArrowLink to="/faqs">{actions.seeAllFaqs}</ArrowLink>}>
        {faqPreview.heading}
      </SectionHeading>
      <Reveal>
        <Accordion
          columns={2}
          headingLevel={3}
          items={faqs.map((faq) => ({
            id: faq.id,
            title: faq.question,
            content: toParagraphs(faq.answer).map((paragraph, i) => <p key={i}>{paragraph}</p>),
          }))}
        />
      </Reveal>
    </Section>
  );
}
