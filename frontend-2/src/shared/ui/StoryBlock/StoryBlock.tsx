/**
 * StoryBlock (UI-110; behaviour of frontend/ UI-018, REQ-014): portrait (5:6 frame, alt from the API) and the bio
 * paragraphs as an offset text block with a name sign-off. Stacked below --bp-lg. Portrait missing → fallback
 * block in the same frame; empty bio → nothing rendered.
 */
import { useId } from "react";
import type { PublicProfile } from "@/api/types";
import { story } from "@/features/public/content/copy";
import { Reveal } from "../Reveal/Reveal";
import { ResponsiveImage } from "../ResponsiveImage/ResponsiveImage";
import { Section, type Surface } from "../Section/Section";
import { SectionHeading } from "../SectionHeading/SectionHeading";
import styles from "./StoryBlock.module.css";

export interface StoryBlockProps {
  profile: Pick<PublicProfile, "name" | "bio" | "portrait">;
  surface?: Surface;
}

const PORTRAIT_SIZES = "(min-width: 1024px) 33vw, 100vw";

export function StoryBlock({ profile, surface = "base" }: StoryBlockProps) {
  const headingId = useId();
  const paragraphs = profile.bio.filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return null;
  return (
    <Section surface={surface} aria-labelledby={headingId}>
      <div className={`grid12 ${styles.layout}`}>
        <Reveal className={styles.portrait}>
          <ResponsiveImage image={profile.portrait} sizes={PORTRAIT_SIZES} ratio="5x6" radius="lg" />
        </Reveal>
        <div className={styles.text}>
          <SectionHeading level={2} id={headingId} reveal="fade">
            {story.heading}
          </SectionHeading>
          <Reveal className={styles.bio}>
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            <p className={styles.signoff}>— {profile.name}</p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
