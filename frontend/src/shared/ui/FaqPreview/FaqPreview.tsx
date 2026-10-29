/**
 * FaqPreview (UI-017, REQ-006): section with a heading, the preview FAQs (API order: category position, then FAQ
 * position) in a collapsed two-column accordion, and a "See all FAQs" link. Answers are plain text; blank lines
 * become paragraphs. Zero FAQs → nothing rendered.
 */
import { useId } from "react";
import { Link } from "react-router";
import type { Faq } from "@/api/types";
import { actions, faqPreview } from "@/features/public/content/copy";
import { toParagraphs } from "@/shared/utils/text";
import { Accordion } from "../Accordion/Accordion";
import { ArrowRightIcon } from "../Icon/Icon";
import { Section, type Surface } from "../Section/Section";
import { SectionHeading } from "../SectionHeading/SectionHeading";
import styles from "./FaqPreview.module.css";

export interface FaqPreviewProps {
  faqs: Faq[];
  /** Cream on most pages; the Work page uses dark (ui-scope 1.4). */
  surface?: Surface;
}

export function FaqPreview({ faqs, surface = "cream" }: FaqPreviewProps) {
  const headingId = useId();
  if (faqs.length === 0) return null;
  return (
    <Section surface={surface} aria-labelledby={headingId}>
      <SectionHeading
        level={2}
        id={headingId}
        action={
          <Link to="/faqs" className={styles.allLink}>
            {actions.seeAllFaqs}
            <ArrowRightIcon />
          </Link>
        }
      >
        {faqPreview.heading}
      </SectionHeading>
      <Accordion
        columns={2}
        headingLevel={3}
        items={faqs.map((faq) => ({
          id: faq.id,
          title: faq.question,
          content: toParagraphs(faq.answer).map((paragraph, i) => <p key={i}>{paragraph}</p>),
        }))}
      />
    </Section>
  );
}
