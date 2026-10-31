/**
 * Home page (UI-111, TS-026, REQ-086, REQ-010..REQ-015, REQ-006). Sections and surfaces in order:
 * hero (base) > featured work (base) > services (deep-alt) > engagement models (band) > story (base)
 * > testimonials (deep) > FAQ preview (base) > footer. Data sections hide themselves when empty.
 */
import { useLoaderData } from "react-router";
import type { HomeData } from "@/app/content-types";
import { useSiteData } from "@/app/RootLayout";
import { FaqPreview } from "@/shared/ui/FaqPreview/FaqPreview";
import { StoryBlock } from "@/shared/ui/StoryBlock/StoryBlock";
import { EngagementModels } from "./EngagementModels";
import { FeaturedWork } from "./FeaturedWork";
import { HomeHero } from "./HomeHero";
import { ServicesSection } from "./ServicesSection";
import { TestimonialsSection } from "./TestimonialsSection";

export function HomePage() {
  const data = useLoaderData() as HomeData;
  const site = useSiteData();
  const bookingUrl = site?.settings.booking_url;
  return (
    <>
      <HomeHero bookingUrl={bookingUrl} />
      <FeaturedWork caseStudies={data.featured_case_studies} />
      <ServicesSection services={data.services} />
      <EngagementModels models={data.engagement_models} bookingUrl={bookingUrl} />
      {site && <StoryBlock profile={site.profile} />}
      <TestimonialsSection testimonials={data.testimonials} />
      <FaqPreview faqs={data.faq_preview} />
    </>
  );
}
