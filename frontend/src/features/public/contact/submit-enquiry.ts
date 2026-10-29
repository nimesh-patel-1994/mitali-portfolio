/**
 * `createEnquiry` (POST /api/public/enquiries) through the generated client (UI-REV-003): the only runtime API call
 * of the public site. Responses are reduced to the outcomes the form shows (UI-033 states). Nothing about the
 * enquiry is logged or put in a URL (SEC-UI-007, UI-REV-019).
 */
import { createApiClient, type ApiClient } from "@/api/client";
import type { EnquiryCreate } from "@/api/types";

export type SubmitOutcome =
  | { kind: "success" }
  | { kind: "validation"; fields: Record<string, string> }
  | { kind: "rate_limited" }
  | { kind: "error" };

/** Browser client on the page's own origin (relative URLs are resolved against it). */
function browserClient(): ApiClient {
  return createApiClient({ baseUrl: window.location.origin });
}

export async function submitEnquiry(body: EnquiryCreate, client: ApiClient = browserClient()): Promise<SubmitOutcome> {
  try {
    const { response, error } = await client.POST("/api/public/enquiries", { body });
    if (response.status === 201) return { kind: "success" };
    if (response.status === 429) return { kind: "rate_limited" };
    if (response.status === 422) {
      const fields = error && "error" in error ? (error.error.fields ?? {}) : {};
      return { kind: "validation", fields };
    }
    return { kind: "error" };
  } catch {
    // Network failure or an unreadable response: keep the input, offer a retry.
    return { kind: "error" };
  }
}
