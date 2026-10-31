/**
 * E2E harness for frontend-2, PH-2 (TS-033 step 2, SD-117, REQ-NFR-013). WRITTEN BY THE BUILDER, RUN BY THE
 * ORCHESTRATOR/TESTER ONLY, after telling the user which database is used.
 * - Backend: FastAPI on 127.0.0.1:8000 connected to the seeded TEST database `mitali_portfolio_test` only. The URL
 *   comes from the TEST_DATABASE_URL process variable, or (as frontend/'s harness does) from backend/.env; it is never
 *   printed, and any database whose name does not end in `_test` is refused.
 * - frontend-2: its own Vite dev server on http://localhost:5174 (dev proxy + dev-only Origin rewrite), started by
 *   global setup with its console output written to a log file (read by the SEC-UI-014 proof 4 test).
 * - E2E_EXTERNAL_BACKEND=1: reuse a backend the orchestrator already started on the test database.
 * - A throwaway admin (e2e-admin@example.com) gets a random password held only in this process tree's env.
 */
import { execFileSync, spawnSync, type SpawnSyncOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const APP_DIR = resolve(import.meta.dirname, "..", "..");
export const BACKEND_DIR = resolve(APP_DIR, "..", "backend");
export const BACKEND_URL = "http://127.0.0.1:8000";
export const DEV_URL = "http://localhost:5174";
/** frontend/'s dev server, used read-only by the parity and "frontend 1 unaffected" checks when it is running. */
export const FRONTEND1_DEV_URL = "http://localhost:5173";
export const ADMIN_EMAIL = "e2e-admin@example.com";
export const CASE_STUDY_PATH = "/work/verdant-loop";

function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    let value = m[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[m[1] as string] = value;
  }
  return out;
}

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? readEnvFile(join(BACKEND_DIR, ".env")).TEST_DATABASE_URL;
  if (!url) throw new Error("E2E: TEST_DATABASE_URL is not set");
  const dbName = url.split("?")[0]?.split("/").pop() ?? "";
  if (!dbName.endsWith("_test")) throw new Error("E2E: TEST_DATABASE_URL must point at a *_test database (REQ-NFR-013)");
  return url;
}

export function adminPassword(): string {
  process.env.E2E_ADMIN_PASSWORD ??= `e2e-${randomBytes(18).toString("base64url")}`;
  return process.env.E2E_ADMIN_PASSWORD;
}

export function backendEnv(appEnv: "test" | "development" = "test"): NodeJS.ProcessEnv {
  return {
    ...process.env,
    APP_ENV: appEnv,
    DATABASE_URL: testDatabaseUrl(),
    MEDIA_ROOT: process.env.E2E_MEDIA_ROOT ?? "",
    SERVE_FRONTEND: "false",
  };
}

export function backendCli(args: string[], opts: { input?: string; appEnv?: "test" | "development"; label: string }): void {
  const options: SpawnSyncOptions = { cwd: BACKEND_DIR, env: backendEnv(opts.appEnv), input: opts.input, stdio: ["pipe", "ignore", "pipe"] };
  const result = spawnSync("python", ["-m", "uv", "run", "python", "-m", "app.cli", ...args], options);
  if (result.status !== 0) throw new Error(`E2E: backend ${opts.label} failed (${result.status})`);
}

export function killTree(pid: number): void {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid);
  } catch {
    /* already gone */
  }
}

export async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`E2E: ${url} did not come up`);
}

export async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/** Log file of the frontend-2 dev server started by global setup. */
export function devServerLog(): string {
  return process.env.E2E_DEV_LOG ?? join(process.env.E2E_RUN_DIR ?? APP_DIR, "dev-server.log");
}
