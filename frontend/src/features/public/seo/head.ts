/**
 * buildHead (UI-004, SEC-UI-002): renders the head tags for a pre-rendered page as an HTML string with every
 * value escaped. Canonical and og:url = site URL + validated route path (no trailing slash);
 * og:image = site URL + a root-relative `/media/...` path, else the default image.
 */
import { isSafeMediaUrl } from "@/shared/utils/url";
import { SITE_NAME } from "@/features/public/content/copy";
import type { PageMeta } from "./meta";

export const DEFAULT_OG_IMAGE_PATH = "/og-default.png";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for use in HTML element content and double- or single-quoted attributes. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/** Validates and normalises the site origin (`VITE_SITE_URL`): absolute http(s), no trailing slash. */
export function normaliseSiteUrl(siteUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    throw new Error(`VITE_SITE_URL is not a valid absolute URL: "${siteUrl}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`VITE_SITE_URL must use http or https: "${siteUrl}"`);
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function absoluteUrl(siteUrl: string, path: string): string {
  const base = normaliseSiteUrl(siteUrl);
  return path === "/" ? `${base}/` : `${base}${path}`;
}

export function ogImageUrl(meta: PageMeta, siteUrl: string): string {
  const url = meta.image?.url;
  return absoluteUrl(siteUrl, isSafeMediaUrl(url) ? url : DEFAULT_OG_IMAGE_PATH);
}

export function buildHead(meta: PageMeta, siteUrl: string): string {
  const tags: string[] = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
  ];
  if (meta.noindex) tags.push(`<meta name="robots" content="noindex">`);
  if (meta.path !== null) {
    tags.push(`<link rel="canonical" href="${escapeHtml(absoluteUrl(siteUrl, meta.path))}">`);
  }
  tags.push(
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:type" content="${meta.type === "article" ? "article" : "website"}">`,
    `<meta property="og:image" content="${escapeHtml(ogImageUrl(meta, siteUrl))}">`,
  );
  if (meta.image?.alt && isSafeMediaUrl(meta.image.url)) {
    tags.push(`<meta property="og:image:alt" content="${escapeHtml(meta.image.alt)}">`);
  }
  if (meta.path !== null) {
    tags.push(`<meta property="og:url" content="${escapeHtml(absoluteUrl(siteUrl, meta.path))}">`);
  }
  tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  return tags.join("\n    ");
}
