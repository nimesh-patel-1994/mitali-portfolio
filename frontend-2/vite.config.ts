/// <reference types="vitest/config" />
/**
 * Vite config for frontend-2 (TS-020, TS-027, SEC-UI-012 via SEC-UI-013, SEC-UI-014).
 * - Dev server: `localhost:5174`, strictPort, default `allowedHosts`, `fs.strict`; proxies `/api` and `/media` to the
 *   backend at http://127.0.0.1:8000 with `changeOrigin: false` (Host stays `localhost:5174`).
 * - The dev-only Origin rewrite (vite/dev-origin.ts) is wired on the `/api` proxy ONLY for `vite` serve, never for
 *   `vite preview` or a build. Preview gets no proxy at all (so it cannot inherit `server.proxy` either).
 */
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type ProxyOptions, type UserConfig } from "vite";
import { wireDevOriginRewrite } from "./vite/dev-origin.ts";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
export const BACKEND_TARGET = "http://127.0.0.1:8000";
export const DEV_PORT = 5174;

export interface ConfigEnvLike {
  command: "serve" | "build";
  isPreview?: boolean;
}

export interface ConfigOverrides {
  /** Backend target for tests (a local stub server); defaults to the real backend. */
  backendTarget?: string;
}

/** True only for the dev server (`vite` / `npm run dev`). */
export function isDevServe(env: ConfigEnvLike): boolean {
  return env.command === "serve" && env.isPreview !== true;
}

/** Dev proxy entries; the Origin rewrite is attached to `/api` only. */
export function devProxy(target = BACKEND_TARGET): Record<string, ProxyOptions> {
  return {
    "/api": { target, changeOrigin: false, configure: (proxy) => wireDevOriginRewrite(proxy) },
    "/media": { target, changeOrigin: false },
  };
}

export function createConfig(env: ConfigEnvLike, overrides: ConfigOverrides = {}): UserConfig {
  const devServe = isDevServe(env);
  return {
    plugins: [react()],
    resolve: { alias: { "@": srcDir } },
    server: {
      // SEC-UI-012: bind to localhost only (never 0.0.0.0), keep fs.strict and the default allowedHosts.
      host: "localhost",
      port: DEV_PORT,
      strictPort: true,
      fs: { strict: true },
      ...(devServe ? { proxy: devProxy(overrides.backendTarget) } : {}),
    },
    preview: {
      host: "localhost",
    },
    css: {
      modules: { localsConvention: "camelCaseOnly" },
    },
    build: {
      // SEC-UI-003: nothing inlined as data: URLs (font-src/script-src 'self').
      assetsInlineLimit: 0,
      sourcemap: false,
      manifest: true,
      modulePreload: { polyfill: true },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts", "vite/**/*.test.ts"],
      css: {
        include: [/.+/],
        modules: { classNameStrategy: "stable" }, // unique per file, like the build (no cross-module collisions)
      },
      restoreMocks: true,
      testTimeout: 20_000,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "vite/**/*.ts"],
        exclude: ["src/api/schema.d.ts", "src/test/**", "**/*.test.{ts,tsx}", "src/**/*.d.ts"],
        reporter: ["text-summary", "text"],
      },
    },
  };
}

export default defineConfig(({ command, isPreview }) => createConfig({ command, isPreview }));
