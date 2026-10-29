/**
 * Case-study page `/work/:slug` (UI-028, REQ-021, REQ-022, REQ-023, REQ-050). Sections (ui-scope 1.4):
 * Cover (deepest, LCP image) > Details, problem, solution (cream) > Results (dark) > Gallery (cream)
 * > More work (dark). Empty sections are hidden; when "More work" is empty its "View all work" link moves to the
 * last visible section. Unknown or unpublished slugs never reach this component (loader 404 → UI-034).
 */
import { useId } from "react";
import { useLoaderData } from "react-router";
import type { CaseStudyResult } from "@/api/types";
import type { CaseStudyDetail } from "@/app/content-types";
import { actions, caseStudyPage } from "@/features/public/content/copy";
import { CardGrid, CaseStudyCard } from "@/shared/ui/Card/Card";
import { Chip } from "@/shared/ui/Chip/Chip";
import { ResponsiveImage } from "@/shared/ui/ResponsiveImage/ResponsiveImage";
import { SampleDataNote } from "@/shared/ui/SampleDataNote/SampleDataNote";
import { SanitizedHtml } from "@/shared/ui/SanitizedHtml/SanitizedHtml";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { TapeDivider } from "@/shared/ui/TapeDivider/TapeDivider";
import { TextLink } from "@/shared/ui/TextLink/TextLink";
import { cx } from "@/shared/utils/cx";
import styles from "./CaseStudyPage.module.css";

const COVER_SIZES = "100vw";
const FULL_TILE_SIZES = "(min-width: 1368px) 1320px, 100vw";
const HALF_TILE_SIZES = "(min-width: 1368px) 660px, (min-width: 810px) 50vw, 100vw";

interface DetailRow {
  label: string;
  value: string;
}

function detailRows(cs: CaseStudyDetail): DetailRow[] {
  const rows: DetailRow[] = [
    { label: caseStudyPage.client, value: cs.client_name },
    { label: caseStudyPage.year, value: String(cs.year) },
    { label: caseStudyPage.industry, value: cs.client_industry },
    { label: caseStudyPage.timeline, value: cs.timeline },
    { label: caseStudyPage.campaignType, value: cs.campaign_type },
    { label: caseStudyPage.channels, value: cs.channels.join(", ") },
  ];
  return rows.filter((row) => row.value.trim() !== "");
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
  const storyId = useId();
  const resultsId = useId();
  const galleryId = useId();
  const moreId = useId();

  const rows = detailRows(cs);
  const hasResults = cs.results.length > 0;
  const hasGallery = cs.images.length > 0;
  const moreWork = cs.more_work.slice(0, 2);
  const hasMore = moreWork.length > 0;
  const allWorkLink = <TextLink to="/work">{actions.viewAllWork}</TextLink>;

  return (
    <article aria-labelledby={titleId}>
      <Section surface="deepest" padded={false} container="wide" className={styles.cover}>
        <ResponsiveImage image={cs.cover} sizes={COVER_SIZES} priority className={styles.coverImage} />
      </Section>

      <Section surface="cream" aria-labelledby={titleId}>
        <SectionHeading level={1} id={titleId} action={<Chip>{cs.campaign_type}</Chip>}>
          {cs.title}
        </SectionHeading>
        <div className={styles.details}>
          <div className={styles.detailsText}>
            <SampleDataNote show={cs.is_sample} variant="caseStudy" />
            <p className={styles.summary}>{cs.summary}</p>
          </div>
          {rows.length > 0 && (
            <dl className={styles.facts} aria-label={caseStudyPage.detailsLabel}>
              {rows.map((row) => (
                <div key={row.label} className={styles.fact}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </Section>

      <Section surface="cream" aria-labelledby={storyId} className={styles.story}>
        <div className={styles.split}>
          <h2 id={storyId} className={styles.splitHeading}>
            {caseStudyPage.problem}
          </h2>
          <SanitizedHtml html={cs.problem_html} className={styles.splitBody} />
        </div>
        <div className={styles.split}>
          <h2 className={styles.splitHeading}>{caseStudyPage.solution}</h2>
          <SanitizedHtml html={cs.solution_html} className={styles.splitBody} />
        </div>
        {!hasMore && !hasGallery && !hasResults && <div className={styles.trailingLink}>{allWorkLink}</div>}
      </Section>

      {hasResults && (
        <>
          <TapeDivider side="left" />
          <Section surface="dark" aria-labelledby={resultsId}>
            <SectionHeading level={2} id={resultsId}>
              {caseStudyPage.results}
            </SectionHeading>
            <SampleDataNote show={cs.results.some((r) => r.is_sample)} variant="data" className={styles.resultsNote} />
            <ul className={styles.results}>
              {cs.results.map((result) => (
                <ResultItem key={result.id} result={result} />
              ))}
            </ul>
            {!hasMore && !hasGallery && <div className={styles.trailingLink}>{allWorkLink}</div>}
          </Section>
        </>
      )}

      {hasGallery && (
        <Section surface="cream" container="wide" aria-labelledby={galleryId}>
          <h2 id={galleryId} className="visually-hidden">
            {caseStudyPage.gallery}
          </h2>
          <ul className={styles.gallery}>
            {cs.images.map((tile) => (
              <li key={tile.id} className={cx(styles.tile, tile.layout === "half" ? styles.half : styles.full)}>
                <figure className={styles.figure}>
                  <ResponsiveImage
                    image={tile.image}
                    sizes={tile.layout === "half" ? HALF_TILE_SIZES : FULL_TILE_SIZES}
                    className={styles.tileImage}
                  />
                  {tile.caption && <figcaption className={styles.caption}>{tile.caption}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
          {!hasMore && <div className={styles.trailingLink}>{allWorkLink}</div>}
        </Section>
      )}

      {hasMore && (
        <>
          <TapeDivider side="right" />
          <Section surface="dark" aria-labelledby={moreId}>
            <SectionHeading level={2} id={moreId} action={allWorkLink}>
              {caseStudyPage.moreWork}
            </SectionHeading>
            <CardGrid>
              {moreWork.map((item) => (
                <CaseStudyCard key={item.slug} caseStudy={item} headingLevel={3} />
              ))}
            </CardGrid>
          </Section>
        </>
      )}
    </article>
  );
}
