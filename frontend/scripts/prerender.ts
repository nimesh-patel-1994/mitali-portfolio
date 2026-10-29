/**
 * Build-time pre-render (UI-004, TS-005, SD-003). Run after `vite build` and `vite build --ssr`:
 *   tsx scripts/prerender.ts
 * Env: API_BASE_URL (default http://127.0.0.1:8000), VITE_SITE_URL (from the environment or frontend/.env).
 *
 * Steps: read the client template → getPublicSite first (generated_at = content snapshot) → list published
 * case-study and writing-sample slugs → render every public route to dist/<route>/index.html with head tags and
 * escaped hydration data → dist/data/<key>.json for every key read → 404.html → admin/index.html (noindex shell)
 * → sitemap.xml → robots.txt → build-info.json LAST (only when everything succeeded).
 * Any failure: clear console message naming the step/route, exit code 1, no build-info.json.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ContentSource, RecordingContentSource } from "../src/app/content-source";
import type { ApiClientOptions } from "../src/api/client";
import type { RenderOptions, RenderResult } from "../src/entry-server";
import type { SitemapEntry } from "../src/features/public/seo/site-files";
import type { CaseStudySummary, SiteBundle, WritingSampleSummary } from "../src/api/types";

/** The subset of the SSR entry the script uses (injectable for tests). */
export interface PrerenderEntry {
  render(url: string, options: RenderOptions): Promise<RenderResult>;
  createApiContentSource(options?: ApiClientOptions): ContentSource;
  createRecordingSource(inner: ContentSource): RecordingContentSource;
  buildSitemap(entries: SitemapEntry[], siteUrl: string): string;
  buildRobots(siteUrl: string): string;
  buildAdminHead(): string;
}

export interface PrerenderOptions {
  distDir: string;
  apiBaseUrl: string;
  siteUrl: string;
  entry: PrerenderEntry;
  appVersion: string;
  fetch?: ApiClientOptions["fetch"];
  now?: () => Date;
  log?: (message: string) => void;
}

export interface PrerenderSummary {
  pages: number;
  routes: string[];
  dataKeys: string[];
}

export const PLACEHOLDERS = {
  head: "<!--app-head-->",
  html: "<!--app-html-->",
  data: "<!--app-data-->",
} as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATA_KEY = /^(?:site|home|work|writing|about|contact|faqs|(?:work|writing)\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const STATIC_ROUTES = ["/", "/work", "/writing", "/about", "/contact", "/faqs"];
/** Path rendered through the `*` route for 404.html (never linked, never written as its own page). */
const NOT_FOUND_PROBE = "/__not-found__";

export class PrerenderError extends Error {
  constructor(step: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`[prerender] ${step}: ${reason}`);
    this.name = "PrerenderError";
  }
}

export function fillTemplate(template: string, parts: { head: string; html: string; data: string }): string {
  for (const marker of Object.values(PLACEHOLDERS)) {
    if (!template.includes(marker)) throw new Error(`template is missing the ${marker} placeholder`);
  }
  // Function replacers: no `$&`-style substitution from content.
  return template
    .replace(PLACEHOLDERS.head, () => parts.head)
    .replace(PLACEHOLDERS.html, () => parts.html)
    .replace(PLACEHOLDERS.data, () => parts.data);
}

export function routeFile(distDir: string, route: string): string {
  return route === "/" ? join(distDir, "index.html") : join(distDir, ...route.slice(1).split("/"), "index.html");
}

async function writeOut(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof PrerenderError) throw cause;
    if (cause instanceof Response) throw new PrerenderError(name, `HTTP ${cause.status}`);
    throw new PrerenderError(name, cause);
  }
}

export async function runPrerender(options: PrerenderOptions): Promise<PrerenderSummary> {
  const { distDir, siteUrl, entry } = options;
  const log = options.log ?? ((m: string) => console.log(m));
  const now = options.now ?? (() => new Date());
  const buildInfoFile = join(distDir, "build-info.json");

  // A stale build-info.json must never survive a failed run.
  await rm(buildInfoFile, { force: true });

  const template = await step("read dist/index.html template", () => readFile(join(distDir, "index.html"), "utf8"));
  const source = entry.createRecordingSource(
    entry.createApiContentSource({ baseUrl: options.apiBaseUrl, ...(options.fetch ? { fetch: options.fetch } : {}) }),
  );

  const site: SiteBundle = await step("GET /api/public/site", () => source.get("site"));
  const snapshotAt = site.generated_at;

  const caseStudies: CaseStudySummary[] = (await step("list case studies", () => source.get("work"))).case_studies;
  const samples: WritingSampleSummary[] = (await step("list writing samples", () => source.get("writing"))).samples;

  for (const item of [...caseStudies, ...samples]) {
    if (!SLUG.test(item.slug)) throw new PrerenderError("validate slugs", `invalid slug "${item.slug}"`);
  }

  const sitemap: SitemapEntry[] = [
    ...STATIC_ROUTES.map((path) => ({ path, lastmod: snapshotAt })),
    ...caseStudies.map((cs) => ({ path: `/work/${cs.slug}`, lastmod: cs.updated_at })),
    ...samples.map((s) => ({ path: `/writing/${s.slug}`, lastmod: s.updated_at })),
  ];
  const routes = sitemap.map((e) => e.path);

  for (const route of routes) {
    await step(`render ${route}`, async () => {
      const result = await entry.render(route, { source, siteUrl });
      if (result.status !== 200) throw new Error(`status ${result.status}`);
      await writeOut(
        routeFile(distDir, route),
        fillTemplate(template, { head: result.head, html: result.html, data: result.hydrationScript }),
      );
    });
    log(`  rendered ${route}`);
  }

  await step("render 404.html", async () => {
    const result = await entry.render(NOT_FOUND_PROBE, { source, siteUrl, notFoundDocument: true });
    await writeOut(
      join(distDir, "404.html"),
      fillTemplate(template, { head: result.head, html: result.html, data: result.hydrationScript }),
    );
  });

  const dataKeys: string[] = [];
  await step("write data/*.json", async () => {
    for (const [key, data] of source.entries()) {
      if (!DATA_KEY.test(key)) throw new Error(`unexpected data key "${key}"`);
      await writeOut(join(distDir, "data", `${key}.json`), JSON.stringify(data));
      dataKeys.push(key);
    }
  });

  await step("write admin/index.html", () =>
    writeOut(join(distDir, "admin", "index.html"), fillTemplate(template, { head: entry.buildAdminHead(), html: "", data: "" })),
  );
  await step("write sitemap.xml", () => writeOut(join(distDir, "sitemap.xml"), entry.buildSitemap(sitemap, siteUrl)));
  await step("write robots.txt", () => writeOut(join(distDir, "robots.txt"), entry.buildRobots(siteUrl)));

  // Last step: only reached when every route succeeded (TS-005 step 9).
  const buildInfo = {
    built_at: now().toISOString(),
    content_snapshot_at: snapshotAt,
    pages: routes.length,
    app_version: options.appVersion,
  };
  await step("write build-info.json", () => writeOut(buildInfoFile, `${JSON.stringify(buildInfo, null, 2)}\n`));
  log(`prerender: ${routes.length} pages, ${dataKeys.length} data files, snapshot ${snapshotAt}`);
  return { pages: routes.length, routes, dataKeys };
}

async function main(): Promise<void> {
  const frontendDir = fileURLToPath(new URL("..", import.meta.url));
  const { loadEnv } = await import("vite");
  const env = { ...loadEnv("production", frontendDir, ""), ...process.env };
  const siteUrl = env.VITE_SITE_URL ?? "http://localhost:8000";
  const apiBaseUrl = env.API_BASE_URL ?? "http://127.0.0.1:8000";
  const pkg = JSON.parse(await readFile(join(frontendDir, "package.json"), "utf8")) as { version: string };
  const entryPath = join(frontendDir, "dist-ssr", "entry-server.js");
  const entry = (await import(pathToFileURL(entryPath).href)) as PrerenderEntry;
  console.log(`prerender: API ${apiBaseUrl}, site ${siteUrl}`);
  await runPrerender({ distDir: join(frontendDir, "dist"), apiBaseUrl, siteUrl, entry, appVersion: pkg.version });
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("prerender: FAILED, build-info.json not written");
    process.exit(1);
  });
}
