/**
 * API client (UI-REV-003): the only way to call the backend. Generated types come from
 * `schema.d.ts` (`npm run generate:api`, openapi-typescript from docs/api-contract.yaml; never hand-edited).
 */
import createClient from "openapi-fetch";
import type { paths } from "./schema";

export interface ApiClientOptions {
  /** Origin of the API. Empty string = same origin (browser). */
  baseUrl?: string;
  /** Custom fetch (tests). Defaults to the global fetch at call time. */
  fetch?: (input: Request) => Promise<Response>;
}

export function createApiClient(options: ApiClientOptions = {}) {
  // Resolve the global fetch per call so test interceptors (MSW) installed later are honoured.
  const fetchImpl = options.fetch ?? ((input: Request) => globalThis.fetch(input));
  return createClient<paths>({
    baseUrl: options.baseUrl ?? "",
    credentials: "same-origin",
    fetch: fetchImpl,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
