/** In-memory ContentSource built from the contract fixtures (same composition rules as the api source). */
import { mapCaseStudyDetail, mapWritingSampleDetail } from "@/app/content-mappers";
import { parseDetailKey, throwNotFound, type ContentSource } from "@/app/content-source";
import { HOME_FEATURED_LIMIT, type ContentData, type ContentKey } from "@/app/content-types";
import * as fx from "./fixtures";

export function fixtureData(key: ContentKey): unknown {
  const detail = parseDetailKey(key);
  if (detail?.collection === "work") {
    const raw = fx.caseStudyDetail(detail.slug);
    return raw ? mapCaseStudyDetail(raw) : throwNotFound();
  }
  if (detail?.collection === "writing") {
    const raw = fx.writingSampleDetail(detail.slug);
    return raw ? mapWritingSampleDetail(raw) : throwNotFound();
  }
  switch (key) {
    case "site":
      return fx.site;
    case "home":
      return {
        featured_case_studies: fx.caseStudies.filter((c) => c.is_featured).slice(0, HOME_FEATURED_LIMIT),
        services: fx.services,
        engagement_models: fx.engagementModels,
        testimonials: fx.testimonials,
        faq_preview: fx.faqPreview,
      };
    case "work":
      return { case_studies: fx.caseStudies, faq_preview: fx.faqPreview };
    case "writing":
      return { samples: fx.writingSamples };
    case "about":
      return { values: fx.values, process_steps: fx.processSteps, faq_preview: fx.faqPreview };
    case "contact":
      return { faq_preview: fx.faqPreview };
    case "faqs":
      return { groups: fx.faqGroups };
    default:
      return throwNotFound();
  }
}

export function createFixtureSource(overrides: Partial<Record<ContentKey, () => unknown>> = {}): ContentSource {
  return {
    async get<K extends ContentKey>(key: K): Promise<ContentData<K>> {
      const override = overrides[key];
      return (override ? override() : fixtureData(key)) as ContentData<K>;
    },
  };
}
