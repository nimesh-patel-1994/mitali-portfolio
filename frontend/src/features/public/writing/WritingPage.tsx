/**
 * Writing page with URL filter `/writing?format=` (UI-029, REQ-030, REQ-023).
 * - Filter bar `<nav aria-label="Filter by format">` of FilterChip links (All + one per format). The chips are plain
 *   links, so without JavaScript every chip loads the full list.
 * - Server render and the first client render always list every sample with "All" current (no hydration
 *   mismatch). After hydration (`useHydrated`) the `format` search param filters the list and sets the current chip.
 *   Chip clicks only change the search string; the route's `shouldRevalidate` skips the loader (no refetch).
 * - A polite live region announces the count after hydration ("Showing 2 email samples").
 * - Unknown format → All. No matches → "No samples in this format yet" + Show all. No samples → coming soon.
 */
import { useId, useState } from "react";
import { useLoaderData, useLocation, useSearchParams } from "react-router";
import type { WritingFormat } from "@/api/types";
import type { WritingData } from "@/app/content-types";
import { writingPage } from "@/features/public/content/copy";
import { useHydrated } from "@/shared/hooks/useHydrated";
import { CardGrid, WritingSampleCard } from "@/shared/ui/Card/Card";
import { FilterChip } from "@/shared/ui/Chip/Chip";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { TextLink } from "@/shared/ui/TextLink/TextLink";
import { isWritingFormat, writingFormatLabels, writingFormats } from "@/shared/utils/labels";
import intro from "@/features/public/content/PageIntro.module.css";
import styles from "./WritingPage.module.css";

export const FORMAT_PARAM = "format";

export function formatHref(format: WritingFormat | null): string {
  return format === null ? "/writing" : `/writing?${FORMAT_PARAM}=${format}`;
}

/** The active format: only after hydration, and only for known values (anything else means All). */
function useActiveFormat(): WritingFormat | null {
  const hydrated = useHydrated();
  const [params] = useSearchParams();
  const value = params.get(FORMAT_PARAM);
  return hydrated && isWritingFormat(value) ? value : null;
}

export function WritingPage() {
  const data = useLoaderData() as WritingData;
  const headingId = useId();
  const hydrated = useHydrated();
  const location = useLocation();
  const format = useActiveFormat();
  const samples = format === null ? data.samples : data.samples.filter((s) => s.format === format);
  const label = format === null ? null : writingFormatLabels[format];
  // Announce after hydration when a filter is applied or the visitor has changed it (not on a plain first load).
  // "Changed" is tracked with the render-time state adjustment pattern (no effect needed).
  const [lastSearch, setLastSearch] = useState(location.search);
  const [searchChanged, setSearchChanged] = useState(false);
  if (location.search !== lastSearch) {
    setLastSearch(location.search);
    setSearchChanged(true);
  }
  const announce = hydrated && (format !== null || searchChanged);
  const noSamples = data.samples.length === 0;

  return (
    <Section surface="cream" first aria-labelledby={headingId}>
      <SectionHeading level={1} id={headingId}>
        {writingPage.heading}
      </SectionHeading>
      <p className={intro.intro}>{writingPage.intro}</p>

      {noSamples ? (
        <div className={intro.empty}>
          <h2 className={intro.emptyHeading}>{writingPage.emptyList}</h2>
          <p>{writingPage.emptyListBody}</p>
        </div>
      ) : (
        <>
          <nav aria-label={writingPage.filterLabel} className={styles.filter}>
            <ul className={styles.chips}>
              <li>
                <FilterChip to={formatHref(null)} active={format === null}>
                  {writingPage.all}
                </FilterChip>
              </li>
              {writingFormats.map((value) => (
                <li key={value}>
                  <FilterChip to={formatHref(value)} active={format === value}>
                    {writingFormatLabels[value]}
                  </FilterChip>
                </li>
              ))}
            </ul>
          </nav>

          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {announce ? writingPage.showing(samples.length, label) : ""}
          </p>

          {samples.length === 0 ? (
            <div className={intro.empty}>
              <h2 className={intro.emptyHeading}>{writingPage.emptyFilter}</h2>
              <TextLink to={formatHref(null)}>{writingPage.showAll}</TextLink>
            </div>
          ) : (
            <CardGrid>
              {samples.map((sample, index) => (
                // The first card's image is the page's LCP element (REQ-NFR-004).
                <WritingSampleCard key={sample.slug} sample={sample} headingLevel={2} priority={index === 0} />
              ))}
            </CardGrid>
          )}
        </>
      )}
    </Section>
  );
}
