/**
 * Typed response mapper for `previewAdminMarkdown` (UI-041, TS-012, SEC-UI-001): the backend renders Markdown with
 * raw HTML disabled and sanitizes it with the nh3 allow-list, so `html` may be branded for `SanitizedHtml`.
 * This file is one of the two places ESLint allows to create `SanitizedHtmlString`.
 */
import { trustApiSanitizedHtml, type SanitizedHtmlString } from "@/api/sanitized";
import type { MarkdownPreview } from "../api/types";

export interface MappedPreview {
  html: SanitizedHtmlString;
  wordCount: number;
  readingTimeMin: number;
}

export function mapMarkdownPreview(preview: MarkdownPreview): MappedPreview {
  return {
    html: trustApiSanitizedHtml(preview.html),
    wordCount: preview.word_count,
    readingTimeMin: preview.reading_time_min,
  };
}
