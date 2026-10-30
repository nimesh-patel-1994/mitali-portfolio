/**
 * Contract-shaped MSW handlers for the admin API (docs/api-contract.yaml), backed by an in-memory store so that
 * mutations followed by refetches behave like the real backend. Every request is recorded (method, path, body,
 * CSRF header) so tests can assert on what was sent. Non-GET requests other than login require the CSRF header
 * (403 `csrf_failed` otherwise), like the backend (TS-008).
 */
import { http, HttpResponse, type HttpHandler } from "msw";
import type {
  AdminCaseStudy,
  AdminCoreValue,
  AdminEngagementModel,
  AdminFaq,
  AdminFaqCategory,
  AdminProcessStep,
  AdminService,
  AdminTestimonial,
  AdminWritingSample,
  Enquiry,
  MediaAsset,
} from "@/features/admin/api/types";
import type { components } from "@/api/schema";
import * as ax from "./admin-fixtures";

type ApiErrorBody = components["schemas"]["Error"];

export interface RecordedRequest {
  method: string;
  path: string;
  search: string;
  body: unknown;
  csrf: string | null;
}

export const PASSWORD = "correct-horse-battery";

function initialDb() {
  return {
    loggedIn: true,
    csrf: ax.SESSION.csrf_token,
    dashboard: ax.dashboard(),
    caseStudies: [1, 2, 3, 4, 5, 6].map((n) => ax.adminCaseStudy(n)),
    writing: Array.from({ length: 12 }, (_, i) => ax.adminWritingSample(i + 1)),
    services: ax.services(),
    engagementModels: ax.engagementModels(),
    testimonials: ax.testimonials(),
    values: ax.values(),
    processSteps: ax.processSteps(),
    faqCategories: ax.faqCategories(),
    faqs: ax.faqs(),
    media: Array.from({ length: 30 }, (_, i) => ax.mediaAsset(i + 1)),
    mediaInUse: new Set<string>([ax.id(90, 1)]),
    profile: ax.profile(),
    settings: ax.settings(),
    enquiries: [
      ax.enquiry(1),
      ax.enquiry(2),
      ax.enquiry(3, { status: "replied" }),
      ax.enquiry(4),
      ax.enquiry(5, { status: "archived" }),
    ],
    nextId: 1,
  };
}

export type AdminDb = ReturnType<typeof initialDb>;
export let db: AdminDb = initialDb();
export const recorded: RecordedRequest[] = [];

export function resetAdminDb(): void {
  db = initialDb();
  recorded.length = 0;
}

export function requestsTo(method: string, pathPattern: string | RegExp): RecordedRequest[] {
  return recorded.filter(
    (r) => r.method === method && (typeof pathPattern === "string" ? r.path === pathPattern : pathPattern.test(r.path)),
  );
}

export const apiError = (status: number, code: ApiErrorBody["error"]["code"], message: string, fields?: Record<string, string>) =>
  HttpResponse.json<ApiErrorBody>({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });

const notFound = () => apiError(404, "not_found", "Not found");
const noContent = () => new HttpResponse(null, { status: 204 });

function newId(): string {
  db.nextId += 1;
  return ax.id(99, db.nextId);
}

/**
 * Minimal multipart parser for assertions (undici's `formData()` rejects jsdom `File` parts in this environment):
 * returns `{ field: value }` for text parts and `{ field: { name, type } }` for file parts.
 */
export function parseMultipart(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const part of text.split(/\r?\n--/)) {
    const name = /name="([^"]+)"/.exec(part)?.[1];
    if (!name) continue;
    const filename = /filename="([^"]*)"/.exec(part)?.[1];
    if (filename !== undefined) {
      out[name] = { name: filename, type: /Content-Type:\s*([^\r\n]+)/i.exec(part)?.[1]?.trim() ?? "" };
    } else {
      out[name] = part.split(/\r?\n\r?\n/)[1]?.replace(/\r?\n$/, "") ?? "";
    }
  }
  return out;
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) return parseMultipart(await request.clone().text());
    const text = await request.clone().text();
    return text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

type Handler = (args: { request: Request; params: Record<string, string>; body: unknown }) => Response | Promise<Response>;

/** Wraps a resolver with recording, the session check and the CSRF check. */
function route(method: "get" | "post" | "put" | "patch" | "delete", path: string, handler: Handler, opts: { auth?: boolean } = {}): HttpHandler {
  return http[method](`*${path}`, async ({ request, params }) => {
    const url = new URL(request.url);
    const body = await readBody(request);
    const csrf = request.headers.get("x-csrf-token");
    recorded.push({ method: request.method, path: url.pathname, search: url.search, body, csrf });
    if (opts.auth !== false && !db.loggedIn) return apiError(401, "unauthenticated", "Not logged in");
    if (method !== "get" && opts.auth !== false && csrf !== db.csrf) return apiError(403, "csrf_failed", "CSRF check failed");
    return handler({ request, params: params as Record<string, string>, body });
  });
}

function checkOrder(current: Array<{ id: string }>, ids: unknown): boolean {
  if (!Array.isArray(ids) || ids.length !== current.length) return false;
  const set = new Set(current.map((x) => x.id));
  return ids.every((i) => typeof i === "string" && set.delete(i)) && set.size === 0;
}

function applyOrder<T extends { id: string; position: number }>(items: T[], ids: string[]): T[] {
  return ids.map((i, position) => ({ ...items.find((x) => x.id === i)!, position }));
}

/** Generic CRUD for the small content types. */
function crud<T extends { id: string; position: number; created_at: string; updated_at: string }>(
  base: string,
  get: () => T[],
  set: (items: T[]) => void,
): HttpHandler[] {
  return [
    route("get", base, () => HttpResponse.json(get())),
    route("post", base, ({ body }) => {
      const item = { ...(body as object), id: newId(), position: get().length, created_at: ax.T0, updated_at: ax.T0 } as T;
      set([...get(), item]);
      return HttpResponse.json(item, { status: 201 });
    }),
    route("put", `${base}/order`, ({ body }) => {
      const ids = (body as { ids?: unknown }).ids;
      if (!checkOrder(get(), ids)) return apiError(422, "order_mismatch", "Order mismatch");
      set(applyOrder(get(), ids as string[]));
      return noContent();
    }),
    route("get", `${base}/:id`, ({ params }) => {
      const item = get().find((x) => x.id === params.id);
      return item ? HttpResponse.json(item) : notFound();
    }),
    route("put", `${base}/:id`, ({ params, body }) => {
      const item = get().find((x) => x.id === params.id);
      if (!item) return notFound();
      const updated = { ...item, ...(body as object) } as T;
      set(get().map((x) => (x.id === item.id ? updated : x)));
      return HttpResponse.json(updated);
    }),
    route("delete", `${base}/:id`, ({ params }) => {
      if (!get().some((x) => x.id === params.id)) return notFound();
      set(get().filter((x) => x.id !== params.id));
      return noContent();
    }),
  ];
}

function findCaseStudy(csId: string): AdminCaseStudy | undefined {
  return db.caseStudies.find((c) => c.id === csId);
}

function replaceCaseStudy(updated: AdminCaseStudy): void {
  db.caseStudies = db.caseStudies.map((c) => (c.id === updated.id ? updated : c));
}

function mediaRef(mediaId: string | null, alt: string | null) {
  if (!mediaId) return null;
  const asset = db.media.find((m) => m.id === mediaId);
  return {
    url: asset?.url ?? `/media/uploads/2026/10/${mediaId}.webp`,
    alt: alt ?? "",
    width: 1600,
    height: 900,
    mime: "image/webp" as const,
    srcset: asset?.variants ?? [],
  };
}

export function adminHandlers(): HttpHandler[] {
  return [
    /* ---- auth ---- */
    route(
      "post",
      "/api/admin/auth/login",
      ({ body }) => {
        const { password } = body as { email: string; password: string };
        if (password !== PASSWORD) return apiError(401, "invalid_credentials", "Email or password is incorrect.");
        db.loggedIn = true;
        return HttpResponse.json(ax.SESSION);
      },
      { auth: false },
    ),
    route("post", "/api/admin/auth/logout", () => {
      db.loggedIn = false;
      return noContent();
    }),
    route("get", "/api/admin/auth/me", () => HttpResponse.json({ ...ax.SESSION, csrf_token: db.csrf })),
    route("get", "/api/admin/dashboard", () =>
      HttpResponse.json({ ...db.dashboard, new_enquiries: db.enquiries.filter((e) => e.status === "new").length }),
    ),

    /* ---- case studies ---- */
    route("get", "/api/admin/case-studies", () => HttpResponse.json(db.caseStudies.map(ax.caseStudyListItem))),
    route("post", "/api/admin/case-studies", ({ body }) => {
      const input = body as AdminCaseStudy;
      if (db.caseStudies.some((c) => c.slug === input.slug)) {
        return apiError(409, "slug_taken", "Slug taken", { slug: "This slug is already used by another case study." });
      }
      const created: AdminCaseStudy = {
        ...input,
        id: newId(),
        position: db.caseStudies.length,
        created_at: ax.T0,
        updated_at: ax.T0,
        problem_html: `<p>${input.problem_md}</p>`,
        solution_html: `<p>${input.solution_md}</p>`,
        cover: mediaRef(input.cover_media_id, input.cover_alt),
        results: [],
        images: [],
      };
      db.caseStudies = [...db.caseStudies, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    route("put", "/api/admin/case-studies/order", ({ body }) => {
      const ids = (body as { ids?: unknown }).ids;
      if (!checkOrder(db.caseStudies, ids)) return apiError(422, "order_mismatch", "Order mismatch");
      db.caseStudies = applyOrder(db.caseStudies, ids as string[]);
      return noContent();
    }),
    route("get", "/api/admin/case-studies/:id", ({ params }) => {
      const cs = findCaseStudy(params.id!);
      return cs ? HttpResponse.json(cs) : notFound();
    }),
    route("put", "/api/admin/case-studies/:id", ({ params, body }) => {
      const cs = findCaseStudy(params.id!);
      if (!cs) return notFound();
      const input = body as AdminCaseStudy;
      if (db.caseStudies.some((c) => c.slug === input.slug && c.id !== cs.id)) {
        return apiError(409, "slug_taken", "Slug taken", { slug: "This slug is already used by another case study." });
      }
      const updated: AdminCaseStudy = { ...cs, ...input, cover: mediaRef(input.cover_media_id, input.cover_alt) };
      replaceCaseStudy(updated);
      return HttpResponse.json(updated);
    }),
    route("delete", "/api/admin/case-studies/:id", ({ params }) => {
      if (!findCaseStudy(params.id!)) return notFound();
      db.caseStudies = db.caseStudies.filter((c) => c.id !== params.id);
      return noContent();
    }),
    route("post", "/api/admin/case-studies/:id/results", ({ params, body }) => {
      const cs = findCaseStudy(params.id!);
      if (!cs) return notFound();
      const created = { ...(body as object), id: newId(), position: cs.results.length, created_at: ax.T0, updated_at: ax.T0 } as AdminCaseStudy["results"][number];
      replaceCaseStudy({ ...cs, results: [...cs.results, created] });
      return HttpResponse.json(created, { status: 201 });
    }),
    route("put", "/api/admin/case-studies/:id/results/order", ({ params, body }) => {
      const cs = findCaseStudy(params.id!);
      if (!cs) return notFound();
      const ids = (body as { ids?: unknown }).ids;
      if (!checkOrder(cs.results, ids)) return apiError(422, "order_mismatch", "Order mismatch");
      replaceCaseStudy({ ...cs, results: applyOrder(cs.results, ids as string[]) });
      return noContent();
    }),
    route("put", "/api/admin/case-studies/:id/results/:itemId", ({ params, body }) => {
      const cs = findCaseStudy(params.id!);
      const r = cs?.results.find((x) => x.id === params.itemId);
      if (!cs || !r) return notFound();
      const updated = { ...r, ...(body as object) };
      replaceCaseStudy({ ...cs, results: cs.results.map((x) => (x.id === r.id ? updated : x)) });
      return HttpResponse.json(updated);
    }),
    route("delete", "/api/admin/case-studies/:id/results/:itemId", ({ params }) => {
      const cs = findCaseStudy(params.id!);
      if (!cs || !cs.results.some((x) => x.id === params.itemId)) return notFound();
      replaceCaseStudy({ ...cs, results: cs.results.filter((x) => x.id !== params.itemId) });
      return noContent();
    }),
    route("post", "/api/admin/case-studies/:id/images", ({ params, body }) => {
      const cs = findCaseStudy(params.id!);
      if (!cs) return notFound();
      const input = body as { media_id: string; alt: string; caption: string | null; layout: "full" | "half" };
      const created = { ...input, id: newId(), position: cs.images.length, created_at: ax.T0, updated_at: ax.T0, image: mediaRef(input.media_id, input.alt)! };
      replaceCaseStudy({ ...cs, images: [...cs.images, created] });
      return HttpResponse.json(created, { status: 201 });
    }),
    route("put", "/api/admin/case-studies/:id/images/order", ({ params, body }) => {
      const cs = findCaseStudy(params.id!);
      if (!cs) return notFound();
      const ids = (body as { ids?: unknown }).ids;
      if (!checkOrder(cs.images, ids)) return apiError(422, "order_mismatch", "Order mismatch");
      replaceCaseStudy({ ...cs, images: applyOrder(cs.images, ids as string[]) });
      return noContent();
    }),
    route("put", "/api/admin/case-studies/:id/images/:itemId", ({ params, body }) => {
      const cs = findCaseStudy(params.id!);
      const img = cs?.images.find((x) => x.id === params.itemId);
      if (!cs || !img) return notFound();
      const updated = { ...img, ...(body as object) };
      replaceCaseStudy({ ...cs, images: cs.images.map((x) => (x.id === img.id ? updated : x)) });
      return HttpResponse.json(updated);
    }),
    route("delete", "/api/admin/case-studies/:id/images/:itemId", ({ params }) => {
      const cs = findCaseStudy(params.id!);
      if (!cs || !cs.images.some((x) => x.id === params.itemId)) return notFound();
      replaceCaseStudy({ ...cs, images: cs.images.filter((x) => x.id !== params.itemId) });
      return noContent();
    }),

    /* ---- writing samples ---- */
    route("get", "/api/admin/writing-samples", () => HttpResponse.json(db.writing.map(ax.writingListItem))),
    route("post", "/api/admin/writing-samples", ({ body }) => {
      const input = body as AdminWritingSample;
      const created: AdminWritingSample = {
        ...input,
        id: newId(),
        position: db.writing.length,
        created_at: ax.T0,
        updated_at: ax.T0,
        body_html: `<p>${input.body_md}</p>`,
        word_count: 321,
        reading_time_min: 2,
        thumbnail: mediaRef(input.thumbnail_media_id, input.thumbnail_alt),
      };
      db.writing = [...db.writing, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    route("put", "/api/admin/writing-samples/order", ({ body }) => {
      const ids = (body as { ids?: unknown }).ids;
      if (!checkOrder(db.writing, ids)) return apiError(422, "order_mismatch", "Order mismatch");
      db.writing = applyOrder(db.writing, ids as string[]);
      return noContent();
    }),
    route("get", "/api/admin/writing-samples/:id", ({ params }) => {
      const ws = db.writing.find((w) => w.id === params.id);
      return ws ? HttpResponse.json(ws) : notFound();
    }),
    route("put", "/api/admin/writing-samples/:id", ({ params, body }) => {
      const ws = db.writing.find((w) => w.id === params.id);
      if (!ws) return notFound();
      const updated = { ...ws, ...(body as object), word_count: 999, reading_time_min: 5 } as AdminWritingSample;
      db.writing = db.writing.map((w) => (w.id === ws.id ? updated : w));
      return HttpResponse.json(updated);
    }),
    route("delete", "/api/admin/writing-samples/:id", ({ params }) => {
      if (!db.writing.some((w) => w.id === params.id)) return notFound();
      db.writing = db.writing.filter((w) => w.id !== params.id);
      return noContent();
    }),

    /* ---- small types ---- */
    ...crud<AdminService>("/api/admin/services", () => db.services, (v) => (db.services = v)),
    ...crud<AdminEngagementModel>("/api/admin/engagement-models", () => db.engagementModels, (v) => (db.engagementModels = v)),
    ...crud<AdminTestimonial>("/api/admin/testimonials", () => db.testimonials, (v) => (db.testimonials = v)),
    ...crud<AdminCoreValue>("/api/admin/values", () => db.values, (v) => (db.values = v)),
    ...crud<AdminProcessStep>("/api/admin/process-steps", () => db.processSteps, (v) => (db.processSteps = v)),

    /* ---- FAQs ---- */
    route("delete", "/api/admin/faq-categories/:id", ({ params }) => {
      if (!db.faqCategories.some((c) => c.id === params.id)) return notFound();
      if (db.faqs.some((f) => f.category_id === params.id)) {
        return apiError(409, "category_not_empty", "Move or delete the FAQs in this category first.");
      }
      db.faqCategories = db.faqCategories.filter((c) => c.id !== params.id);
      return noContent();
    }),
    ...crud<AdminFaqCategory>("/api/admin/faq-categories", () => db.faqCategories, (v) => (db.faqCategories = v)),
    route("get", "/api/admin/faqs", ({ request }) => {
      const cat = new URL(request.url).searchParams.get("category_id");
      const order = (f: AdminFaq) => db.faqCategories.findIndex((c) => c.id === f.category_id) * 1000 + f.position;
      const list = [...db.faqs].sort((a, b) => order(a) - order(b));
      return HttpResponse.json(cat ? list.filter((f) => f.category_id === cat) : list);
    }),
    route("post", "/api/admin/faqs", ({ body }) => {
      const input = body as AdminFaq;
      const created = { ...input, id: newId(), position: db.faqs.filter((f) => f.category_id === input.category_id).length, created_at: ax.T0, updated_at: ax.T0 };
      db.faqs = [...db.faqs, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    route("put", "/api/admin/faqs/order", ({ body }) => {
      const { category_id, ids } = body as { category_id: string; ids: unknown };
      const scope = db.faqs.filter((f) => f.category_id === category_id);
      if (!checkOrder(scope, ids)) return apiError(422, "order_mismatch", "Order mismatch");
      const ordered = applyOrder(scope, ids as string[]);
      db.faqs = [...db.faqs.filter((f) => f.category_id !== category_id), ...ordered];
      return noContent();
    }),
    route("put", "/api/admin/faqs/:id", ({ params, body }) => {
      const faq = db.faqs.find((f) => f.id === params.id);
      if (!faq) return notFound();
      const input = body as AdminFaq;
      const moved = input.category_id !== faq.category_id;
      const updated: AdminFaq = {
        ...faq,
        ...input,
        position: moved ? Math.max(-1, ...db.faqs.filter((f) => f.category_id === input.category_id).map((f) => f.position)) + 1 : faq.position,
      };
      db.faqs = db.faqs.map((f) => (f.id === faq.id ? updated : f));
      return HttpResponse.json(updated);
    }),
    route("get", "/api/admin/faqs/:id", ({ params }) => {
      const faq = db.faqs.find((f) => f.id === params.id);
      return faq ? HttpResponse.json(faq) : notFound();
    }),
    route("delete", "/api/admin/faqs/:id", ({ params }) => {
      if (!db.faqs.some((f) => f.id === params.id)) return notFound();
      db.faqs = db.faqs.filter((f) => f.id !== params.id);
      return noContent();
    }),

    /* ---- media + markdown ---- */
    route("get", "/api/admin/media", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get("page") ?? 1);
      const size = Number(params.get("page_size") ?? 20);
      const items = db.media.slice((page - 1) * size, page * size);
      return HttpResponse.json({ items, total: db.media.length, page, page_size: size });
    }),
    route("post", "/api/admin/media", ({ body }) => {
      const file = (body as { file?: { name: string } } | undefined)?.file;
      const asset: MediaAsset = ax.mediaAsset(500 + db.nextId, { id: newId(), original_filename: file?.name ?? "upload.png" });
      db.media = [asset, ...db.media];
      return HttpResponse.json(asset, { status: 201 });
    }),
    route("delete", "/api/admin/media/:id", ({ params }) => {
      if (!db.media.some((m) => m.id === params.id)) return notFound();
      if (db.mediaInUse.has(params.id!)) return apiError(409, "media_in_use", "In use");
      db.media = db.media.filter((m) => m.id !== params.id);
      return noContent();
    }),
    route("post", "/api/admin/markdown/preview", ({ body }) => {
      const md = (body as { markdown: string }).markdown;
      const text = md.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
      return HttpResponse.json({ html: `<p>${text}</p>`, word_count: md.split(/\s+/).filter(Boolean).length, reading_time_min: 1 });
    }),

    /* ---- profile + settings ---- */
    route("get", "/api/admin/profile", () => HttpResponse.json(db.profile)),
    route("put", "/api/admin/profile", ({ body }) => {
      db.profile = { ...db.profile, ...(body as object), updated_at: "2026-10-29T13:00:00+00:00" };
      return HttpResponse.json(db.profile);
    }),
    route("get", "/api/admin/settings", () => HttpResponse.json(db.settings)),
    route("put", "/api/admin/settings", ({ body }) => {
      db.settings = { ...db.settings, ...(body as object), updated_at: "2026-10-29T13:00:00+00:00" };
      return HttpResponse.json(db.settings);
    }),

    /* ---- enquiries ---- */
    route("get", "/api/admin/enquiries", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const status = params.get("status");
      const page = Number(params.get("page") ?? 1);
      const size = Number(params.get("page_size") ?? 20);
      const all = db.enquiries
        .filter((e) => !status || e.status === status)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(ax.enquirySummary);
      return HttpResponse.json({ items: all.slice((page - 1) * size, page * size), total: all.length, page, page_size: size });
    }),
    route("get", "/api/admin/enquiries/:id", ({ params }) => {
      const e = db.enquiries.find((x) => x.id === params.id);
      return e ? HttpResponse.json(e) : notFound();
    }),
    route("patch", "/api/admin/enquiries/:id", ({ params, body }) => {
      const e = db.enquiries.find((x) => x.id === params.id);
      if (!e) return notFound();
      const updated: Enquiry = { ...e, status: (body as { status: Enquiry["status"] }).status, status_changed_at: ax.T0 };
      db.enquiries = db.enquiries.map((x) => (x.id === e.id ? updated : x));
      return HttpResponse.json(updated);
    }),
    route("delete", "/api/admin/enquiries/:id", ({ params }) => {
      if (!db.enquiries.some((x) => x.id === params.id)) return notFound();
      db.enquiries = db.enquiries.filter((x) => x.id !== params.id);
      return noContent();
    }),
  ];
}
