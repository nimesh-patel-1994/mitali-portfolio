/**
 * Home page (UI-022..UI-026, REQ-001, REQ-010, REQ-006, REQ-014). Sections in order (ui-scope 1.4):
 * Hero (deepest) > Featured work (cream) > Services (dark) > Engagement models (cream) > Story (cream, divider)
 * > Testimonials (dark) > FAQ preview (cream). Data sections hide themselves when empty; tapes mark dark/cream seams.
 */
import { useLoaderData } from "react-router";
import type { HomeData } from "@/app/content-types";
import { useSiteData } from "@/features/public/layout/RootLayout";
import { FaqPreview } from "@/shared/ui/FaqPreview/FaqPreview";
import { StoryBlock } from "@/shared/ui/StoryBlock/StoryBlock";
import { TapeDivider } from "@/shared/ui/TapeDivider/TapeDivider";
import { EngagementModels } from "./EngagementModels";
import { FeaturedWork } from "./FeaturedWork";
import { HomeHero } from "./HomeHero";
import styles from "./HomeSections.module.css";
import { ServicesSection } from "./ServicesSection";
import { TestimonialsSection } from "./TestimonialsSection";

export function HomePage() {
  const data = useLoaderData() as HomeData;
  const site = useSiteData();
  const bookingUrl = site?.settings.booking_url;
  const hasServices = data.services.length > 0;
  const hasModels = data.engagement_models.length > 0;
  const hasTestimonials = data.testimonials.length > 0;
  const hasStory = site !== undefined && site.profile.bio.some((p) => p.trim() !== "");
  return (
    <>
      <HomeHero bookingUrl={bookingUrl} />
      <FeaturedWork caseStudies={data.featured_case_studies} />
      {hasServices && <TapeDivider side="right" />}
      <ServicesSection services={data.services} />
      {hasServices && <TapeDivider side="left" />}
      <EngagementModels models={data.engagement_models} bookingUrl={bookingUrl} />
      {hasStory && hasModels && (
        <div data-surface="cream" aria-hidden="true">
          <div className="container">
            <hr className={styles.rule} />
          </div>
        </div>
      )}
      {site && <StoryBlock profile={site.profile} />}
      {hasTestimonials && <TapeDivider side="right" />}
      <TestimonialsSection testimonials={data.testimonials} />
      {hasTestimonials && data.faq_preview.length > 0 && <TapeDivider side="left" />}
      <FaqPreview faqs={data.faq_preview} />
    </>
  );
}
