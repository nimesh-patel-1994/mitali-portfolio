/** MSW handlers for the public API, typed from the generated contract types. */
import { http, HttpResponse } from "msw";
import type {
  ApiError,
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
import * as fx from "./fixtures";

export const API_BASE = "http://api.test";

const NOT_FOUND: ApiError = { error: { code: "not_found", message: "Not found" } };

export function publicApiHandlers(base = API_BASE) {
  return [
    http.get(`${base}/api/public/site`, () => HttpResponse.json<SiteBundle>(fx.site)),
    http.get(`${base}/api/public/case-studies`, ({ request }) => {
      const featured = new URL(request.url).searchParams.get("featured") === "true";
      return HttpResponse.json<CaseStudySummary[]>(
        featured ? fx.caseStudies.filter((cs) => cs.is_featured) : fx.caseStudies,
      );
    }),
    http.get<{ slug: string }, never, CaseStudyDetailRaw | ApiError>(`${base}/api/public/case-studies/:slug`, ({ params }) => {
      const detail = fx.caseStudyDetail(params.slug);
      return HttpResponse.json<CaseStudyDetailRaw | ApiError>(detail ?? NOT_FOUND, { status: detail ? 200 : 404 });
    }),
    http.get(`${base}/api/public/writing-samples`, () => HttpResponse.json<WritingSampleSummary[]>(fx.writingSamples)),
    http.get<{ slug: string }, never, WritingSampleDetailRaw | ApiError>(
      `${base}/api/public/writing-samples/:slug`,
      ({ params }) => {
        const detail = fx.writingSampleDetail(params.slug);
        return HttpResponse.json<WritingSampleDetailRaw | ApiError>(detail ?? NOT_FOUND, { status: detail ? 200 : 404 });
      },
    ),
    http.get(`${base}/api/public/services`, () => HttpResponse.json<Service[]>(fx.services)),
    http.get(`${base}/api/public/engagement-models`, () => HttpResponse.json<EngagementModel[]>(fx.engagementModels)),
    http.get(`${base}/api/public/testimonials`, () => HttpResponse.json<Testimonial[]>(fx.testimonials)),
    http.get(`${base}/api/public/faqs`, () => HttpResponse.json<FaqGroup[]>(fx.faqGroups)),
    http.get(`${base}/api/public/faqs/preview`, () => HttpResponse.json<Faq[]>(fx.faqPreview)),
    http.get(`${base}/api/public/values`, () => HttpResponse.json<CoreValue[]>(fx.values)),
    http.get(`${base}/api/public/process-steps`, () => HttpResponse.json<ProcessStep[]>(fx.processSteps)),
  ];
}
