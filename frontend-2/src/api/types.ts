/** Friendly aliases for the generated contract schemas (docs/api-contract.yaml). */
import type { components } from "./schema";

type Schemas = components["schemas"];

export type ApiError = Schemas["Error"];
export type ImageRef = Schemas["ImageRef"];
export type ImageSource = Schemas["ImageSource"];
export type SiteBundle = Schemas["SiteBundle"];
export type PublicSettings = Schemas["PublicSettings"];
export type PublicProfile = Schemas["PublicProfile"];
export type SocialLink = Schemas["SocialLink"];
export type CaseStudySummary = Schemas["CaseStudySummary"];
export type CaseStudyDetailRaw = Schemas["CaseStudyDetail"];
export type CaseStudyResult = Schemas["CaseStudyResult"];
export type CaseStudyImage = Schemas["CaseStudyImage"];
export type WritingFormat = Schemas["WritingFormat"];
export type WritingSampleSummary = Schemas["WritingSampleSummary"];
export type WritingSampleDetailRaw = Schemas["WritingSampleDetail"];
export type Service = Schemas["Service"];
export type EngagementModel = Schemas["EngagementModel"];
export type Testimonial = Schemas["Testimonial"];
export type Faq = Schemas["Faq"];
export type FaqGroup = Schemas["FaqGroup"];
export type CoreValue = Schemas["CoreValue"];
export type ProcessStep = Schemas["ProcessStep"];
export type EnquiryCreate = Schemas["EnquiryCreate"];
export type EnquiryType = Schemas["EnquiryType"];
export type BudgetRange = Schemas["BudgetRange"];
