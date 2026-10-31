import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Vitest runs from the frontend directory (jsdom gives import.meta.url a non-file scheme). */
export const FRONTEND_DIR = process.cwd();
export const SRC_DIR = resolve(FRONTEND_DIR, "src");
export const REPO_DIR = resolve(FRONTEND_DIR, "..");

export function readRepoFile(...segments: string[]): string {
  return readFileSync(resolve(REPO_DIR, ...segments), "utf8");
}
