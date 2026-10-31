/**
 * *static* content source (TS-005 step 3): the browser in the production build reads the JSON files the
 * pre-renderer wrote to `dist/data/<key>.json`. This is the only network code outside the generated API client
 * (ui-scope section 4). 404 → 404 Response; other HTTP failures → ContentSourceError; network errors propagate.
 */
import { ContentSourceError, parseDetailKey, throwNotFound, type ContentSource } from "./content-source";
import type { ContentData, ContentKey } from "./content-types";

const FIXED_KEYS = new Set<string>(["site", "home", "work", "writing", "about", "contact", "faqs"]);

export interface StaticContentSourceOptions {
  /** Path prefix of the data files (default `/data`). */
  basePath?: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

export function dataFilePath(key: ContentKey, basePath = "/data"): string {
  // Validates detail slugs (no path traversal) and rejects unknown keys.
  if (parseDetailKey(key) === null && !FIXED_KEYS.has(key)) throwNotFound();
  return `${basePath}/${key}.json`;
}

export function createStaticContentSource(options: StaticContentSourceOptions = {}): ContentSource {
  const basePath = options.basePath ?? "/data";
  const doFetch = options.fetch ?? ((input: string, init?: RequestInit) => globalThis.fetch(input, init));
  return {
    async get<K extends ContentKey>(key: K): Promise<ContentData<K>> {
      const url = dataFilePath(key, basePath);
      const response = await doFetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (response.status === 404) throwNotFound();
      if (!response.ok) throw new ContentSourceError(`GET ${url}: unexpected status ${response.status}`, response.status);
      return (await response.json()) as ContentData<K>;
    },
  };
}
