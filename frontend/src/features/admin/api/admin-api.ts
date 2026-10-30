/**
 * Admin operations (UI-035): one typed function per `api-contract.yaml` operationId, all through the generated
 * `openapi-fetch` client (UI-REV-003). Each returns the response data or throws `ApiError`.
 */
import { adminClient } from "./client";
import { call } from "./errors";
import type {
  CaseStudyImageInput,
  CaseStudyInput,
  CaseStudyResultInput,
  CoreValueInput,
  EngagementModelInput,
  EnquiryStatus,
  FaqCategoryInput,
  FaqInput,
  ProcessStepInput,
  ProfileInput,
  ServiceInput,
  SettingsInput,
  TestimonialInput,
  WritingSampleInput,
} from "./types";

const c = () => adminClient();
const id = (value: string) => ({ params: { path: { id: value } } });
const nested = (value: string, itemId: string) => ({ params: { path: { id: value, itemId } } });

/* ---------------------------------------------------------------- auth + dashboard */
export const authApi = {
  adminLogin: (body: { email: string; password: string }) => call(c().POST("/api/admin/auth/login", { body })),
  adminLogout: () => call(c().POST("/api/admin/auth/logout")),
  getAdminMe: () => call(c().GET("/api/admin/auth/me")),
};

export const dashboardApi = {
  getAdminDashboard: () => call(c().GET("/api/admin/dashboard")),
};

/* ---------------------------------------------------------------- case studies */
export const caseStudyApi = {
  listAdminCaseStudies: () => call(c().GET("/api/admin/case-studies")),
  createAdminCaseStudy: (body: CaseStudyInput) => call(c().POST("/api/admin/case-studies", { body })),
  reorderAdminCaseStudies: (ids: string[]) => call(c().PUT("/api/admin/case-studies/order", { body: { ids } })),
  getAdminCaseStudy: (csId: string) => call(c().GET("/api/admin/case-studies/{id}", id(csId))),
  updateAdminCaseStudy: (csId: string, body: CaseStudyInput) =>
    call(c().PUT("/api/admin/case-studies/{id}", { ...id(csId), body })),
  deleteAdminCaseStudy: (csId: string) => call(c().DELETE("/api/admin/case-studies/{id}", id(csId))),
  createAdminCaseStudyResult: (csId: string, body: CaseStudyResultInput) =>
    call(c().POST("/api/admin/case-studies/{id}/results", { ...id(csId), body })),
  reorderAdminCaseStudyResults: (csId: string, ids: string[]) =>
    call(c().PUT("/api/admin/case-studies/{id}/results/order", { ...id(csId), body: { ids } })),
  updateAdminCaseStudyResult: (csId: string, itemId: string, body: CaseStudyResultInput) =>
    call(c().PUT("/api/admin/case-studies/{id}/results/{itemId}", { ...nested(csId, itemId), body })),
  deleteAdminCaseStudyResult: (csId: string, itemId: string) =>
    call(c().DELETE("/api/admin/case-studies/{id}/results/{itemId}", nested(csId, itemId))),
  createAdminCaseStudyImage: (csId: string, body: CaseStudyImageInput) =>
    call(c().POST("/api/admin/case-studies/{id}/images", { ...id(csId), body })),
  reorderAdminCaseStudyImages: (csId: string, ids: string[]) =>
    call(c().PUT("/api/admin/case-studies/{id}/images/order", { ...id(csId), body: { ids } })),
  updateAdminCaseStudyImage: (csId: string, itemId: string, body: CaseStudyImageInput) =>
    call(c().PUT("/api/admin/case-studies/{id}/images/{itemId}", { ...nested(csId, itemId), body })),
  deleteAdminCaseStudyImage: (csId: string, itemId: string) =>
    call(c().DELETE("/api/admin/case-studies/{id}/images/{itemId}", nested(csId, itemId))),
};

/* ---------------------------------------------------------------- writing samples */
export const writingApi = {
  listAdminWritingSamples: () => call(c().GET("/api/admin/writing-samples")),
  createAdminWritingSample: (body: WritingSampleInput) => call(c().POST("/api/admin/writing-samples", { body })),
  reorderAdminWritingSamples: (ids: string[]) => call(c().PUT("/api/admin/writing-samples/order", { body: { ids } })),
  getAdminWritingSample: (wsId: string) => call(c().GET("/api/admin/writing-samples/{id}", id(wsId))),
  updateAdminWritingSample: (wsId: string, body: WritingSampleInput) =>
    call(c().PUT("/api/admin/writing-samples/{id}", { ...id(wsId), body })),
  deleteAdminWritingSample: (wsId: string) => call(c().DELETE("/api/admin/writing-samples/{id}", id(wsId))),
};

/* ---------------------------------------------------------------- small content types */
export const serviceApi = {
  list: () => call(c().GET("/api/admin/services")),
  create: (body: ServiceInput) => call(c().POST("/api/admin/services", { body })),
  reorder: (ids: string[]) => call(c().PUT("/api/admin/services/order", { body: { ids } })),
  get: (itemId: string) => call(c().GET("/api/admin/services/{id}", id(itemId))),
  update: (itemId: string, body: ServiceInput) => call(c().PUT("/api/admin/services/{id}", { ...id(itemId), body })),
  remove: (itemId: string) => call(c().DELETE("/api/admin/services/{id}", id(itemId))),
};

export const engagementModelApi = {
  list: () => call(c().GET("/api/admin/engagement-models")),
  create: (body: EngagementModelInput) => call(c().POST("/api/admin/engagement-models", { body })),
  reorder: (ids: string[]) => call(c().PUT("/api/admin/engagement-models/order", { body: { ids } })),
  get: (itemId: string) => call(c().GET("/api/admin/engagement-models/{id}", id(itemId))),
  update: (itemId: string, body: EngagementModelInput) =>
    call(c().PUT("/api/admin/engagement-models/{id}", { ...id(itemId), body })),
  remove: (itemId: string) => call(c().DELETE("/api/admin/engagement-models/{id}", id(itemId))),
};

export const testimonialApi = {
  list: () => call(c().GET("/api/admin/testimonials")),
  create: (body: TestimonialInput) => call(c().POST("/api/admin/testimonials", { body })),
  reorder: (ids: string[]) => call(c().PUT("/api/admin/testimonials/order", { body: { ids } })),
  get: (itemId: string) => call(c().GET("/api/admin/testimonials/{id}", id(itemId))),
  update: (itemId: string, body: TestimonialInput) =>
    call(c().PUT("/api/admin/testimonials/{id}", { ...id(itemId), body })),
  remove: (itemId: string) => call(c().DELETE("/api/admin/testimonials/{id}", id(itemId))),
};

export const valueApi = {
  list: () => call(c().GET("/api/admin/values")),
  create: (body: CoreValueInput) => call(c().POST("/api/admin/values", { body })),
  reorder: (ids: string[]) => call(c().PUT("/api/admin/values/order", { body: { ids } })),
  get: (itemId: string) => call(c().GET("/api/admin/values/{id}", id(itemId))),
  update: (itemId: string, body: CoreValueInput) => call(c().PUT("/api/admin/values/{id}", { ...id(itemId), body })),
  remove: (itemId: string) => call(c().DELETE("/api/admin/values/{id}", id(itemId))),
};

export const processStepApi = {
  list: () => call(c().GET("/api/admin/process-steps")),
  create: (body: ProcessStepInput) => call(c().POST("/api/admin/process-steps", { body })),
  reorder: (ids: string[]) => call(c().PUT("/api/admin/process-steps/order", { body: { ids } })),
  get: (itemId: string) => call(c().GET("/api/admin/process-steps/{id}", id(itemId))),
  update: (itemId: string, body: ProcessStepInput) =>
    call(c().PUT("/api/admin/process-steps/{id}", { ...id(itemId), body })),
  remove: (itemId: string) => call(c().DELETE("/api/admin/process-steps/{id}", id(itemId))),
};

/* ---------------------------------------------------------------- FAQs */
export const faqApi = {
  listCategories: () => call(c().GET("/api/admin/faq-categories")),
  createCategory: (body: FaqCategoryInput) => call(c().POST("/api/admin/faq-categories", { body })),
  reorderCategories: (ids: string[]) => call(c().PUT("/api/admin/faq-categories/order", { body: { ids } })),
  getCategory: (itemId: string) => call(c().GET("/api/admin/faq-categories/{id}", id(itemId))),
  updateCategory: (itemId: string, body: FaqCategoryInput) =>
    call(c().PUT("/api/admin/faq-categories/{id}", { ...id(itemId), body })),
  removeCategory: (itemId: string) => call(c().DELETE("/api/admin/faq-categories/{id}", id(itemId))),
  listFaqs: (categoryId?: string) =>
    call(c().GET("/api/admin/faqs", { params: { query: categoryId ? { category_id: categoryId } : {} } })),
  createFaq: (body: FaqInput) => call(c().POST("/api/admin/faqs", { body })),
  reorderFaqs: (categoryId: string, ids: string[]) =>
    call(c().PUT("/api/admin/faqs/order", { body: { category_id: categoryId, ids } })),
  getFaq: (itemId: string) => call(c().GET("/api/admin/faqs/{id}", id(itemId))),
  updateFaq: (itemId: string, body: FaqInput) => call(c().PUT("/api/admin/faqs/{id}", { ...id(itemId), body })),
  removeFaq: (itemId: string) => call(c().DELETE("/api/admin/faqs/{id}", id(itemId))),
};

/* ---------------------------------------------------------------- media + markdown */
export const MEDIA_PAGE_SIZE = 24;

export const mediaApi = {
  listAdminMedia: (page: number, pageSize = MEDIA_PAGE_SIZE) =>
    call(c().GET("/api/admin/media", { params: { query: { page, page_size: pageSize } } })),
  uploadAdminMedia: (file: File, alt?: string) =>
    call(
      c().POST("/api/admin/media", {
        // The contract types the binary part as a string; the serializer sends the File as multipart.
        body: { file: file as unknown as string, alt: alt ?? null },
        bodySerializer: () => {
          const form = new FormData();
          form.append("file", file);
          if (alt) form.append("alt", alt);
          return form;
        },
      }),
    ),
  deleteAdminMedia: (mediaId: string) => call(c().DELETE("/api/admin/media/{id}", id(mediaId))),
};

export const markdownApi = {
  previewAdminMarkdown: (markdown: string) => call(c().POST("/api/admin/markdown/preview", { body: { markdown } })),
};

/* ---------------------------------------------------------------- profile + settings */
export const siteApi = {
  getAdminProfile: () => call(c().GET("/api/admin/profile")),
  updateAdminProfile: (body: ProfileInput) => call(c().PUT("/api/admin/profile", { body })),
  getAdminSettings: () => call(c().GET("/api/admin/settings")),
  updateAdminSettings: (body: SettingsInput) => call(c().PUT("/api/admin/settings", { body })),
};

/* ---------------------------------------------------------------- enquiries */
export const ENQUIRY_PAGE_SIZE = 20;

export const enquiryApi = {
  listAdminEnquiries: (status: EnquiryStatus | null, page: number) =>
    call(
      c().GET("/api/admin/enquiries", {
        params: { query: { ...(status ? { status } : {}), page, page_size: ENQUIRY_PAGE_SIZE } },
      }),
    ),
  getAdminEnquiry: (enquiryId: string) => call(c().GET("/api/admin/enquiries/{id}", id(enquiryId))),
  updateAdminEnquiryStatus: (enquiryId: string, status: EnquiryStatus) =>
    call(c().PATCH("/api/admin/enquiries/{id}", { ...id(enquiryId), body: { status } })),
  deleteAdminEnquiry: (enquiryId: string) => call(c().DELETE("/api/admin/enquiries/{id}", id(enquiryId))),
};
