import { act } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readHydrationPayload, toHydrationState } from "@/app/hydration";
import { createRoutes } from "@/app/routes";
import { buildHead } from "@/features/public/seo/head";
import { resolveMeta } from "@/features/public/seo/meta";
import * as fx from "@/test/fixtures";
import { createFixtureSource } from "@/test/fixture-source";
import { render, type RenderOptions } from "./entry-server";

const SITE_URL = "https://mitali.example.com";
const options = (extra: Partial<RenderOptions> = {}): RenderOptions => ({
  source: createFixtureSource(),
  siteUrl: SITE_URL,
  ...extra,
});

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, "text/html");
}

function headDoc(head: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><head>${head}</head><body></body></html>`, "text/html");
}

const meta = (doc: Document, selector: string) => doc.querySelector(selector)?.getAttribute("content");

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("UI-T-004 render('/')", () => {
  it("status 200, one h1, head tags and hydration data", async () => {
    const result = await render("/", options());
    expect(result.status).toBe(200);
    const body = parse(result.html);
    expect(body.querySelectorAll("h1")).toHaveLength(1);
    expect(body.querySelector("main#main")).not.toBeNull();
    expect(body.querySelector("a[href='#main']")?.textContent).toBe("Skip to content");

    const head = headDoc(result.head);
    expect(head.title).toBe("Mitali — Content Writer & Marketing Strategist");
    expect(meta(head, "meta[name='description']")).toBeTruthy();
    expect(head.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe(`${SITE_URL}/`);
    expect(meta(head, "meta[property='og:title']")).toBe(head.title);
    expect(meta(head, "meta[property='og:type']")).toBe("website");
    expect(meta(head, "meta[property='og:url']")).toBe(`${SITE_URL}/`);
    expect(meta(head, "meta[property='og:image']")).toBe(`${SITE_URL}/og-default.png`);
    expect(meta(head, "meta[name='twitter:card']")).toBe("summary_large_image");
    expect(head.querySelector("meta[name='robots']")).toBeNull();

    expect(result.hydrationScript).toContain('id="__ROUTER_DATA__"');
    expect(result.hydration.loaderData.root).toEqual(fx.site);
    expect(result.hydration.loaderData.home).toBeDefined();
  });

  it("never emits React Router's inline executable hydration script (SEC-UI-002)", async () => {
    const result = await render("/", options());
    expect(result.html).not.toContain("__staticRouterHydrationData");
    expect(result.html).not.toMatch(/<script(?![^>]*type="application\/json")/);
    expect(result.html).not.toMatch(/\sstyle=/);
    expect(result.html).not.toMatch(/\son[a-z]+=/);
  });
});

describe("UI-T-005 render('/work/unknown')", () => {
  it("loader 404 → status 404, not-found content, noindex", async () => {
    const result = await render("/work/unknown", options());
    expect(result.status).toBe(404);
    const body = parse(result.html);
    expect(body.querySelector("h1")?.textContent).toBe("This page took a day off");
    expect(body.querySelector("header")).not.toBeNull();
    expect(body.querySelector("footer")).not.toBeNull();
    const head = headDoc(result.head);
    expect(meta(head, "meta[name='robots']")).toBe("noindex");
    expect(head.title).toBe("Page not found — Mitali");
    expect(head.querySelector("link[rel='canonical']")).toBeNull();
  });

  it("invalid slug shapes are 404 without calling the source", async () => {
    const source = createFixtureSource();
    const spy = vi.spyOn(source, "get");
    const result = await render("/work/Not_A_Slug", { source, siteUrl: SITE_URL });
    expect(result.status).toBe(404);
    expect(spy.mock.calls.map(([k]) => k)).toEqual(["site"]);
  });

  it("404 document render (404.html): status 404, noindex, notFound flag", async () => {
    const result = await render("/__not-found__", options({ notFoundDocument: true }));
    expect(result.status).toBe(404);
    expect(result.hydration.notFound).toBe(true);
    expect(meta(headDoc(result.head), "meta[name='robots']")).toBe("noindex");
  });
});

describe("UI-T-006 buildHead for a case study", () => {
  it("unique title, summary description, canonical without trailing slash, absolute og:image, og:type=article", async () => {
    const cs = fx.caseStudies[1]!;
    const result = await render(`/work/${cs.slug}/`, options());
    const head = headDoc(result.head);
    expect(head.title).toBe(`${cs.title} — Mitali`);
    expect(meta(head, "meta[name='description']")).toBe(cs.summary);
    expect(head.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe(`${SITE_URL}/work/${cs.slug}`);
    expect(meta(head, "meta[property='og:image']")).toBe(`${SITE_URL}${cs.cover!.url}`);
    expect(meta(head, "meta[property='og:type']")).toBe("article");
    expect(meta(head, "meta[property='og:url']")).toBe(`${SITE_URL}/work/${cs.slug}`);
  });

  it("writing sample without thumbnail falls back to the default og:image", async () => {
    const sample = fx.writingSamples.find((s) => s.thumbnail === null)!;
    const head = headDoc((await render(`/writing/${sample.slug}`, options())).head);
    expect(meta(head, "meta[name='description']")).toBe(sample.excerpt);
    expect(meta(head, "meta[property='og:image']")).toBe(`${SITE_URL}/og-default.png`);
  });

  it("SEC-UI-002: titles with markup are escaped in every head tag", () => {
    const evil = '"><script>alert(1)</script></title>';
    const head = buildHead(
      { title: evil, description: evil, path: "/work/x", type: "article", image: { ...fx.imageRef("x", evil) } },
      SITE_URL,
    );
    expect(head).not.toContain("<script>");
    expect(head).not.toContain('"><');
    expect(head).toContain("&lt;script&gt;");
    expect(head.match(/<title>/g)).toHaveLength(1);
    expect(head.match(/<\/title>/g)).toHaveLength(1);
  });

  it("og:image never points outside /media for unsafe image URLs", () => {
    const head = buildHead(
      { title: "t", description: "d", path: "/", type: "website", image: { ...fx.imageRef("x", "a"), url: "https://evil.example/x.png" } },
      SITE_URL,
    );
    expect(head).toContain(`${SITE_URL}/og-default.png`);
    expect(head).not.toContain("evil.example");
  });

  it("resolveMeta: error status → noindex error meta", () => {
    expect(resolveMeta([], undefined, 500)).toMatchObject({ noindex: true, path: null });
  });
});

describe("UI-T-012 route error page", () => {
  it("loader throws 500 → friendly message, Home link, header and footer present", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = createFixtureSource({
      work: () => {
        throw new Error("boom");
      },
    });
    const result = await render("/work", { source, siteUrl: SITE_URL });
    expect(result.status).toBe(500);
    const body = parse(result.html);
    expect(body.querySelector("h1")?.textContent).toBe("Something went wrong");
    expect(body.querySelector("main a[href='/']")?.textContent).toBe("Back to home");
    expect(body.querySelector("main a[href='/work']")?.textContent).toBe("Try again");
    expect(body.querySelector("header nav[aria-label='Main']")).not.toBeNull();
    expect(body.querySelector("footer")).not.toBeNull();
    expect(result.html).not.toContain("boom");
    expect(meta(headDoc(result.head), "meta[name='robots']")).toBe("noindex");
  });

  it("site data failure → root error boundary still renders the frame", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = createFixtureSource({
      site: () => {
        throw new Error("down");
      },
    });
    const result = await render("/", { source, siteUrl: SITE_URL });
    expect(result.status).toBe(500);
    const body = parse(result.html);
    expect(body.querySelector("h1")?.textContent).toBe("Something went wrong");
    expect(body.querySelector("header")).not.toBeNull();
  });
});

describe("UI-T-007 hydration produces no mismatch", () => {
  it.each(["/", "/work", "/work/case-study-1", "/writing?format=email", "/writing/writing-sample-2", "/about", "/contact", "/faqs"])(
    "%s hydrates cleanly",
    async (url) => {
      const result = await render(url, options());
      expect(result.status).toBe(200);
      // After hydration the writing filter applies (UI-029) and the contact submit button enables (UI-033):
      // intended post-hydration updates, not mismatches. Hydration itself must stay error-free everywhere.
      const changesAfterHydration = url.startsWith("/writing?") || url === "/contact";
      await expectCleanHydration(url, result.html, result.hydrationScript, !changesAfterHydration);
    },
  );

  it("404.html at an unknown case-study URL: client render from embedded data shows the 404 without fetching", async () => {
    const result = await render("/__not-found__", options({ notFoundDocument: true }));
    window.history.replaceState(null, "", "/work/missing-one");
    document.body.innerHTML = `<div id="root">${result.html}</div>${result.hydrationScript}`;
    const container = document.getElementById("root")!;
    const source = createFixtureSource();
    const spy = vi.spyOn(source, "get");
    const routes = createRoutes(source);
    const router = createBrowserRouter(routes, {
      hydrationData: toHydrationState(readHydrationPayload(document)!, routes, window.location.pathname),
    });
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(container);
    await act(async () => root.render(<RouterProvider router={router} />));
    expect(container.querySelector("h1")?.textContent).toBe("This page took a day off");
    expect(container.querySelector("a[aria-current='page']")?.textContent).toBe("Work");
    expect(spy).not.toHaveBeenCalled();
    act(() => root.unmount());
    router.dispose();
  });
});

async function expectCleanHydration(url: string, html: string, script: string, sameDom = true): Promise<void> {
  window.history.replaceState(null, "", url);
  document.body.innerHTML = `<div id="root">${html}</div>${script}`;
  const container = document.getElementById("root")!;
  const before = container.innerHTML;
  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
  const recoverable: unknown[] = [];

  const routes = createRoutes(createFixtureSource());
  const payload = readHydrationPayload(document)!;
  const router = createBrowserRouter(routes, {
    hydrationData: toHydrationState(payload, routes, window.location.pathname),
  });
  let root: ReturnType<typeof hydrateRoot> | undefined;
  await act(async () => {
    root = hydrateRoot(
      container,
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
      { onRecoverableError: (error) => recoverable.push(error) },
    );
  });
  expect(recoverable).toEqual([]);
  expect(errors).toEqual([]);
  if (sameDom) expect(container.innerHTML).toBe(before);
  act(() => root?.unmount());
  router.dispose();
  consoleError.mockRestore();
}
