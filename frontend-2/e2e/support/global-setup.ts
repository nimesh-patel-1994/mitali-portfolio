/**
 * Global setup (tester, PH-2): migrate + seed the TEST database, create/reset the throwaway admin, start the backend
 * on 127.0.0.1:8000 (unless E2E_EXTERNAL_BACKEND=1) and start the frontend-2 dev server on localhost:5174 with its
 * output captured to a log file (SEC-UI-014 proof 4). Never touches the development database.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ADMIN_EMAIL,
  APP_DIR,
  BACKEND_DIR,
  BACKEND_URL,
  DEV_URL,
  adminPassword,
  backendCli,
  backendEnv,
  devServerLog,
  waitFor,
} from "./harness";

export default async function globalSetup(): Promise<void> {
  const runDir = mkdtempSync(join(tmpdir(), "mitali-f2-e2e-"));
  const media = join(runDir, "media");
  mkdirSync(media);
  process.env.E2E_RUN_DIR = runDir;
  process.env.E2E_MEDIA_ROOT = media;
  process.env.E2E_DEV_LOG = join(runDir, "dev-server.log");
  adminPassword();

  if (process.env.E2E_EXTERNAL_BACKEND !== "1") {
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
    const backendLog = openSync(join(runDir, "backend.log"), "w");
    const server = spawn(
      "python",
      ["-m", "uv", "run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--no-server-header"],
      { cwd: BACKEND_DIR, env: backendEnv(), stdio: ["ignore", backendLog, backendLog] },
    );
    process.env.E2E_SERVER_PID = String(server.pid);
  }
  await waitFor(`${BACKEND_URL}/api/health`, 60_000);

  const devLog = openSync(devServerLog(), "w");
  const dev = spawn("npm", ["run", "dev"], { cwd: APP_DIR, shell: true, env: { ...process.env }, stdio: ["ignore", devLog, devLog] });
  process.env.E2E_DEV_PID = String(dev.pid);
  await waitFor(`${DEV_URL}/`, 120_000);
}
