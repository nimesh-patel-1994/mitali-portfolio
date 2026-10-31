/**
 * UI-T-146 / UI-103 / UI-115 (ports of frontend/ UI-T-004..007, UI-T-012): server render of `/`, `/work/<slug>`,
 * `/work/unknown` and a loader 500; head tags; no inline executable script or style; hydration without mismatch.
 */
import { act } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readHydrationPayload, toHydrationState } from "@/app/hydration";
import { resolveLazyMatches } from "@/app/lazy-routes";
import { createRoutes } from "@/app/routes";
import { buildHead } from "@/features/public/seo/head";
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

describe("UI-T-146 render('/')", () => {
  it("status 200, one h1, skip link, main, head tags identical in shape to frontend/ and hydration data", async () => {
    const result = await render("/", options());
    expect(result.status).toBe(200);
    const body = parse(result.html);
    expect(body.querySelectorAll("h1")).toHaveLength(1);
    expect(body.querySelector("main#main")).not.toBeNull();
    expect(body.querySelector("a[href='#main']")?.textContent).toBe("Skip to content");
    expect(body.querySelector("footer a[href='/contact']")).not.toBeNull();

    const head = headDoc(result.head);
    expect(head.title).toBe("Mitali — Content Writer & Marketing Strategist");
    expect(meta(head, "meta[name='description']")).toBeTruthy();
    expect(head.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe(`${SITE_URL}/`);
    expect(meta(head, "meta[property='og:type']")).toBe("website");
    expect(meta(head, "meta[property='og:image']")).toBe(`${SITE_URL}/og-default.png`);
    expect(head.querySelector("meta[name='robots']")).toBeNull();

    expect(result.hydrationScript).toContain('id="__ROUTER_DATA__"');
    expect(result.hydration.loaderData.root).toEqual(fx.site);
    expect(result.routeIds).toEqual(["root", "home"]);
  });

  it("no inline executable script, no style or on* attributes; reveal markers are stable attributes (SEC-UI-015)", async () => {
    for (const url of ["/", "/work/case-study-1"]) {
      const result = await render(url, options());
      expect(result.html).not.toContain("__staticRouterHydrationData");
      expect(result.html).not.toMatch(/<script/);
      expect(result.html).not.toMatch(/\sstyle=/);
      expect(result.html).not.toMatch(/\son[a-z]+=/);
      expect(result.html).toContain('data-reveal=""');
      expect(result.html).not.toContain("data-revealed");
      expect(result.html).not.toContain("data-motion");
    }
  });
});

describe("UI-T-146 render('/work/<slug>') and unknown", () => {
  it("case study: unique title, summary description, canonical without trailing slash, og:type article", async () => {
    const cs = fx.caseStudies[1]!;
    const result = await render(`/work/${cs.slug}/`, options());
    const head = headDoc(result.head);
    expect(head.title).toBe(`${cs.title} — Mitali`);
    expect(meta(head, "meta[name='description']")).toBe(cs.summary);
    expect(head.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe(`${SITE_URL}/work/${cs.slug}`);
    expect(meta(head, "meta[property='og:image']")).toBe(`${SITE_URL}${cs.cover!.url}`);
    expect(meta(head, "meta[property='og:type']")).toBe("article");
    expect(parse(result.html).querySelector("h1")?.textContent).toBe(cs.title);
  });

  it("unknown slug → status 404, not-found content, noindex, header and footer present, header solid", async () => {
    const result = await render("/work/unknown", options());
    expect(result.status).toBe(404);
    const body = parse(result.html);
    expect(body.querySelector("h1")?.textContent).toBe("This page took a day off");
    expect(body.querySelector("header")?.getAttribute("data-compact")).toBe("true");
    expect(body.querySelector("footer")).not.toBeNull();
    const head = headDoc(result.head);
    expect(meta(head, "meta[name='robots']")).toBe("noindex");
    expect(head.title).toBe("Page not found — Mitali");
    expect(head.querySelector("link[rel='canonical']")).toBeNull();
  });

  it("PH-3 routes (e.g. /work) show the not-found page until they arrive", async () => {
    const result = await render("/work", options());
    expect(parse(result.html).querySelector("h1")?.textContent).toBe("This page took a day off");
  });

  it("invalid slug shapes are 404 without calling the source for the page", async () => {
    const source = createFixtureSource();
    const spy = vi.spyOn(source, "get");
    const result = await render("/work/Not_A_Slug", { source, siteUrl: SITE_URL });
    expect(result.status).toBe(404);
    expect(spy.mock.calls.map(([k]) => k)).toEqual(["site"]);
  });

  it("SEC-UI-002: titles with markup are escaped", () => {
    const evil = '"><script>alert(1)</script></title>';
    const head = buildHead({ title: evil, description: evil, path: "/work/x", type: "article" }, SITE_URL);
    expect(head).not.toContain("<script>");
    expect(head.match(/<title>/g)).toHaveLength(1);
  });
});

describe("UI-T-146 route error page (port of UI-T-012)", () => {
  it("loader 500 → friendly message, reload link, header and footer present, nothing leaked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = createFixtureSource({
      home: () => {
        throw new Error("boom");
      },
    });
    const result = await render("/", { source, siteUrl: SITE_URL });
    expect(result.status).toBe(500);
    const body = parse(result.html);
    expect(body.querySelector("h1")?.textContent).toBe("Something went wrong");
    const links = [...body.querySelectorAll("main a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Try again", "/"],
      ["Back to home", "/"],
    ]);
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

async function expectCleanHydration(url: string, html: string, script: string): Promise<void> {
  window.history.replaceState(null, "", url);
  document.body.innerHTML = `<div id="root">${html}</div>${script}`;
  const container = document.getElementById("root")!;
  const before = container.innerHTML;
  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
  const recoverable: unknown[] = [];
  const routes = createRoutes(createFixtureSource());
  await resolveLazyMatches(routes, window.location.pathname);
  const payload = readHydrationPayload(document)!;
  const router = createBrowserRouter(routes, { hydrationData: toHydrationState(payload, routes, window.location.pathname) });
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
  expect(container.innerHTML).toBe(before);
  act(() => root?.unmount());
  router.dispose();
  consoleError.mockRestore();
}

describe("UI-T-146 hydration produces no mismatch", () => {
  it.each(["/", "/work/case-study-1", "/work/case-study-4"])("%s hydrates cleanly", async (url) => {
    const result = await render(url, options());
    expect(result.status).toBe(200);
    await expectCleanHydration(url, result.html, result.hydrationScript);
  });

  it("the not-found page hydrates cleanly", async () => {
    const result = await render("/work/unknown", options());
    await expectCleanHydration("/work/unknown", result.html, result.hydrationScript);
  });
});
