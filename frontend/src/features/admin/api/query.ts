/**
 * TanStack Query setup for the admin (UI-035, ui-scope section 4): keys `["admin", <type>, …]`, `staleTime` 30 s,
 * retries only on network/5xx errors (max 2), never on 4xx.
 */
import { QueryClient } from "@tanstack/react-query";
import { isRetryable } from "./errors";

export const STALE_TIME_MS = 30_000;

export interface AdminQueryClientOptions {
  /** Delay between query retries; tests pass `0` so retried network/5xx failures settle at once. */
  retryDelay?: number;
}

export function createAdminQueryClient(options: AdminQueryClientOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
        ...(options.retryDelay !== undefined ? { retryDelay: options.retryDelay } : {}),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export const adminKeys = {
  all: ["admin"] as const,
  me: ["admin", "me"] as const,
  dashboard: ["admin", "dashboard"] as const,
  caseStudies: ["admin", "case-studies"] as const,
  caseStudy: (id: string) => ["admin", "case-studies", id] as const,
  writingSamples: ["admin", "writing-samples"] as const,
  writingSample: (id: string) => ["admin", "writing-samples", id] as const,
  services: ["admin", "services"] as const,
  engagementModels: ["admin", "engagement-models"] as const,
  testimonials: ["admin", "testimonials"] as const,
  values: ["admin", "values"] as const,
  processSteps: ["admin", "process-steps"] as const,
  faqCategories: ["admin", "faq-categories"] as const,
  faqs: ["admin", "faqs"] as const,
  media: ["admin", "media"] as const,
  /** Stable editor id + revision counter; the Markdown text itself is never part of a key. */
  markdownPreview: (editorId: string, revision: number) => ["admin", "markdown-preview", editorId, revision] as const,
  profile: ["admin", "profile"] as const,
  settings: ["admin", "settings"] as const,
  enquiries: ["admin", "enquiries"] as const,
  enquiryList: (status: string | null, page: number) => ["admin", "enquiries", "list", status ?? "all", page] as const,
  enquiry: (id: string) => ["admin", "enquiries", "detail", id] as const,
};
