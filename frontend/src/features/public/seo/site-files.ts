/**
 * Site-level files written by the pre-renderer (UI-004, TS-005 steps 7-8, REQ-051, SEC-UI-002, SEC-UI-011):
 * sitemap.xml (XML-escaped absolute URLs; nothing under /admin), robots.txt and the admin shell head.
 */
import { absoluteUrl, escapeHtml } from "./head";
import { pageTitle } from "@/features/public/content/copy";

export interface SitemapEntry {
  /** Route path (`/`, `/work`, `/work/<slug>` …). */
  path: string;
  /** ISO 8601 timestamp. */
  lastmod: string;
}

export const STATIC_PUBLIC_PATHS = ["/", "/work", "/writing", "/about", "/contact", "/faqs"] as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemap(entries: SitemapEntry[], siteUrl: string): string {
  const urls = entries
    .filter((entry) => entry.path !== "/admin" && !entry.path.startsWith("/admin/"))
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(absoluteUrl(siteUrl, entry.path))}</loc>\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n  </url>`,
    );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function buildRobots(siteUrl: string): string {
  return `User-agent: *\nDisallow: /admin\n\nSitemap: ${absoluteUrl(siteUrl, "/sitemap.xml")}\n`;
}

/** Head of `dist/admin/index.html`: client-only shell, never indexed. */
export function buildAdminHead(): string {
  return [
    `<title>${escapeHtml(pageTitle("Admin"))}</title>`,
    `<meta name="robots" content="noindex, nofollow">`,
  ].join("\n    ");
}
