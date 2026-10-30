/**
 * Content cards (UI-010): 16:9 image, uppercase title (the single link, with a stretched hit area over the whole
 * card), outlined chip, 3-4 line muted summary. `CardGrid`: 1 column mobile, 2 columns from tablet.
 */
import { Children, type ReactNode } from "react";
import { Link } from "react-router";
import type { CaseStudySummary, WritingSampleSummary } from "@/api/types";
import { sampleNotes } from "@/features/public/content/copy";
import { cx } from "@/shared/utils/cx";
import { writingFormatLabels } from "@/shared/utils/labels";
import { Chip } from "../Chip/Chip";
import { ResponsiveImage } from "../ResponsiveImage/ResponsiveImage";
import styles from "./Card.module.css";

/** Card images fill one of two columns from tablet up, the full width below. */
export const CARD_IMAGE_SIZES = "(min-width: 810px) 50vw, 100vw";
const CARD_RATIO = { width: 16, height: 9 };

interface BaseCardProps {
  href: string;
  title: string;
  image: CaseStudySummary["cover"];
  chips: ReactNode;
  summary: string;
  headingLevel: 2 | 3;
  /** Above-the-fold LCP card (first card of a listing page): eager image with fetchpriority="high". */
  priority?: boolean;
}

function BaseCard({ href, title, image, chips, summary, headingLevel, priority = false }: BaseCardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <ResponsiveImage
          image={image}
          sizes={CARD_IMAGE_SIZES}
          fallbackRatio={CARD_RATIO}
          priority={priority}
          className={styles.image}
        />
      </div>
      <div className={styles.header}>
        <Heading className={styles.title}>
          <Link to={href} className={styles.link}>
            {title}
          </Link>
        </Heading>
        <div className={styles.chips}>{chips}</div>
      </div>
      <p className={styles.summary}>{summary}</p>
    </article>
  );
}

export interface CaseStudyCardProps {
  caseStudy: CaseStudySummary;
  headingLevel?: 2 | 3;
  priority?: boolean;
}

export function CaseStudyCard({ caseStudy, headingLevel = 3, priority }: CaseStudyCardProps) {
  return (
    <BaseCard
      href={`/work/${caseStudy.slug}`}
      title={caseStudy.title}
      image={caseStudy.cover}
      chips={<Chip>{caseStudy.campaign_type}</Chip>}
      summary={caseStudy.summary}
      headingLevel={headingLevel}
      priority={priority}
    />
  );
}

export interface WritingSampleCardProps {
  sample: WritingSampleSummary;
  headingLevel?: 2 | 3;
  priority?: boolean;
}

export function WritingSampleCard({ sample, headingLevel = 3, priority }: WritingSampleCardProps) {
  return (
    <BaseCard
      href={`/writing/${sample.slug}`}
      title={sample.title}
      image={sample.thumbnail}
      chips={
        <>
          <Chip>{writingFormatLabels[sample.format]}</Chip>
          {sample.is_sample && <Chip className={styles.sampleChip}>{sampleNotes.sample}</Chip>}
        </>
      }
      summary={sample.excerpt}
      headingLevel={headingLevel}
      priority={priority}
    />
  );
}

export interface CardGridProps {
  children: ReactNode;
  className?: string;
  /** Accessible label for the list, when the surrounding heading does not already describe it. */
  label?: string;
}

export function CardGrid({ children, className, label }: CardGridProps) {
  return (
    <ul className={cx(styles.grid, className)} aria-label={label}>
      {Children.map(children, (child) => (child === null || child === false ? null : <li className={styles.item}>{child}</li>))}
    </ul>
  );
}
