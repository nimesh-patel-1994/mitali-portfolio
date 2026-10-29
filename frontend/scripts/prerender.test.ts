// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as entry from "../src/entry-server";
import { API_BASE, publicApiHandlers } from "../src/test/handlers";
import * as fx from "../src/test/fixtures";
import { fillTemplate, runPrerender, type PrerenderOptions } from "./prerender";

const SITE_URL = "https://mitali.example.com";
const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <!--app-head-->
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"><!--app-html--></div>
    <!--app-data-->
  </body>
</html>
`;

const server = setupServer(...publicApiHandlers());
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let distDir: string;
beforeEach(async () => {
  distDir = await mkdtemp(join(tmpdir(), "mitali-prerender-"));
  await writeFile(join(distDir, "index.html"), TEMPLATE, "utf8");
});
afterEach(async () => {
  await rm(distDir, { recursive: true, force: true });
});

function options(extra: Partial<PrerenderOptions> = {}): PrerenderOptions {
  return {
    distDir,
    apiBaseUrl: API_BASE,
    siteUrl: SITE_URL,
    entry,
    appVersion: "0.1.0",
    now: () => new Date("2026-10-29T12:00:00.000Z"),
    log: () => {},
    ...extra,
  };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join("/"))
    .sort();
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

describe("UI-T-008 prerender writes the site", () => {
  it("routes, data, 404, admin shell, sitemap, robots and build-info", async () => {
    const files: string[] = [];
    const summary = await runPrerender(
      options({
        log: (m) => files.push(m),
      }),
    );
    expect(summary.pages).toBe(6 + 6 + 12);

    const written = await listFiles(distDir);
    for (const route of ["index.html", "work/index.html", "writing/index.html", "about/index.html", "contact/index.html", "faqs/index.html"]) {
      expect(written).toContain(route);
    }
    for (const cs of fx.caseStudies) expect(written).toContain(`work/${cs.slug}/index.html`);
    for (const s of fx.writingSamples) expect(written).toContain(`writing/${s.slug}/index.html`);
    expect(written).not.toContain(`work/${fx.unpublishedCaseStudySlug}/index.html`);
    for (const key of ["site", "home", "work", "writing", "about", "contact", "faqs"]) {
      expect(written).toContain(`data/${key}.json`);
    }
    expect(written).toContain("data/work/case-study-1.json");
    expect(written).toContain("data/writing/writing-sample-12.json");

    // Data files hold exactly the loader data.
    expect(JSON.parse(await readFile(join(distDir, "data", "site.json"), "utf8"))).toEqual(fx.site);

    // Route HTML: head, body and escaped hydration data.
    const home = await readFile(join(distDir, "index.html"), "utf8");
    expect(home).toContain("<html lang=\"en\">");
    expect(home).toContain("<title>Mitali — Content Writer &amp; Marketing Strategist</title>");
    expect(home).toContain(`<link rel="canonical" href="${SITE_URL}/">`);
    expect(home).toContain('<script type="application/json" id="__ROUTER_DATA__">');
    expect(home).not.toContain("<!--app-");
    const caseStudy = await readFile(join(distDir, "work", "case-study-1", "index.html"), "utf8");
    expect(caseStudy).toContain('<meta property="og:type" content="article">');
    expect(caseStudy).toContain(`<meta property="og:image" content="${SITE_URL}/media/seed/cover-1-1600.webp">`);

    const notFound = await readFile(join(distDir, "404.html"), "utf8");
    expect(notFound).toContain('<meta name="robots" content="noindex">');
    expect(notFound).toContain("This page took a day off");

    const admin = await readFile(join(distDir, "admin", "index.html"), "utf8");
    expect(admin).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(admin).toContain('<div id="root"></div>');
    expect(admin).not.toContain("__ROUTER_DATA__");

    const sitemap = await readFile(join(distDir, "sitemap.xml"), "utf8");
    expect(sitemap.match(/<url>/g)).toHaveLength(6 + 18);
    expect(sitemap).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(sitemap).toContain(`<loc>${SITE_URL}/work/case-study-6</loc>`);
    expect(sitemap).toContain(`<lastmod>${fx.caseStudies[5]!.updated_at}</lastmod>`);
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain(fx.unpublishedCaseStudySlug);

    const robots = await readFile(join(distDir, "robots.txt"), "utf8");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);

    const buildInfo = JSON.parse(await readFile(join(distDir, "build-info.json"), "utf8"));
    expect(buildInfo).toEqual({
      built_at: "2026-10-29T12:00:00.000Z",
      content_snapshot_at: fx.GENERATED_AT,
      pages: 24,
      app_version: "0.1.0",
    });
  });

  it("build-info.json is written last", async () => {
    const order: string[] = [];
    const spyEntry = {
      ...entry,
      buildRobots: (siteUrl: string) => {
        order.push("robots");
        return entry.buildRobots(siteUrl);
      },
    };
    await runPrerender(options({ entry: spyEntry, log: (m) => order.push(m.startsWith("prerender:") ? "done" : "route") }));
    expect(order.at(-1)).toBe("done");
    expect(order.indexOf("robots")).toBeGreaterThan(order.lastIndexOf("route"));
    expect(await exists(join(distDir, "build-info.json"))).toBe(true);
  });

  it("SEC-UI-002/003 dist scan: no executable inline scripts, style or on* attributes", async () => {
    await runPrerender(options());
    for (const file of (await listFiles(distDir)).filter((f) => f.endsWith(".html"))) {
      const html = await readFile(join(distDir, file), "utf8");
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      for (const tag of scripts) expect(tag, file).toMatch(/\bsrc="|type="application\/json"/);
      expect(html, file).not.toContain("__staticRouterHydrationData");
      expect(html, file).not.toMatch(/\sstyle="/);
      expect(html, file).not.toMatch(/\son[a-z]+="/);
      expect(html, file).not.toContain("javascript:");
      expect(html, file).not.toMatch(/<base\b/);
    }
  });
});

describe("UI-T-009 prerender failure", () => {
  it("API unreachable → rejects naming the step, no build-info.json", async () => {
    server.use(http.get(`${API_BASE}/api/public/site`, () => HttpResponse.error()));
    await writeFile(join(distDir, "build-info.json"), "{}", "utf8");
    await expect(runPrerender(options())).rejects.toThrow(/GET \/api\/public\/site/);
    expect(await exists(join(distDir, "build-info.json"))).toBe(false);
  });

  it("one route throws → rejects naming the route, no build-info.json", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(`${API_BASE}/api/public/case-studies/case-study-3`, () => HttpResponse.json({}, { status: 500 })));
    await expect(runPrerender(options())).rejects.toThrow(/render \/work\/case-study-3: status 500/);
    expect(await exists(join(distDir, "build-info.json"))).toBe(false);
  });

  it("a listed slug that 404s on detail fails the build (no silent 404 page)", async () => {
    server.use(http.get(`${API_BASE}/api/public/writing-samples/writing-sample-4`, () => new HttpResponse(null, { status: 404 })));
    await expect(runPrerender(options())).rejects.toThrow(/render \/writing\/writing-sample-4: status 404/);
    expect(await exists(join(distDir, "build-info.json"))).toBe(false);
  });

  it("template without placeholders fails", async () => {
    await writeFile(join(distDir, "index.html"), "<html></html>", "utf8");
    await expect(runPrerender(options())).rejects.toThrow(/placeholder/);
  });

  it("fillTemplate does not interpret $ patterns in content", () => {
    const out = fillTemplate("<!--app-head--><!--app-html--><!--app-data-->", { head: "$&", html: "$'", data: "$1" });
    expect(out).toBe("$&$'$1");
  });
});
