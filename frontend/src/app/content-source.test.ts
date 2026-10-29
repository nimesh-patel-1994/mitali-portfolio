// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_BASE, publicApiHandlers } from "@/test/handlers";
import * as fx from "@/test/fixtures";
import { createApiContentSource } from "./content-source.api";
import { ContentSourceError, createRecordingSource, isNotFoundResponse } from "./content-source";
import { createStaticContentSource, dataFilePath } from "./content-source.static";

const server = setupServer(...publicApiHandlers());
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected rejection");
}

describe("UI-T-011 static content source", () => {
  it("200: returns /data/<key>.json", async () => {
    const fetch = vi.fn(async () => Response.json({ case_studies: [], faq_preview: [] }));
    const data = await createStaticContentSource({ fetch }).get("work");
    expect(data).toEqual({ case_studies: [], faq_preview: [] });
    expect(fetch).toHaveBeenCalledWith("/data/work.json", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("404: throws a 404 Response for the route boundary", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 404 }));
    expect(isNotFoundResponse(await caught(createStaticContentSource({ fetch }).get("work/unknown-slug")))).toBe(true);
  });

  it("network error: propagates to the route boundary", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const error = await caught(createStaticContentSource({ fetch }).get("work"));
    expect(error).toBeInstanceOf(TypeError);
  });

  it("500: throws ContentSourceError", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 500 }));
    expect(await caught(createStaticContentSource({ fetch }).get("faqs"))).toBeInstanceOf(ContentSourceError);
  });

  it("rejects path-traversal and invalid slugs as 404 without fetching", () => {
    expect(dataFilePath("writing/a-b")).toBe("/data/writing/a-b.json");
    for (const key of ["work/../site", "work/UPPER", "work/a/b", "admin/x"]) {
      let thrown: unknown;
      try {
        dataFilePath(key as "work");
      } catch (e) {
        thrown = e;
      }
      expect(isNotFoundResponse(thrown), key).toBe(true);
    }
  });
});

describe("api content source (generated client + MSW)", () => {
  const source = () => createApiContentSource({ baseUrl: API_BASE });

  it("site comes from getPublicSite", async () => {
    expect((await source().get("site")).generated_at).toBe(fx.GENERATED_AT);
  });

  it("home aggregate keeps the first 4 featured case studies in order", async () => {
    const home = await source().get("home");
    expect(home.featured_case_studies.map((c) => c.slug)).toEqual([
      "case-study-1",
      "case-study-2",
      "case-study-3",
      "case-study-4",
    ]);
    expect(home.services).toHaveLength(5);
    expect(home.testimonials).toHaveLength(5);
    expect(home.faq_preview).toHaveLength(6);
  });

  it("aggregates work, writing, about, contact, faqs", async () => {
    const s = source();
    expect((await s.get("work")).case_studies).toHaveLength(6);
    expect((await s.get("writing")).samples).toHaveLength(12);
    expect((await s.get("about")).process_steps).toHaveLength(4);
    expect((await s.get("contact")).faq_preview).toHaveLength(6);
    expect((await s.get("faqs")).groups.flatMap((g) => g.faqs)).toHaveLength(16);
  });

  it("detail keys return mapped details; unknown slug → 404 Response", async () => {
    const s = source();
    expect((await s.get("work/case-study-2")).problem_html).toContain("inconsistent");
    expect((await s.get("writing/writing-sample-1")).body_html).toContain("<h2>");
    expect(isNotFoundResponse(await caught(s.get(`work/${fx.unpublishedCaseStudySlug}`)))).toBe(true);
  });

  it("5xx → ContentSourceError naming the endpoint", async () => {
    server.use(http.get(`${API_BASE}/api/public/services`, () => HttpResponse.json({}, { status: 500 })));
    const error = await caught(source().get("home"));
    expect(error).toBeInstanceOf(ContentSourceError);
    expect((error as Error).message).toContain("/api/public/services");
  });

  it("unreachable API → ContentSourceError", async () => {
    server.use(http.get(`${API_BASE}/api/public/site`, () => HttpResponse.error()));
    expect(await caught(source().get("site"))).toBeInstanceOf(ContentSourceError);
  });
});

describe("recording source", () => {
  it("fetches each key once and remembers data in first-read order", async () => {
    const inner = { get: vi.fn(async (key: string) => ({ key })) };
    const rec = createRecordingSource(inner as never);
    await Promise.all([rec.get("site"), rec.get("site"), rec.get("work")]);
    expect(inner.get).toHaveBeenCalledTimes(2);
    expect(rec.entries().map(([k]) => k)).toEqual(["site", "work"]);
  });
});
