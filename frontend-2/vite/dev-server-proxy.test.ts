// @vitest-environment node
/**
 * SEC-UI-014 required proof 4 (+ UI-T-140 end to end, without the real backend): a real Vite dev server built from
 * this project's config proxies to a local STUB backend (random port; no database, no real API). During an admin
 * login through the dev server with the 5174 Origin and session cookies, the dev server's console output (console.*
 * and stdout/stderr) contains no Cookie, Set-Cookie, mp_session or mp_csrf values; the stub receives the rewritten
 * Origin for the 5174 origin and the untouched Origin for a foreign one; cookies and Host pass through unchanged.
 * The real backend checks (foreign origin → 403 directly from the backend) are E2E: e2e/sec-ui-014.e2e.ts.
 */
import { createServer as createHttpServer, request, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createConfig } from "../vite.config";
import { BACKEND_ORIGIN } from "./dev-origin";

const SESSION = "stub-session-value-123";
const CSRF = "stub-csrf-value-456";

let stub: Server;
let vite: ViteDevServer;
let vitePort = 0;
const received: IncomingHttpHeaders[] = [];
const captured: string[] = [];

function capture() {
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      captured.push(args.map(String).join(" "));
    });
  }
  const wrap = (stream: NodeJS.WriteStream) => {
    const original = stream.write.bind(stream);
    vi.spyOn(stream, "write").mockImplementation(((chunk: unknown, ...rest: unknown[]) => {
      captured.push(String(chunk));
      return original(chunk as string, ...(rest as []));
    }) as typeof stream.write);
  };
  wrap(process.stdout);
  wrap(process.stderr);
}

function send(path: string, headers: Record<string, string>): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: vitePort, path, method: "POST", headers }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on("error", reject);
    req.end(JSON.stringify({ email: "e2e-admin@example.com", password: "not-a-real-password" }));
  });
}

beforeAll(async () => {
  stub = createHttpServer((req, res) => {
    received.push(req.headers);
    req.resume();
    req.on("end", () => {
      res.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": [`mp_session=${SESSION}; HttpOnly; Path=/; SameSite=Strict`, `mp_csrf=${CSRF}; Path=/; SameSite=Strict`],
      });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => stub.listen(0, "127.0.0.1", resolve));
  const stubPort = (stub.address() as AddressInfo).port;

  capture();
  const base = createConfig({ command: "serve" }, { backendTarget: `http://127.0.0.1:${stubPort}` });
  vite = await createServer({
    ...base,
    configFile: false,
    logLevel: "info",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { ...base.server, host: "127.0.0.1", port: 0, strictPort: false, watch: { ignored: ["**/*"] } },
  });
  await vite.listen();
  vitePort = (vite.httpServer?.address() as AddressInfo).port;
}, 60_000);

afterAll(async () => {
  await vite?.close();
  await new Promise<void>((resolve) => stub?.close(() => resolve()));
  vi.restoreAllMocks();
});

describe("SEC-UI-014 dev server proxy against a stub backend", () => {
  it("admin login with the 5174 Origin: Origin rewritten, cookies and Host passed through, nothing logged", async () => {
    received.length = 0;
    captured.length = 0;
    const res = await send("/api/admin/auth/login", {
      "content-type": "application/json",
      origin: "http://localhost:5174",
      host: "localhost:5174",
      cookie: `mp_session=${SESSION}; mp_csrf=${CSRF}`,
      "x-csrf-token": CSRF,
    });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.join(";")).toContain("mp_session=");
    expect(received).toHaveLength(1);
    expect(received[0]?.origin).toBe(BACKEND_ORIGIN);
    expect(received[0]?.host).toBe("localhost:5174");
    expect(received[0]?.cookie).toBe(`mp_session=${SESSION}; mp_csrf=${CSRF}`);
    expect(received[0]?.["x-csrf-token"]).toBe(CSRF);

    const output = captured.join("\n");
    expect(output).not.toMatch(/cookie/i);
    expect(output).not.toMatch(/mp_session|mp_csrf/);
    expect(output).not.toContain(SESSION);
    expect(output).not.toContain(CSRF);
  });

  it("a foreign Origin and a public path keep their Origin (the backend still rejects foreign origins)", async () => {
    received.length = 0;
    await send("/api/admin/auth/login", { "content-type": "application/json", origin: "http://evil.example" });
    await send("/api/public/enquiries", { "content-type": "application/json", origin: "http://localhost:5174" });
    expect(received.map((h) => h.origin)).toEqual(["http://evil.example", "http://localhost:5174"]);
    expect(captured.join("\n")).not.toMatch(/mp_session|mp_csrf/);
  });
});
