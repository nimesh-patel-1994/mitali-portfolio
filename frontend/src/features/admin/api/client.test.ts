import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { apiError, requestsTo } from "@/test/admin-handlers";
import { SESSION } from "@/test/admin-fixtures";
import { setupAdminServer } from "@/test/admin-render";
import { getCsrfToken, setCsrfToken, setUnauthorizedHandler } from "../session/session-store";
import { caseStudyApi, serviceApi } from "./admin-api";
import { ApiError, isRetryable } from "./errors";
import { createAdminQueryClient } from "./query";

const server = setupAdminServer();

describe("UI-T-070 admin client middleware (UI-035, SEC-UI-006)", () => {
  it("sends X-CSRF-Token only on non-GET requests, with same-origin credentials", async () => {
    setCsrfToken(SESSION.csrf_token);
    await serviceApi.list();
    const services = await serviceApi.list();
    await serviceApi.update(services[0]!.id, { ...services[0]!, name: "Renamed" });
    const get = requestsTo("GET", "/api/admin/services");
    const put = requestsTo("PUT", /\/api\/admin\/services\/.+/);
    expect(get.every((r) => r.csrf === null)).toBe(true);
    expect(put).toHaveLength(1);
    expect(put[0]!.csrf).toBe(SESSION.csrf_token);
  });

  it("401 clears the token and calls the session-ended handler (cache clear + redirect live in the app)", async () => {
    setCsrfToken(SESSION.csrf_token);
    const onEnded = vi.fn();
    const unregister = setUnauthorizedHandler(onEnded);
    server.use(http.get("*/api/admin/case-studies", () => apiError(401, "unauthenticated", "Session expired")));
    await expect(caseStudyApi.listAdminCaseStudies()).rejects.toMatchObject({ status: 401, code: "unauthenticated" });
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(getCsrfToken()).toBeNull();
    unregister();
  });

  it("403 csrf_failed → getAdminMe once, then one retry with the fresh token", async () => {
    setCsrfToken("stale-token");
    let attempts = 0;
    server.use(
      http.get("*/api/admin/auth/me", () => HttpResponse.json({ ...SESSION, csrf_token: "fresh-token" })),
      http.put("*/api/admin/services/order", ({ request }) => {
        attempts += 1;
        return request.headers.get("x-csrf-token") === "fresh-token"
          ? new HttpResponse(null, { status: 204 })
          : apiError(403, "csrf_failed", "CSRF check failed");
      }),
    );
    await serviceApi.reorder(["a", "b"]);
    expect(attempts).toBe(2);
    expect(getCsrfToken()).toBe("fresh-token");
  });

  it("403 csrf_failed twice → the second failure is surfaced (no loop)", async () => {
    setCsrfToken("stale-token");
    let attempts = 0;
    let meCalls = 0;
    server.use(
      http.get("*/api/admin/auth/me", () => {
        meCalls += 1;
        return HttpResponse.json({ ...SESSION, csrf_token: "still-wrong" });
      }),
      http.put("*/api/admin/services/order", () => {
        attempts += 1;
        return apiError(403, "csrf_failed", "CSRF check failed");
      }),
    );
    await expect(serviceApi.reorder(["a"])).rejects.toMatchObject({ status: 403, code: "csrf_failed" });
    expect(attempts).toBe(2);
    expect(meCalls).toBe(1);
  });

  it("network failure becomes ApiError status 0; error envelope parsed into code/message/fields", async () => {
    server.use(http.get("*/api/admin/services", () => HttpResponse.error()));
    const error = await serviceApi.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: "network_error" });

    setCsrfToken(SESSION.csrf_token);
    server.use(http.post("*/api/admin/services", () => apiError(422, "validation_error", "Invalid", { name: "Too long" })));
    const invalid = await serviceApi.create({ name: "x", description: "y", deliverables: [], is_published: true }).catch((e: unknown) => e);
    expect(invalid).toMatchObject({ status: 422, code: "validation_error", message: "Invalid", fields: { name: "Too long" } });
  });

  it("query defaults: staleTime 30 s; retry only network/5xx up to 2 times, never 4xx", () => {
    const client = createAdminQueryClient();
    const options = client.getDefaultOptions().queries!;
    expect(options.staleTime).toBe(30_000);
    const retry = options.retry as (count: number, error: unknown) => boolean;
    expect(retry(0, new ApiError(500, "internal_error", "x"))).toBe(true);
    expect(retry(1, new ApiError(0, "network_error", "x"))).toBe(true);
    expect(retry(2, new ApiError(503, "service_unavailable", "x"))).toBe(false);
    expect(retry(0, new ApiError(404, "not_found", "x"))).toBe(false);
    expect(retry(0, new ApiError(422, "validation_error", "x"))).toBe(false);
    expect(isRetryable(new Error("other"))).toBe(false);
  });
});
