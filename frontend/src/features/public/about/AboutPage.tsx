/**
 * About page (UI-031, REQ-040, REQ-014, REQ-006). Sections (ui-scope 1.4):
 * Hero (deepest) > Origin (cream) > Vision (dark) > Values (cream) > Process staircase (dark) > Story (cream)
 * > FAQ preview (cream) > CTA band (dark). Values and steps hide when empty.
 * Process steps are an `<ol>` in display order; the staircase is pure CSS grid placement by `:nth-child`, so DOM and
 * reading order never change.
 */
import { useId } from "react";
import { useLoaderData } from "react-router";
import type { AboutData } from "@/app/content-types";
import { aboutPage, actions } from "@/features/public/content/copy";
import { useSiteData } from "@/features/public/layout/RootLayout";
import { BookCallLink } from "@/shared/ui/Button/BookCallLink";
import { ButtonLink } from "@/shared/ui/Button/ButtonLink";
import { CtaBand } from "@/shared/ui/CtaBand/CtaBand";
import { FaqPreview } from "@/shared/ui/FaqPreview/FaqPreview";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";
import { StoryBlock } from "@/shared/ui/StoryBlock/StoryBlock";
import { TapeDivider } from "@/shared/ui/TapeDivider/TapeDivider";
import styles from "./AboutPage.module.css";

export function AboutPage() {
  const data = useLoaderData() as AboutData;
  const site = useSiteData();
  const heroId = useId();
  const originId = useId();
  const visionId = useId();
  const valuesId = useId();
  const processId = useId();
  const bookingUrl = site?.settings.booking_url;
  const origin = site?.profile.origin_statement.trim() ?? "";
  const visionBlocks = site?.profile.vision_blocks ?? [];

  return (
    <>
      <Section surface="deepest" aria-labelledby={heroId} className={styles.hero}>
        <h1 id={heroId} className={styles.statement}>
          {aboutPage.heroLines.map((line) => (
            <span key={line} className={styles.line}>
              {line}
            </span>
          ))}
        </h1>
        <div className={styles.heroAside}>
          <p className={styles.heroIntro}>{aboutPage.intro}</p>
          <div className={styles.actions}>
            <BookCallLink bookingUrl={bookingUrl} variant="primary" />
            <ButtonLink href="/work" variant="secondary">
              {actions.viewWork}
            </ButtonLink>
          </div>
        </div>
      </Section>

      {origin !== "" && (
        <Section surface="cream" aria-labelledby={originId}>
          <div className={styles.labelled}>
            <h2 id={originId} className={styles.tapeLabel}>
              {aboutPage.originLabel}
            </h2>
            <p className={styles.origin}>{origin}</p>
          </div>
        </Section>
      )}

      {visionBlocks.length > 0 && (
        <>
          <TapeDivider side="right" />
          <Section surface="dark" aria-labelledby={visionId}>
            <SectionHeading level={2} id={visionId}>
              {aboutPage.visionHeading}
            </SectionHeading>
            <div className={styles.vision}>
              {visionBlocks.map((block, i) => (
                <div key={`${i}-${block.heading}`} className={styles.visionBlock}>
                  <h3 className={styles.visionHeading}>{block.heading}</h3>
                  <p className={styles.muted}>{block.body}</p>
                </div>
              ))}
            </div>
          </Section>
          <TapeDivider side="left" />
        </>
      )}

      {data.values.length > 0 && (
        <Section surface="cream" aria-labelledby={valuesId}>
          <div className={styles.labelled}>
            <h2 id={valuesId} className={styles.tapeLabel}>
              {aboutPage.valuesLabel}
            </h2>
            <ul className={styles.values}>
              {data.values.map((value) => (
                <li key={value.id} className={styles.value}>
                  <h3 className={styles.valueTitle}>{value.title}</h3>
                  <p className={styles.muted}>{value.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {data.process_steps.length > 0 && (
        <>
          <TapeDivider side="right" />
          <Section surface="dark" aria-labelledby={processId}>
            <SectionHeading level={2} id={processId}>
              {aboutPage.processHeading}
            </SectionHeading>
            <ol className={styles.staircase}>
              {data.process_steps.map((step, i) => (
                <li key={step.id} className={styles.step}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </Section>
        </>
      )}

      {site && <StoryBlock profile={site.profile} />}
      <FaqPreview faqs={data.faq_preview} />
      <CtaBand bookingUrl={bookingUrl} />
    </>
  );
}
