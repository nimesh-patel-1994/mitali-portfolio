/**
 * Data keys and the loader data shape behind each key (TS-005 step 3).
 * Public pages read only these shapes: at build time through the *api* content source, in the browser from
 * `/data/<key>.json` (static source). `*_html` fields carry the SanitizedHtmlString brand.
 */
import type { SanitizedHtmlString } from "@/api/sanitized";
import type {
  CaseStudyDetailRaw,
  CaseStudySummary,
  CoreValue,
  EngagementModel,
  Faq,
  FaqGroup,
  ProcessStep,
  Service,
  SiteBundle,
  Testimonial,
  WritingSampleDetailRaw,
  WritingSampleSummary,
} from "@/api/types";

export type CaseStudyDetail = Omit<CaseStudyDetailRaw, "problem_html" | "solution_html"> & {
  problem_html: SanitizedHtmlString;
  solution_html: SanitizedHtmlString;
};

export type WritingSampleDetail = Omit<WritingSampleDetailRaw, "body_html"> & {
  body_html: SanitizedHtmlString;
};

export interface HomeData {
  featured_case_studies: CaseStudySummary[];
  services: Service[];
  engagement_models: EngagementModel[];
  testimonials: Testimonial[];
  faq_preview: Faq[];
}

export interface WorkData {
  case_studies: CaseStudySummary[];
  faq_preview: Faq[];
}

export interface WritingData {
  samples: WritingSampleSummary[];
}

export interface AboutData {
  values: CoreValue[];
  process_steps: ProcessStep[];
  faq_preview: Faq[];
}

export interface ContactData {
  faq_preview: Faq[];
}

export interface FaqsData {
  groups: FaqGroup[];
}

export type StaticContentKey = "site" | "home" | "work" | "writing" | "about" | "contact" | "faqs";
export type CaseStudyKey = `work/${string}`;
export type WritingSampleKey = `writing/${string}`;
export type ContentKey = StaticContentKey | CaseStudyKey | WritingSampleKey;

export type ContentData<K extends ContentKey> = K extends "site"
  ? SiteBundle
  : K extends "home"
    ? HomeData
    : K extends "work"
      ? WorkData
      : K extends "writing"
        ? WritingData
        : K extends "about"
          ? AboutData
          : K extends "contact"
            ? ContactData
            : K extends "faqs"
              ? FaqsData
              : K extends CaseStudyKey
                ? CaseStudyDetail
                : K extends WritingSampleKey
                  ? WritingSampleDetail
                  : never;

/** Home shows at most this many featured case studies (UI-023). */
export const HOME_FEATURED_LIMIT = 4;
