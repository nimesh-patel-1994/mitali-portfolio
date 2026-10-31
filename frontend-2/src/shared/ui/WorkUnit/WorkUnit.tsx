/**
 * Cardless content unit (DES-052; behaviour of frontend/ UI-010): image in a fixed 16:9 frame (radius lg), a label
 * row (campaign-type chip), the title in display 300 as the unit's single link (stretched over the whole unit, with
 * the diagonal arrow swap on hover/focus), and the summary in muted ink. No card chrome; lists separate units with
 * hairlines. `UnitGrid` = 1 column below --bp-md, 2 columns from --bp-md.
 */
import { Children, type ReactNode } from "react";
import type { CaseStudySummary } from "@/api/types";
import { cx } from "@/shared/utils/cx";
import { AppLink } from "../AppLink/AppLink";
import { Chip } from "../Chip/Chip";
import { ArrowUpRightIcon } from "../Icon/Icon";
import { Reveal } from "../Reveal/Reveal";
import { ResponsiveImage } from "../ResponsiveImage/ResponsiveImage";
import styles from "./WorkUnit.module.css";

/** Unit images fill one of two columns from --bp-md, the full width below. */
export const UNIT_IMAGE_SIZES = "(min-width: 768px) 50vw, 100vw";

export interface CaseStudyUnitProps {
  caseStudy: CaseStudySummary;
  headingLevel?: 2 | 3;
  priority?: boolean;
}

export function CaseStudyUnit({ caseStudy, headingLevel = 3, priority = false }: CaseStudyUnitProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article className={styles.unit}>
      <ResponsiveImage
        image={caseStudy.cover}
        sizes={UNIT_IMAGE_SIZES}
        ratio="16x9"
        radius="lg"
        priority={priority}
        className={styles.media}
      />
      <div className={styles.labels}>
        <Chip>{caseStudy.campaign_type}</Chip>
      </div>
      <Heading className={styles.title}>
        <AppLink to={`/work/${caseStudy.slug}`} className={styles.link}>
          <span className={styles.titleText}>{caseStudy.title}</span>
          <span className={styles.arrows} aria-hidden="true">
            <ArrowUpRightIcon className={cx(styles.arrow, styles.out)} />
            <ArrowUpRightIcon className={cx(styles.arrow, styles.in)} />
          </span>
        </AppLink>
      </Heading>
      <p className={styles.summary}>{caseStudy.summary}</p>
    </article>
  );
}

export interface UnitGridProps {
  children: ReactNode;
  className?: string;
}

/** Each unit is a list item with a top hairline and its own reveal (stagger via :nth-child). */
export function UnitGrid({ children, className }: UnitGridProps) {
  return (
    <ul className={cx(styles.grid, className)}>
      {Children.map(children, (child) => (
        <Reveal as="li" className={styles.item}>
          {child}
        </Reveal>
      ))}
    </ul>
  );
}
