/**
 * *api* content source (TS-005 step 3): composes each data key from the public API through the generated
 * openapi-fetch client. Used by the pre-renderer at build time and by the browser during `npm run dev`.
 */
import { createApiClient, type ApiClient, type ApiClientOptions } from "@/api/client";
import { mapCaseStudyDetail, mapWritingSampleDetail } from "./content-mappers";
import {
  ContentSourceError,
  parseDetailKey,
  throwNotFound,
  type ContentSource,
} from "./content-source";
import { HOME_FEATURED_LIMIT, type ContentData, type ContentKey } from "./content-types";

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Unwraps an openapi-fetch result: 404 → 404 Response, any other failure → ContentSourceError. */
async function unwrap<T>(label: string, call: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ContentSourceError(`${label}: request failed (${reason})`);
  }
  const { data, response } = result;
  if (response.status === 404) throwNotFound();
  if (!response.ok || data === undefined) {
    throw new ContentSourceError(`${label}: unexpected status ${response.status}`, response.status);
  }
  return data;
}

export function createApiContentSource(options: ApiClientOptions = {}): ContentSource {
  const client: ApiClient = createApiClient(options);

  const faqPreview = () => unwrap("GET /api/public/faqs/preview", client.GET("/api/public/faqs/preview"));
  const caseStudies = (featured?: boolean) =>
    unwrap(
      "GET /api/public/case-studies",
      client.GET("/api/public/case-studies", featured ? { params: { query: { featured: true } } } : {}),
    );

  async function load(key: ContentKey): Promise<unknown> {
    const detail = parseDetailKey(key);
    if (detail?.collection === "work") {
      const raw = await unwrap(
        `GET /api/public/case-studies/${detail.slug}`,
        client.GET("/api/public/case-studies/{slug}", { params: { path: { slug: detail.slug } } }),
      );
      return mapCaseStudyDetail(raw);
    }
    if (detail?.collection === "writing") {
      const raw = await unwrap(
        `GET /api/public/writing-samples/${detail.slug}`,
        client.GET("/api/public/writing-samples/{slug}", { params: { path: { slug: detail.slug } } }),
      );
      return mapWritingSampleDetail(raw);
    }

    switch (key) {
      case "site":
        return unwrap("GET /api/public/site", client.GET("/api/public/site"));
      case "home": {
        const [featured, services, engagementModels, testimonials, faqs] = await Promise.all([
          caseStudies(true),
          unwrap("GET /api/public/services", client.GET("/api/public/services")),
          unwrap("GET /api/public/engagement-models", client.GET("/api/public/engagement-models")),
          unwrap("GET /api/public/testimonials", client.GET("/api/public/testimonials")),
          faqPreview(),
        ]);
        return {
          featured_case_studies: featured.slice(0, HOME_FEATURED_LIMIT),
          services,
          engagement_models: engagementModels,
          testimonials,
          faq_preview: faqs,
        } satisfies ContentData<"home">;
      }
      case "work": {
        const [list, faqs] = await Promise.all([caseStudies(), faqPreview()]);
        return { case_studies: list, faq_preview: faqs } satisfies ContentData<"work">;
      }
      case "writing": {
        const samples = await unwrap(
          "GET /api/public/writing-samples",
          client.GET("/api/public/writing-samples"),
        );
        return { samples } satisfies ContentData<"writing">;
      }
      case "about": {
        const [values, steps, faqs] = await Promise.all([
          unwrap("GET /api/public/values", client.GET("/api/public/values")),
          unwrap("GET /api/public/process-steps", client.GET("/api/public/process-steps")),
          faqPreview(),
        ]);
        return { values, process_steps: steps, faq_preview: faqs } satisfies ContentData<"about">;
      }
      case "contact":
        return { faq_preview: await faqPreview() } satisfies ContentData<"contact">;
      case "faqs": {
        const groups = await unwrap("GET /api/public/faqs", client.GET("/api/public/faqs"));
        return { groups } satisfies ContentData<"faqs">;
      }
      default:
        return throwNotFound();
    }
  }

  return {
    get<K extends ContentKey>(key: K): Promise<ContentData<K>> {
      return load(key) as Promise<ContentData<K>>;
    },
  };
}
