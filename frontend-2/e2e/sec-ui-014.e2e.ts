/**
 * UI-T-149 / REQ-090 / SEC-UI-014 required proofs 2, 3 and 4 (backend on the seeded TEST database).
 * NOT RUN BY THE BUILDER. Proof 1 (no rewrite in dist/, dist-ssr/ or preview) is scripts/check-dist.test.ts +
 * vite/dev-origin.test.ts; proof 4 is also covered without a backend by vite/dev-server-proxy.test.ts.
 * This file names frontend/ only for the read-only "frontend 1 is unaffected" check (documented exception in
 * scripts/self-containment.test.ts); it imports nothing from it.
 */
import { expect, request as pwRequest, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ADMIN_EMAIL, APP_DIR, BACKEND_URL, DEV_URL, FRONTEND1_DEV_URL, adminPassword, devServerLog, reachable } from "./support/harness";

const json = { "content-type": "application/json" };

test.describe("UI-T-149 admin auth through the frontend-2 dev server (5174)", () => {
  test("login 200 (wrong password 401, never 403 origin_rejected), me, logout 204; foreign origin → 403", async () => {
    const ctx = await pwRequest.newContext({ baseURL: DEV_URL });
    const wrong = await ctx.post("/api/admin/auth/login", {
      headers: { ...json, origin: DEV_URL },
      data: { email: ADMIN_EMAIL, password: "definitely-wrong" },
    });
    expect(wrong.status()).toBe(401);

    const login = await ctx.post("/api/admin/auth/login", {
      headers: { ...json, origin: DEV_URL },
      data: { email: ADMIN_EMAIL, password: adminPassword() },
    });
    expect(login.status(), await login.text()).toBe(200);
    const session = (await login.json()) as { csrf_token: string };

    const me = await ctx.get("/api/admin/auth/me", { headers: { origin: DEV_URL } });
    expect(me.status()).toBe(200);

    const logout = await ctx.post("/api/admin/auth/logout", {
      headers: { origin: DEV_URL, "x-csrf-token": session.csrf_token },
    });
    expect(logout.status()).toBe(204);

    const foreign = await ctx.post("/api/admin/auth/login", {
      headers: { ...json, origin: "http://evil.example" },
      data: { email: ADMIN_EMAIL, password: adminPassword() },
    });
    expect(foreign.status()).toBe(403);
    expect(((await foreign.json()) as { error: { code: string } }).error.code).toBe("origin_rejected");
    await ctx.dispose();
  });

  test("SEC-UI-014 proof 4: the dev server log contains no cookie or session values after the login", async () => {
    const log = readFileSync(devServerLog(), "utf8");
    expect(log).not.toMatch(/set-cookie|cookie:/i);
    expect(log).not.toMatch(/mp_session|mp_csrf/);
    expect(log).not.toContain(adminPassword());
  });
});

test.describe("SEC-UI-014 proof 2: other origins get 403 directly from the backend (no proxy)", () => {
  for (const origin of ["http://evil.example", "http://localhost:5174"]) {
    test(`POST ${BACKEND_URL}/api/admin/auth/login with Origin ${origin} → 403 origin_rejected`, async () => {
      const ctx = await pwRequest.newContext({ baseURL: BACKEND_URL });
      const res = await ctx.post("/api/admin/auth/login", {
        headers: { ...json, origin },
        data: { email: ADMIN_EMAIL, password: adminPassword() },
      });
      expect(res.status()).toBe(403);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("origin_rejected");
      await ctx.dispose();
    });
  }
});

test.describe("SEC-UI-014 proof 3: frontend 1 is unaffected", () => {
  test("git reports no change in frontend/", () => {
    const changed = execFileSync("git", ["status", "--porcelain", "--", "../frontend"], { cwd: APP_DIR, encoding: "utf8" });
    expect(changed.trim()).toBe("");
  });

  test("frontend/'s dev proxy forwards Origin unchanged (5173 → backend), when its dev server is running", async () => {
    test.skip(!(await reachable(`${FRONTEND1_DEV_URL}/`)), "frontend/ dev server (5173) not running; start it to include this check");
    const ctx = await pwRequest.newContext({ baseURL: FRONTEND1_DEV_URL });
    const own = await ctx.post("/api/admin/auth/login", {
      headers: { ...json, origin: FRONTEND1_DEV_URL },
      data: { email: ADMIN_EMAIL, password: "definitely-wrong" },
    });
    expect(own.status()).toBe(401);
    // 5174's origin through 5173 is NOT rewritten there: the backend still rejects it.
    const other = await ctx.post("/api/admin/auth/login", {
      headers: { ...json, origin: DEV_URL },
      data: { email: ADMIN_EMAIL, password: "definitely-wrong" },
    });
    expect(other.status()).toBe(403);
    await ctx.dispose();
  });
});
