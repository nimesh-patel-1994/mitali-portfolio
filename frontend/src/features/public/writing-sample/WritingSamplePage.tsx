/**
 * Writing-sample page `/writing/:slug` (UI-030, REQ-031, REQ-022, REQ-023, REQ-050).
 * Dark header block: format chip, h1, meta (client, date in `<time>` formatted in UTC, reading time), tags,
 * "Sample" note, thumbnail (LCP image) when present. Cream body: backend-sanitized HTML at `--measure`.
 * Article footer: Back to writing + Book a call.
 */
import { useId } from "react";
import { useLoaderData } from "react-router";
import type { WritingSampleDetail } from "@/app/content-types";
import { writingSamplePage } from "@/features/public/content/copy";
import { useSiteData } from "@/features/public/layout/RootLayout";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { Chip } from "@/shared/ui/Chip/Chip";
import { ResponsiveImage } from "@/shared/ui/ResponsiveImage/ResponsiveImage";
import { SampleDataNote } from "@/shared/ui/SampleDataNote/SampleDataNote";
import { SanitizedHtml } from "@/shared/ui/SanitizedHtml/SanitizedHtml";
import { Section } from "@/shared/ui/Section/Section";
import { TextLink } from "@/shared/ui/TextLink/TextLink";
import { writingFormatLabels } from "@/shared/utils/labels";
import styles from "./WritingSamplePage.module.css";

const THUMB_SIZES = "(min-width: 1200px) 1100px, 100vw";
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

/** Formats an ISO date (`YYYY-MM-DD`) in UTC so the day never shifts with the visitor's time zone. */
export function formatPublishedDate(isoDate: string): string | null {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

export function WritingSamplePage() {
  const sample = useLoaderData() as WritingSampleDetail;
  const site = useSiteData();
  const titleId = useId();
  const published = formatPublishedDate(sample.published_on);

  return (
    <article aria-labelledby={titleId}>
      <Section surface="dark" className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.chips}>
            <Chip>{writingFormatLabels[sample.format]}</Chip>
            <SampleDataNote show={sample.is_sample} variant="sample" />
          </div>
          <h1 id={titleId} className={styles.title}>
            {sample.title}
          </h1>
          <dl className={styles.meta} aria-label={writingSamplePage.metaLabel}>
            {sample.client_name && (
              <div>
                <dt>{writingSamplePage.client}</dt>
                <dd>{sample.client_name}</dd>
              </div>
            )}
            {published && (
              <div>
                <dt>{writingSamplePage.published}</dt>
                <dd>
                  <time dateTime={sample.published_on}>{published}</time>
                </dd>
              </div>
            )}
            <div>
              <dt className="visually-hidden">{writingSamplePage.readingTimeLabel}</dt>
              <dd>{writingSamplePage.readingTime(sample.reading_time_min)}</dd>
            </div>
          </dl>
          {sample.tags.length > 0 && (
            <ul className={styles.tags} aria-label={writingSamplePage.tagsLabel}>
              {sample.tags.map((tag, i) => (
                <li key={`${i}-${tag}`}>
                  <Chip>{tag}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
        {sample.thumbnail && (
          <ResponsiveImage image={sample.thumbnail} sizes={THUMB_SIZES} priority className={styles.thumbnail} />
        )}
      </Section>

      <Section surface="cream">
        <SanitizedHtml html={sample.body_html} className={styles.body} />
        <footer className={styles.footer}>
          <TextLink to="/writing" direction="back">
            {writingSamplePage.backToWriting}
          </TextLink>
          <div className={styles.cta}>
            <p className={styles.closing}>{writingSamplePage.closing}</p>
            <BookCallLink bookingUrl={site?.settings.booking_url} />
          </div>
        </footer>
      </Section>
    </article>
  );
}
