/** Global teardown (tester): stop the dev server and (when started here) the backend; remove the temp folder. */
import { rmSync } from "node:fs";
import { killTree } from "./harness";

export default async function globalTeardown(): Promise<void> {
  for (const key of ["E2E_DEV_PID", "E2E_SERVER_PID"]) {
    const pid = Number(process.env[key]);
    if (pid) killTree(pid);
  }
  await new Promise((r) => setTimeout(r, 1500));
  const runDir = process.env.E2E_RUN_DIR;
  if (runDir && process.env.E2E_KEEP_RUN_DIR !== "1") rmSync(runDir, { recursive: true, force: true });
}
