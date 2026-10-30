/**
 * Global setup (tester): migrate + seed the TEST database, create/reset the throwaway admin, start the
 * production-like preview (uvicorn, SERVE_FRONTEND=true, 127.0.0.1, --no-server-header) and build the site against it.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ADMIN_EMAIL,
  BACKEND_DIR,
  BASE_URL,
  PORT,
  adminPassword,
  backendCli,
  backendEnv,
  clearLimits,
  rebuildSite,
} from "./harness";

async function waitForHealth(timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("E2E: backend did not become healthy");
}

export default async function globalSetup(): Promise<void> {
  const runDir = mkdtempSync(join(tmpdir(), "mitali-e2e-"));
  const media = join(runDir, "media");
  mkdirSync(media);
  process.env.E2E_RUN_DIR = runDir;
  process.env.E2E_MEDIA_ROOT = media;
  adminPassword();

  // Fresh TEST schema (downgrade base + upgrade head re-creates the singleton rows), then the seed.
  // APP_ENV=development for the seed so the 4 sample enquiries exist.
  for (const args of [["downgrade", "base"], ["upgrade", "head"]]) {
    await new Promise<void>((resolveRun, reject) => {
      const p = spawn("python", ["-m", "uv", "run", "alembic", ...args], { cwd: BACKEND_DIR, env: backendEnv(), stdio: "ignore" });
      p.on("exit", (code) => (code === 0 ? resolveRun() : reject(new Error(`alembic ${args.join(" ")} failed (${code})`))));
    });
  }
  backendCli(["seed", "--reset"], { appEnv: "development", label: "seed --reset" });
  const pw = `${adminPassword()}\n`;
  try {
    backendCli(["create-admin", "--email", ADMIN_EMAIL, "--password-stdin"], { input: pw, label: "create-admin" });
  } catch {
    backendCli(["reset-password", "--password-stdin"], { input: pw, label: "reset-password" });
  }
  clearLimits();

  const logFile = join(runDir, "server.log");
  process.env.E2E_SERVER_LOG = logFile;
  const log = openSync(logFile, "w");
  const server = spawn(
    "python",
    ["-m", "uv", "run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(PORT), "--no-server-header", "--no-access-log"],
    { cwd: BACKEND_DIR, env: backendEnv("test"), stdio: ["ignore", log, log], detached: process.platform !== "win32" },
  );
  process.env.E2E_SERVER_PID = String(server.pid);
  writeFileSync(join(runDir, "server.pid"), String(server.pid));
  await waitForHealth(90_000);
  rebuildSite();
}
