/**
 * E2E harness (tester, TS-019 step 4). Production-like preview on the TEST database only:
 * - DATABASE_URL for every backend process = TEST_DATABASE_URL from backend/.env (read here, never printed);
 * - MEDIA_ROOT = a temp folder created by global setup; SERVE_FRONTEND=true; uvicorn on 127.0.0.1:8000;
 * - a throwaway admin (e2e-admin@example.com) whose random password lives only in this process tree's env.
 */
import { execFileSync, spawnSync, type SpawnSyncOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const FRONTEND_DIR = resolve(import.meta.dirname, "..", "..");
export const BACKEND_DIR = resolve(FRONTEND_DIR, "..", "backend");
export const PORT = 8000;
export const BASE_URL = `http://127.0.0.1:${PORT}`;
export const ADMIN_EMAIL = "e2e-admin@example.com";

function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    let value = m[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1] as string] = value;
  }
  return out;
}

export function testDatabaseUrl(): string {
  const url = readEnvFile(join(BACKEND_DIR, ".env")).TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("E2E: TEST_DATABASE_URL missing in backend/.env");
  const dbName = url.split("?")[0]?.split("/").pop() ?? "";
  if (!dbName.endsWith("_test")) throw new Error("E2E: TEST_DATABASE_URL must point at a *_test database");
  return url;
}

/** Shared between the runner and its workers (process.env is inherited). */
export function adminPassword(): string {
  process.env.E2E_ADMIN_PASSWORD ??= `e2e-${randomBytes(18).toString("base64url")}`;
  return process.env.E2E_ADMIN_PASSWORD;
}

export function mediaRoot(): string {
  const dir = process.env.E2E_MEDIA_ROOT;
  if (!dir) throw new Error("E2E: E2E_MEDIA_ROOT not set (global setup not run)");
  return dir;
}

/** Environment for every backend process (server and CLI). */
export function backendEnv(appEnv: "test" | "development" = "test"): NodeJS.ProcessEnv {
  return {
    ...process.env,
    APP_ENV: appEnv,
    DATABASE_URL: testDatabaseUrl(),
    MEDIA_ROOT: mediaRoot(),
    SERVE_FRONTEND: "true",
    PYTHONUTF8: "1",
  };
}

function run(cmd: string, args: string[], opts: SpawnSyncOptions & { label: string }): string {
  const res = spawnSync(cmd, args, { encoding: "utf8", shell: false, ...opts });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  if (res.status !== 0) {
    throw new Error(`E2E: ${opts.label} failed (exit ${res.status}):\n${out.slice(-3000)}`);
  }
  return out;
}

export function backendCli(args: string[], opts: { input?: string; appEnv?: "test" | "development"; label: string }): string {
  return run("python", ["-m", "uv", "run", "python", "-m", "app.cli", ...args], {
    cwd: BACKEND_DIR,
    env: backendEnv(opts.appEnv),
    input: opts.input,
    label: opts.label,
    timeout: 300_000,
  });
}

function dbTool(action: "clear-limits"): void {
  run("python", ["-m", "uv", "run", "python", "../frontend/e2e/support/db_tools.py", action], {
    cwd: BACKEND_DIR,
    env: backendEnv(),
    label: `db_tools ${action}`,
    timeout: 120_000,
  });
}

export function clearLimits(): void {
  dbTool("clear-limits");
}

/** The real publishing command (REQ-052): `npm run build:site` against the running preview API. */
export function rebuildSite(): string {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return run(npm, ["run", "build:site"], {
    cwd: FRONTEND_DIR,
    env: { ...process.env, API_BASE_URL: BASE_URL, VITE_SITE_URL: BASE_URL },
    label: "npm run build:site",
    timeout: 600_000,
    shell: process.platform === "win32",
  });
}

export function killTree(pid: number): void {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}
