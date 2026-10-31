// @vitest-environment node
/**
 * SEC-UI-014 required proof 1 (build side) and UI-T-132 / UI-T-140 dist scans:
 * the scanner catches planted dev-only code, and — when a build exists — `dist/` and `dist-ssr/` contain neither
 * the Origin rewrite nor the P1 review aids, and the HTML has no inline script or style.
 * `npm run build` also runs `check:dist`, so a fresh build is always scanned.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkDist, scanHtml, scanText } from "./check-dist";

const APP = process.cwd();
const built = existsSync(join(APP, "dist")) && existsSync(join(APP, "dist-ssr"));

describe("check-dist scanner (planted fixtures)", () => {
  it("finds every dev-only Origin rewrite marker", () => {
    const planted = 'function devAdminOrigin(p,o){return o==="http://localhost:5174"?"http://127.0.0.1:8000":o}proxy.on("proxyReq",f)';
    const messages = scanText("x.js", planted).map((f) => f.message);
    expect(messages.some((m) => m.includes("devAdminOrigin"))).toBe(true);
    expect(messages.some((m) => m.includes("localhost:5174"))).toBe(true);
    expect(messages.some((m) => m.includes("proxyReq"))).toBe(true);
    expect(scanText("x.js", 'headers:{origin:"http://127.0.0.1:8000"}').map((f) => f.message)).toEqual([
      "Origin literal for http://127.0.0.1:8000 (SEC-UI-014)",
    ]);
  });

  it("finds the P1 review aids", () => {
    const messages = scanText("x.js", 'document.documentElement.dataset.base="white";el.setAttribute("data-base","white");path:"__review/type"').map(
      (f) => f.message,
    );
    expect(messages.some((m) => m.includes("data-base"))).toBe(true);
    expect(messages.some((m) => m.includes("__review"))).toBe(true);
  });

  it("HTML: inline scripts and style/on* attributes are reported; JSON data blocks and module scripts are fine", () => {
    expect(scanHtml("a.html", '<script type="module" src="/assets/a.js"></script><script type="application/json" id="__ROUTER_DATA__">{}</script>')).toEqual([]);
    expect(scanHtml("a.html", "<script>alert(1)</script>")).toHaveLength(1);
    expect(scanHtml("a.html", '<div style="color:red" onclick="x()"></div>')).toHaveLength(2);
  });

  it("a planted build with rewrite code fails the scan", () => {
    const app = mkdtempSync(join(tmpdir(), "f2-dist-"));
    try {
      mkdirSync(join(app, "dist", "assets"), { recursive: true });
      mkdirSync(join(app, "dist-ssr"), { recursive: true });
      writeFileSync(join(app, "dist", "assets", "a.js"), "export const x=1;");
      writeFileSync(join(app, "dist-ssr", "entry-server.js"), "export function wireDevOriginRewrite(){}");
      const findings = checkDist(app).map((f) => `${f.file}: ${f.message}`);
      expect(findings.some((f) => f.startsWith("dist-ssr/entry-server.js") && f.includes("wireDevOriginRewrite"))).toBe(true);
      expect(findings.some((f) => f.includes("dist/fonts missing") || f.includes("font"))).toBe(true);
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!built)("SEC-UI-014 proof 1 / UI-T-132: the real build output (dist and dist-ssr)", () => {
  it("contains no Origin rewrite, no P1 review aids, CSP-safe HTML and exactly the shipped fonts with licences", () => {
    expect(checkDist(APP)).toEqual([]);
  });
});
