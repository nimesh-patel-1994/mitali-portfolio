/** Home: featured work (UI-111, REQ-011). Up to 4 cardless units in position order + "View all work"; empty → hidden. */
import { useId } from "react";
import type { CaseStudySummary } from "@/api/types";
import { HOME_FEATURED_LIMIT } from "@/app/content-types";
import { actions, homeSections } from "@/features/public/content/copy";
import { ArrowLink } from "@/shared/ui/ArrowLink/ArrowLink";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { CaseStudyUnit, UnitGrid } from "@/shared/ui/WorkUnit/WorkUnit";

export interface FeaturedWorkProps {
  caseStudies: CaseStudySummary[];
}

export function FeaturedWork({ caseStudies }: FeaturedWorkProps) {
  const headingId = useId();
  if (caseStudies.length === 0) return null;
  return (
    <Section surface="base" aria-labelledby={headingId}>
      <SectionHeading
        level={2}
        id={headingId}
        reveal="fade"
        action={<ArrowLink to="/work">{actions.viewAllWork}</ArrowLink>}
      >
        {homeSections.featuredWork}
      </SectionHeading>
      <UnitGrid>
        {caseStudies.slice(0, HOME_FEATURED_LIMIT).map((cs) => (
          <CaseStudyUnit key={cs.slug} caseStudy={cs} headingLevel={3} />
        ))}
      </UnitGrid>
    </Section>
  );
}
