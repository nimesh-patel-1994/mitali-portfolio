/**
 * Content source (TS-005 step 3, UI-002). Route loaders never call `fetch` or the API client directly; they call
 * `source.get(key)`. Implementations: *api* (build time and `npm run dev`, `content-source.api.ts`) and *static*
 * (browser production build, `content-source.static.ts`, reads `/data/<key>.json`).
 * Not found → a `Response` with status 404 is thrown (rendered by the route error element as the 404 page).
 */
import type { ContentData, ContentKey } from "./content-types";

export interface ContentSource {
  get<K extends ContentKey>(key: K): Promise<ContentData<K>>;
}

/** Slug pattern from the contract (`components.schemas.Slug`). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 80;

export function isValidSlug(value: string | undefined): value is string {
  return value !== undefined && value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);
}

/** Throws the 404 Response that loaders use for unknown or unpublished content. */
export function throwNotFound(): never {
  throw new Response(null, { status: 404, statusText: "Not Found" });
}

export function isNotFoundResponse(value: unknown): value is Response {
  return value instanceof Response && value.status === 404;
}

export class ContentSourceError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ContentSourceError";
    this.status = status;
  }
}

/** Splits a detail key into its collection and slug; returns null for the fixed keys. */
export function parseDetailKey(key: ContentKey): { collection: "work" | "writing"; slug: string } | null {
  const slash = key.indexOf("/");
  if (slash === -1) return null;
  const collection = key.slice(0, slash);
  const slug = key.slice(slash + 1);
  if (collection !== "work" && collection !== "writing") throwNotFound();
  if (!isValidSlug(slug)) throwNotFound();
  return { collection, slug };
}

export interface RecordingContentSource extends ContentSource {
  /** Every key successfully read so far with its data, in first-read order. */
  entries(): Array<[ContentKey, unknown]>;
}

/**
 * Wraps a source so each key is fetched once and remembered; the pre-renderer writes the remembered
 * values to `dist/data/<key>.json`, so the browser receives exactly the loader data used for the HTML.
 */
export function createRecordingSource(inner: ContentSource): RecordingContentSource {
  const cache = new Map<ContentKey, Promise<unknown>>();
  const settled = new Map<ContentKey, unknown>();
  return {
    get<K extends ContentKey>(key: K): Promise<ContentData<K>> {
      let pending = cache.get(key);
      if (!pending) {
        pending = inner.get(key).then((data) => {
          settled.set(key, data);
          return data;
        });
        pending.catch(() => cache.delete(key));
        cache.set(key, pending);
      }
      return pending as Promise<ContentData<K>>;
    },
    entries() {
      return [...settled.entries()];
    },
  };
}
