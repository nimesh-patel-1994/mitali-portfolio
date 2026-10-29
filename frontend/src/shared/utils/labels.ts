/** Enum labels shared by the public site and the admin (ui-scope 3.4). Values come from the API contract. */
import type { BudgetRange, EnquiryType, WritingFormat } from "@/api/types";

export const writingFormatLabels: Record<WritingFormat, string> = {
  blog: "Blog",
  web_copy: "Web copy",
  email: "Email",
  social: "Social",
  landing_page: "Landing page",
  newsletter: "Newsletter",
};

export const writingFormats = Object.keys(writingFormatLabels) as WritingFormat[];

export function isWritingFormat(value: string | null | undefined): value is WritingFormat {
  return value !== null && value !== undefined && Object.hasOwn(writingFormatLabels, value);
}

export const enquiryTypeLabels: Record<EnquiryType, string> = {
  content_strategy: "Content strategy",
  copywriting: "Copywriting",
  seo_content: "SEO content",
  brand_messaging: "Brand messaging",
  campaign_planning: "Campaign planning",
  other: "Other",
};

/** No currency symbol until tech-spec open question 2 is resolved. */
export const budgetRangeLabels: Record<BudgetRange, string> = {
  under_1000: "Under 1,000",
  "1000_3000": "1,000–3,000",
  "3000_7500": "3,000–7,500",
  "7500_15000": "7,500–15,000",
  over_15000: "Over 15,000",
  not_sure: "Not sure",
};
