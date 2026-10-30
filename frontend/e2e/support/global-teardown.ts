/** Global teardown (tester): stop the preview server and remove the temp media folder. */
import { rmSync } from "node:fs";
import { killTree } from "./harness";

export default async function globalTeardown(): Promise<void> {
  const pid = Number(process.env.E2E_SERVER_PID);
  if (pid) killTree(pid);
  await new Promise((r) => setTimeout(r, 1500));
  const runDir = process.env.E2E_RUN_DIR;
  if (runDir && process.env.E2E_KEEP_SERVER !== "1") rmSync(runDir, { recursive: true, force: true });
}
