/** Admin aliases for the generated contract schemas (docs/api-contract.yaml). */
import type { components } from "@/api/schema";

type S = components["schemas"];

export type AdminSession = S["AdminSession"];
export type Dashboard = S["Dashboard"];
export type ImageRef = S["ImageRef"];
export type ImageLayout = S["ImageLayout"];
export type WritingFormat = S["WritingFormat"];
export type CtaTarget = S["CtaTarget"];
export type EnquiryStatus = S["EnquiryStatus"];
export type EnquiryType = S["EnquiryType"];
export type BudgetRange = S["BudgetRange"];

export type AdminCaseStudyListItem = S["AdminCaseStudyListItem"];
export type AdminCaseStudy = S["AdminCaseStudy"];
export type CaseStudyInput = S["CaseStudyInput"];
export type AdminCaseStudyResult = S["AdminCaseStudyResult"];
export type CaseStudyResultInput = S["CaseStudyResultInput"];
export type AdminCaseStudyImage = S["AdminCaseStudyImage"];
export type CaseStudyImageInput = S["CaseStudyImageInput"];

export type AdminWritingSampleListItem = S["AdminWritingSampleListItem"];
export type AdminWritingSample = S["AdminWritingSample"];
export type WritingSampleInput = S["WritingSampleInput"];

export type AdminService = S["AdminService"];
export type ServiceInput = S["ServiceInput"];
export type AdminEngagementModel = S["AdminEngagementModel"];
export type EngagementModelInput = S["EngagementModelInput"];
export type AdminTestimonial = S["AdminTestimonial"];
export type TestimonialInput = S["TestimonialInput"];
export type AdminFaqCategory = S["AdminFaqCategory"];
export type FaqCategoryInput = S["FaqCategoryInput"];
export type AdminFaq = S["AdminFaq"];
export type FaqInput = S["FaqInput"];
export type AdminCoreValue = S["AdminCoreValue"];
export type CoreValueInput = S["CoreValueInput"];
export type AdminProcessStep = S["AdminProcessStep"];
export type ProcessStepInput = S["ProcessStepInput"];

export type MediaAsset = S["MediaAsset"];
export type MediaPage = S["MediaPage"];
export type MarkdownPreview = S["MarkdownPreview"];

export type AdminProfile = S["AdminProfile"];
export type ProfileInput = S["ProfileInput"];
export type AdminSettings = S["AdminSettings"];
export type SettingsInput = S["SettingsInput"];
export type SocialLink = S["SocialLink"];

export type EnquirySummary = S["EnquirySummary"];
export type Enquiry = S["Enquiry"];
export type EnquiryPage = S["EnquiryPage"];
