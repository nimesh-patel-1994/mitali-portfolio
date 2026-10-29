/**
 * StoryBlock (UI-018, REQ-014): cream section with a monochrome portrait (decorative green tape on one corner)
 * and the bio paragraphs with a name sign-off. Stacked (portrait first) below 810 px.
 * Portrait missing → fallback block; empty bio → nothing rendered.
 */
import { useId } from "react";
import type { PublicProfile } from "@/api/types";
import { story } from "@/features/public/content/copy";
import { ResponsiveImage } from "../ResponsiveImage/ResponsiveImage";
import { Section } from "../Section/Section";
import { SectionHeading } from "../SectionHeading/SectionHeading";
import styles from "./StoryBlock.module.css";

export interface StoryBlockProps {
  profile: Pick<PublicProfile, "name" | "bio" | "portrait">;
}

const PORTRAIT_SIZES = "(min-width: 810px) 40vw, 100vw";
const PORTRAIT_RATIO = { width: 4, height: 5 };

export function StoryBlock({ profile }: StoryBlockProps) {
  const headingId = useId();
  const paragraphs = profile.bio.filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return null;
  return (
    <Section surface="cream" aria-labelledby={headingId}>
      <div className={styles.layout}>
        <div className={styles.portrait}>
          <ResponsiveImage
            image={profile.portrait}
            sizes={PORTRAIT_SIZES}
            fallbackRatio={PORTRAIT_RATIO}
            className={styles.photo}
          />
          <span className={styles.tape} aria-hidden="true" />
        </div>
        <div className={styles.text}>
          <SectionHeading level={2} id={headingId}>
            {story.heading}
          </SectionHeading>
          <div className={styles.bio}>
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <p className={styles.signoff}>— {profile.name}</p>
        </div>
      </div>
    </Section>
  );
}
