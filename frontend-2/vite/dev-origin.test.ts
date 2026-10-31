// @vitest-environment node
/**
 * UI-T-140 / SEC-UI-014 / UI-REV-029 / REQ-090: the pure Origin rewrite rule, its proxy wiring, and the resolved
 * Vite config for serve, preview and build (the rewrite exists only for the dev server; preview has no proxy).
 */
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { resolveConfig, type ResolvedConfig } from "vite";
import { describe, expect, it, vi } from "vitest";
import { createConfig, devProxy, isDevServe } from "../vite.config";
import { BACKEND_ORIGIN, devAdminOrigin, isAdminApiPath, wireDevOriginRewrite } from "./dev-origin";

const PATHS = ["/api/admin/auth/login", "/api/admin", "/api/public/site", "/api/administrator"];
const ORIGINS = ["http://localhost:5174", "http://127.0.0.1:5174", "http://evil.example", undefined];

describe("UI-T-140 devAdminOrigin (pure rule)", () => {
  for (const path of PATHS) {
    for (const origin of ORIGINS) {
      const rewritten = (path === "/api/admin/auth/login" || path === "/api/admin") && origin !== undefined && origin.endsWith(":5174");
      it(`${path} with ${origin ?? "no Origin"} → ${rewritten ? "rewritten" : "unchanged"}`, () => {
        expect(devAdminOrigin(path, origin)).toBe(rewritten ? BACKEND_ORIGIN : origin);
      });
    }
  }

  it("other ports, schemes and look-alikes are passed through unchanged", () => {
    for (const origin of ["http://localhost:5173", "https://localhost:5174", "http://localhost:51740", "http://localhost.evil:5174", "null"]) {
      expect(devAdminOrigin("/api/admin/settings", origin)).toBe(origin);
    }
  });

  it("isAdminApiPath ignores the query string and rejects prefixes of other paths", () => {
    expect(isAdminApiPath("/api/admin?x=1")).toBe(true);
    expect(isAdminApiPath("/api/admin/enquiries?page=2")).toBe(true);
    expect(isAdminApiPath("/api/administrator")).toBe(false);
    expect(isAdminApiPath("/media/api/admin")).toBe(false);
  });
});

describe("UI-T-140 proxy wiring (proxyReq hook)", () => {
  function emit(url: string, origin: string | string[] | undefined) {
    const proxy = new EventEmitter();
    wireDevOriginRewrite(proxy as unknown as Parameters<typeof wireDevOriginRewrite>[0]);
    const setHeader = vi.fn();
    proxy.emit("proxyReq", { setHeader }, { url, headers: { origin, cookie: "mp_session=secret-session; mp_csrf=secret-csrf" } });
    return setHeader;
  }

  it("sets only the Origin header, only for an admin path with a 5174 origin", () => {
    expect(emit("/api/admin/auth/login", "http://localhost:5174").mock.calls).toEqual([["origin", BACKEND_ORIGIN]]);
    expect(emit("/api/admin/auth/me", "http://127.0.0.1:5174").mock.calls).toEqual([["origin", BACKEND_ORIGIN]]);
    expect(emit("/api/admin/auth/login", "http://evil.example")).not.toHaveBeenCalled();
    expect(emit("/api/public/site", "http://localhost:5174")).not.toHaveBeenCalled();
    expect(emit("/api/admin/auth/login", undefined)).not.toHaveBeenCalled();
  });

  it("SEC-UI-014 proof 4: the hook logs nothing (no headers, no cookies)", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const out = vi.spyOn(process.stdout, "write");
    const err = vi.spyOn(process.stderr, "write");
    emit("/api/admin/auth/login", "http://localhost:5174");
    emit("/api/admin/auth/login", "http://evil.example");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    const written = [...out.mock.calls, ...err.mock.calls].map((c) => String(c[0])).join("");
    expect(written).not.toMatch(/cookie|mp_session|mp_csrf|secret-/i);
  });
});

describe("UI-T-140 / SEC-UI-014 proof 1: resolved Vite config for serve, preview and build", () => {
  const configFile = fileURLToPath(new URL("../vite.config.ts", import.meta.url));
  const resolve = (command: "serve" | "build", isPreview: boolean): Promise<ResolvedConfig> =>
    resolveConfig({ configFile, logLevel: "silent" }, command, "production", "production", isPreview);

  it("isDevServe is true only for `vite` serve", () => {
    expect(isDevServe({ command: "serve" })).toBe(true);
    expect(isDevServe({ command: "serve", isPreview: true })).toBe(false);
    expect(isDevServe({ command: "build" })).toBe(false);
  });

  it("serve: port 5174 strict on localhost, /api and /media proxied to 127.0.0.1:8000, Origin hook only on /api", async () => {
    const config = await resolve("serve", false);
    expect(config.server.host).toBe("localhost");
    expect(config.server.port).toBe(5174);
    expect(config.server.strictPort).toBe(true);
    expect(config.server.fs.strict).toBe(true);
    const proxy = config.server.proxy ?? {};
    expect(Object.keys(proxy).sort()).toEqual(["/api", "/media"]);
    const api = proxy["/api"] as { target: string; changeOrigin: boolean; configure?: unknown };
    const media = proxy["/media"] as { target: string; changeOrigin: boolean; configure?: unknown };
    expect(api.target).toBe("http://127.0.0.1:8000");
    expect(api.changeOrigin).toBe(false);
    expect(typeof api.configure).toBe("function");
    expect(media.target).toBe("http://127.0.0.1:8000");
    expect(media.configure).toBeUndefined();
  });

  it("preview: no proxy at all (so no Origin rewrite; a request keeps its Origin)", async () => {
    const config = await resolve("serve", true);
    expect(config.server.proxy).toBeUndefined();
    expect(config.preview.proxy).toBeUndefined();
    expect(config.preview.host).toBe("localhost");
  });

  it("build: no proxy, assets never inlined, no sourcemaps", async () => {
    const config = await resolve("build", false);
    expect(config.server.proxy).toBeUndefined();
    expect(config.build.assetsInlineLimit).toBe(0);
    expect(config.build.sourcemap).toBe(false);
  });

  it("createConfig only adds the proxy for dev serve", () => {
    expect(createConfig({ command: "serve" }).server?.proxy).toBeDefined();
    expect(createConfig({ command: "serve", isPreview: true }).server?.proxy).toBeUndefined();
    expect(createConfig({ command: "build" }).server?.proxy).toBeUndefined();
    expect(Object.keys(devProxy())).toEqual(["/api", "/media"]);
  });
});
