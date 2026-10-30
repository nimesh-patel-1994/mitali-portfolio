/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const backend = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": srcDir },
  },
  server: {
    // SEC-UI-012: bind to localhost only (never 0.0.0.0), keep fs.strict, proxy only to the local backend.
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: backend, changeOrigin: false },
      "/media": { target: backend, changeOrigin: false },
    },
  },
  preview: {
    host: "localhost",
  },
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
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
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    css: {
      include: [/.+/],
      modules: { classNameStrategy: "non-scoped" },
    },
    restoreMocks: true,
    // Slowest test is ~2.5 s locally (admin tests use no retry delay and paste for fields not under test);
    // 10 s leaves headroom for parallel coverage runs on a loaded machine.
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      exclude: ["src/api/schema.d.ts", "src/test/**", "**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      reporter: ["text-summary", "text"],
    },
  },
});
