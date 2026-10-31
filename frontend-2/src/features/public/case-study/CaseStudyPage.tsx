/**
 * Case-study page `/work/:slug` (UI-112, TS-026, REQ-021, REQ-022, REQ-023, REQ-050). Order:
 * title block (base; h1 at --text-display, campaign-type chip, "Sample case study" note) > cover as a full-bleed
 * parallax MediaBand (the page's priority/LCP image) > MetaRow (Client, Year, Industry, Timeline, Campaign type,
 * Channels) > summary as a 50/50 intro split > Problem and Solution as offset text blocks (SanitizedHtml) >
 * results (deep; big values in display 300, label, before/change/period, "Sample data") > gallery (Collage: full
 * tiles span the width, halves side by side from 768 px, stacked below) > "More work" (2 units + "View all work",
 * heading with the page's single slide-in reveal). Sections hide when empty; when "More work" is empty its "View all
 * work" link moves to the last visible section. Unknown or unpublished slugs never reach this component (loader 404
 * → UI-115).
 */
import { useId } from "react";
import { useLoaderData } from "react-router";
import type { CaseStudyResult } from "@/api/types";
import type { CaseStudyDetail } from "@/app/content-types";
import { actions, caseStudyMeta, caseStudyPage } from "@/features/public/content/copy";
import { ArrowLink } from "@/shared/ui/ArrowLink/ArrowLink";
import { Chip } from "@/shared/ui/Chip/Chip";
import { Collage } from "@/shared/ui/Collage/Collage";
import { IntroSplit } from "@/shared/ui/IntroSplit/IntroSplit";
import { MediaBand } from "@/shared/ui/MediaBand/MediaBand";
import { MetaRow, type MetaField } from "@/shared/ui/MetaRow/MetaRow";
import { OffsetText } from "@/shared/ui/OffsetText/OffsetText";
import { Reveal } from "@/shared/ui/Reveal/Reveal";
import { ResponsiveImage } from "@/shared/ui/ResponsiveImage/ResponsiveImage";
import { SampleDataNote } from "@/shared/ui/SampleDataNote/SampleDataNote";
import { SanitizedHtml } from "@/shared/ui/SanitizedHtml/SanitizedHtml";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { CaseStudyUnit, UnitGrid } from "@/shared/ui/WorkUnit/WorkUnit";
import styles from "./CaseStudyPage.module.css";

const COVER_SIZES = "100vw";
const FULL_TILE_SIZES = "100vw";
const HALF_TILE_SIZES = "(min-width: 768px) 50vw, 100vw";

export function metaFields(cs: CaseStudyDetail): MetaField[] {
  return [
    { label: caseStudyPage.client, value: cs.client_name },
    { label: caseStudyPage.year, value: String(cs.year) },
    { label: caseStudyPage.industry, value: cs.client_industry },
    { label: caseStudyPage.timeline, value: cs.timeline },
    { label: caseStudyPage.campaignType, value: cs.campaign_type },
    { label: caseStudyPage.channels, value: cs.channels.join(", ") },
  ];
}

function ResultItem({ result }: { result: CaseStudyResult }) {
  return (
    <li className={styles.result}>
      <p className={styles.resultValue}>{result.value}</p>
      <p className={styles.resultLabel}>{result.metric_label}</p>
      {(result.before_value || result.change_text || result.period) && (
        <dl className={styles.resultMeta}>
          {result.before_value && (
            <div>
              <dt>{caseStudyPage.before}</dt>
              <dd>{result.before_value}</dd>
            </div>
          )}
          {result.change_text && (
            <div>
              <dt>{caseStudyPage.change}</dt>
              <dd>{result.change_text}</dd>
            </div>
          )}
          {result.period && (
            <div>
              <dt>{caseStudyPage.period}</dt>
              <dd>{result.period}</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

export function CaseStudyPage() {
  const cs = useLoaderData() as CaseStudyDetail;
  const titleId = useId();
  const problemId = useId();
  const solutionId = useId();
  const resultsId = useId();
  const galleryId = useId();
  const moreId = useId();

  const hasResults = cs.results.length > 0;
  const hasGallery = cs.images.length > 0;
  const moreWork = cs.more_work.slice(0, 2);
  const hasMore = moreWork.length > 0;
  const allWorkLink = <ArrowLink to="/work">{actions.viewAllWork}</ArrowLink>;

  return (
    <article aria-labelledby={titleId}>
      <Section surface="base" aria-labelledby={titleId} className={styles.titleBlock}>
        <div className={styles.labels}>
          <Chip>{cs.campaign_type}</Chip>
          <SampleDataNote show={cs.is_sample} variant="caseStudy" />
        </div>
        <SectionHeading level={1} size="display" id={titleId}>
          {cs.title}
        </SectionHeading>
      </Section>

      <div className={`bleed ${styles.cover}`} data-surface="base">
        <MediaBand image={cs.cover} sizes={COVER_SIZES} priority />
      </div>

      <Section surface="base" className={styles.story} aria-label={caseStudyPage.detailsLabel}>
        <Reveal>
          <MetaRow fields={metaFields(cs)} label={caseStudyPage.detailsLabel} />
        </Reveal>
        <IntroSplit className={styles.intro} aside={<p className={styles.introLabel}>{caseStudyMeta.summaryHeading}</p>}>
          <p>{cs.summary}</p>
        </IntroSplit>
        <OffsetText heading={caseStudyPage.problem} headingId={problemId} className={styles.offsetBlock}>
          <SanitizedHtml html={cs.problem_html} />
        </OffsetText>
        <OffsetText heading={caseStudyPage.solution} headingId={solutionId} className={styles.offsetBlock}>
          <SanitizedHtml html={cs.solution_html} />
        </OffsetText>
        {!hasMore && !hasGallery && !hasResults && <div className={styles.trailingLink}>{allWorkLink}</div>}
      </Section>

      {hasResults && (
        <Section surface="deep" aria-labelledby={resultsId}>
          <SectionHeading level={2} id={resultsId} reveal="fade">
            {caseStudyPage.results}
          </SectionHeading>
          <SampleDataNote show={cs.results.some((r) => r.is_sample)} variant="data" className={styles.resultsNote} />
          <Reveal>
            <ul className={styles.results}>
              {cs.results.map((result) => (
                <ResultItem key={result.id} result={result} />
              ))}
            </ul>
          </Reveal>
          {!hasMore && !hasGallery && <div className={styles.trailingLink}>{allWorkLink}</div>}
        </Section>
      )}

      {hasGallery && (
        <Section surface="base" aria-labelledby={galleryId}>
          <h2 id={galleryId} className="visually-hidden">
            {caseStudyPage.gallery}
          </h2>
          <Collage
            items={cs.images.map((tile) => ({
              key: tile.id,
              layout: tile.layout === "half" ? "half" : "full",
              content: (
                <figure className={styles.figure}>
                  <ResponsiveImage
                    image={tile.image}
                    sizes={tile.layout === "half" ? HALF_TILE_SIZES : FULL_TILE_SIZES}
                    ratio={tile.layout === "half" ? "4x3" : "16x9"}
                    radius="lg"
                  />
                  {tile.caption && <figcaption className={styles.caption}>{tile.caption}</figcaption>}
                </figure>
              ),
            }))}
          />
          {!hasMore && <div className={styles.trailingLink}>{allWorkLink}</div>}
        </Section>
      )}

      {hasMore && (
        <Section surface="band" aria-labelledby={moreId}>
          <SectionHeading level={2} id={moreId} reveal="slide" action={allWorkLink}>
            {caseStudyPage.moreWork}
          </SectionHeading>
          <UnitGrid>
            {moreWork.map((item) => (
              <CaseStudyUnit key={item.slug} caseStudy={item} headingLevel={3} />
            ))}
          </UnitGrid>
        </Section>
      )}
    </article>
  );
}
