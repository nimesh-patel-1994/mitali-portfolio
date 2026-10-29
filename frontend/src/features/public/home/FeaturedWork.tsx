/** Home: featured work (UI-023, REQ-011). Up to 4 case-study cards and a "View all work" link; empty → hidden. */
import { useId } from "react";
import type { CaseStudySummary } from "@/api/types";
import { HOME_FEATURED_LIMIT } from "@/app/content-types";
import { actions, homeSections } from "@/features/public/content/copy";
import { CardGrid, CaseStudyCard } from "@/shared/ui/Card/Card";
import { Reveal } from "@/shared/ui/Reveal/Reveal";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { TextLink } from "@/shared/ui/TextLink/TextLink";

export interface FeaturedWorkProps {
  caseStudies: CaseStudySummary[];
}

export function FeaturedWork({ caseStudies }: FeaturedWorkProps) {
  const headingId = useId();
  if (caseStudies.length === 0) return null;
  return (
    <Section surface="cream" aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId} action={<TextLink to="/work">{actions.viewAllWork}</TextLink>}>
        {homeSections.featuredWork}
      </SectionHeading>
      <Reveal>
        <CardGrid>
          {caseStudies.slice(0, HOME_FEATURED_LIMIT).map((cs) => (
            <CaseStudyCard key={cs.slug} caseStudy={cs} headingLevel={3} />
          ))}
        </CardGrid>
      </Reveal>
    </Section>
  );
}
