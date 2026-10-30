/**
 * Build-time pre-render (UI-004, TS-005, SD-003). Run after `vite build` and `vite build --ssr`:
 *   tsx scripts/prerender.ts
 * Env: API_BASE_URL (default http://127.0.0.1:8000), VITE_SITE_URL (from the environment or frontend/.env).
 *
 * Steps: read the client template → getPublicSite first (generated_at = content snapshot) → list published
 * case-study and writing-sample slugs → render every public route to dist/<route>/index.html with head tags and
 * escaped hydration data → dist/data/<key>.json for every key read → 404.html → admin/index.html (noindex shell)
 * → sitemap.xml → robots.txt → precompressed .gz/.br variants → build-info.json LAST (only when everything
 * succeeded). Pages whose route is lazy (LAZY_ROUTE_MODULES) get `<link rel="stylesheet">` and
 * `<link rel="modulepreload">` tags for the route chunk from the Vite manifest, so the page is styled at first paint
 * and its chunk downloads in parallel with the entry.
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
import { compressDir } from "./compress";

/** The subset of the SSR entry the script uses (injectable for tests). */
export interface PrerenderEntry {
  render(url: string, options: RenderOptions): Promise<RenderResult>;
  createApiContentSource(options?: ApiClientOptions): ContentSource;
  createRecordingSource(inner: ContentSource): RecordingContentSource;
  buildSitemap(entries: SitemapEntry[], siteUrl: string): string;
  buildRobots(siteUrl: string): string;
  buildAdminHead(): string;
  /** Lazy route id → source module as keyed in the Vite manifest. */
  LAZY_ROUTE_MODULES?: Readonly<Record<string, string>>;
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
  /** Write precompressed .gz/.br variants of the text assets (the CLI run does; tests opt in). */
  compress?: boolean;
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

export const MISSING_PLACEHOLDER_HINT =
  "dist/index.html is not a fresh client build (it may already be pre-rendered). Run `npm run build:site` to rebuild and pre-render the site.";

/** Throws when the template lacks a placeholder (e.g. `npm run prerender` run twice on the same dist). */
export function assertTemplate(template: string): void {
  for (const marker of Object.values(PLACEHOLDERS)) {
    if (!template.includes(marker)) throw new Error(`template is missing the ${marker} placeholder. ${MISSING_PLACEHOLDER_HINT}`);
  }
}

export function fillTemplate(template: string, parts: { head: string; html: string; data: string }): string {
  assertTemplate(template);
  // Function replacers: no `$&`-style substitution from content.
  return template
    .replace(PLACEHOLDERS.head, () => parts.head)
    .replace(PLACEHOLDERS.html, () => parts.html)
    .replace(PLACEHOLDERS.data, () => parts.data);
}

/** Subset of a Vite manifest chunk entry (`build.manifest`). */
export interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  css?: string[];
}
export type ViteManifest = Record<string, ManifestChunk>;

const ASSET_PATH = /^assets\/[A-Za-z0-9._-]+\.(?:js|css)$/;

function staticClosure(manifest: ViteManifest, keys: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...keys];
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (seen.has(key)) continue;
    const chunk = manifest[key];
    if (!chunk) throw new Error(`manifest has no entry "${key}"`);
    seen.add(key);
    stack.push(...(chunk.imports ?? []));
  }
  return seen;
}

/**
 * Link tags for the lazy route modules of one page: stylesheets first (cascade order after the entry CSS), then
 * modulepreloads. Chunks and CSS already loaded by the entry are skipped. Paths are validated asset names.
 */
export function routeAssetTags(manifest: ViteManifest, moduleKeys: string[]): string {
  if (moduleKeys.length === 0) return "";
  const entryKeys = Object.keys(manifest).filter((k) => manifest[k]!.isEntry);
  const loaded = staticClosure(manifest, entryKeys);
  const loadedCss = new Set([...loaded].flatMap((k) => manifest[k]!.css ?? []));
  const chunks = [...staticClosure(manifest, moduleKeys)].filter((k) => !loaded.has(k));
  // Route module first, then its shared chunks, in a stable order.
  chunks.sort((a, b) => Number(moduleKeys.includes(b)) - Number(moduleKeys.includes(a)) || a.localeCompare(b));
  const css = [...new Set(chunks.flatMap((k) => manifest[k]!.css ?? []))].filter((f) => !loadedCss.has(f));
  const js = chunks.map((k) => manifest[k]!.file);
  for (const file of [...css, ...js]) {
    if (!ASSET_PATH.test(file)) throw new Error(`unexpected asset path "${file}" in manifest`);
  }
  return [
    ...css.map((f) => `<link rel="stylesheet" crossorigin href="/${f}">`),
    ...js.map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`),
  ].join("\n    ");
}

/** Adds tags at the end of `<head>`, after the entry's own stylesheet (cascade order). */
export function injectBeforeHeadEnd(html: string, tags: string): string {
  if (tags === "") return html;
  const at = html.indexOf("</head>");
  if (at < 0) throw new Error("template has no </head>");
  return `${html.slice(0, at)}  ${tags}\n  ${html.slice(at)}`;
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

  const template = await step("read dist/index.html template", async () => {
    const text = await readFile(join(distDir, "index.html"), "utf8");
    assertTemplate(text);
    return text;
  });
  const lazyModules = entry.LAZY_ROUTE_MODULES ?? {};
  let manifest: ViteManifest | null = null;
  const lazyTags = async (routeIds: string[]): Promise<string> => {
    const keys = routeIds.flatMap((id) => (lazyModules[id] ? [lazyModules[id]] : []));
    if (keys.length === 0) return "";
    manifest ??= await step("read dist/.vite/manifest.json", async () =>
      JSON.parse(await readFile(join(distDir, ".vite", "manifest.json"), "utf8")) as ViteManifest,
    );
    return routeAssetTags(manifest, keys);
  };

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
      const page = fillTemplate(template, { head: result.head, html: result.html, data: result.hydrationScript });
      await writeOut(routeFile(distDir, route), injectBeforeHeadEnd(page, await lazyTags(result.routeIds ?? [])));
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
  if (options.compress) {
    const c = await step("write precompressed .gz/.br files", () => compressDir(distDir));
    log(`  compressed ${c.files} files: ${c.rawBytes} B raw, ${c.gzBytes} B gzip, ${c.brBytes} B brotli`);
  }

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
  await runPrerender({ distDir: join(frontendDir, "dist"), apiBaseUrl, siteUrl, entry, appVersion: pkg.version, compress: true });
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("prerender: FAILED, build-info.json not written");
    process.exit(1);
  });
}
