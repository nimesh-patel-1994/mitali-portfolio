/**
 * Public journeys (ui-scope 6.1): UI-T-103, 104 (unknown URL), 105, 106, 107 (compact header), 108, 109, 112, 121,
 * plus security checks SEC-006 / SEC-010 / SEC-UI-002 / SEC-UI-003 / SEC-UI-010 on the production-like preview.
 */
import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL, FRONTEND_DIR } from "./support/harness";
import { HEIGHT_FOR, PUBLIC_PATHS, WIDTHS, axeCheck, noHorizontalScroll } from "./support/helpers";

test.describe("UI-T-103 public pages at 360/810/1440: header, footer, one h1, no horizontal scroll, axe", () => {
  for (const width of WIDTHS) {
    for (const [name, path] of Object.entries(PUBLIC_PATHS)) {
      test(`UI-T-103 ${name} @${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: HEIGHT_FOR[width] ?? 900 });
        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        await expect(page.locator("header").first()).toBeVisible();
        await expect(page.locator("footer").first()).toBeAttached();
        await expect(page.locator("h1")).toHaveCount(1);
        const { scrollWidth, innerWidth, scrollX } = await noHorizontalScroll(page);
        // Literal UI-T-103 metric (soft, recorded) and the user-visible behaviour (page cannot be scrolled sideways).
        expect.soft(scrollWidth, `UI-T-103 scrollWidth > innerWidth on ${path} at ${width}px`).toBeLessThanOrEqual(innerWidth);
        expect(scrollX, `page scrolls horizontally on ${path} at ${width}px`).toBe(0);
        await axeCheck(page, name, width, testInfo);
      });
    }
  }

  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`UI-T-103 / REQ-010 hero actions above the fold @${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto("/");
      const hero = page.locator("main section").first();
      for (const name of ["Book a call", "View work"]) {
        const action = hero.getByRole("link", { name: new RegExp(`^${name}`) });
        await expect(action).toBeInViewport({ ratio: 1 });
      }
    });
  }

  test("UI-T-103 / REQ-NFR-001 no horizontal scroll at 390 and 1920", async ({ page }) => {
    for (const width of [390, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of Object.values(PUBLIC_PATHS)) {
        await page.goto(path);
        const { scrollWidth, innerWidth, scrollX } = await noHorizontalScroll(page);
        expect.soft(scrollWidth, `UI-T-103 scrollWidth > innerWidth on ${path} at ${width}`).toBeLessThanOrEqual(innerWidth);
        expect(scrollX, `${path} scrolls sideways at ${width}`).toBe(0);
      }
    }
  });
});

test("UI-T-104 unknown URL returns 404 with the not-found page", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await expect(page).toHaveTitle("Page not found — Mitali");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const unknownCase = await page.request.get("/work/no-such-case-study");
  expect(unknownCase.status()).toBe(404);
  const unknownSample = await page.request.get("/writing/no-such-sample");
  expect(unknownSample.status()).toBe(404);
});

test.describe("UI-T-105 JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false });

  test("UI-T-105 case study HTML has content and head tags before JS", async ({ page, request }) => {
    const html = await (await request.get(PUBLIC_PATHS.caseStudy)).text();
    expect(html).toContain("A waitlist that grew before the first pot shipped");
    expect(html).toMatch(/<title>[^<]*A waitlist that grew[^<]*<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]+"/);
    expect(html).toMatch(/<link rel="canonical" href="http:\/\/127\.0\.0\.1:8000\/work\/verdant-loop"/);
    expect(html).toMatch(/<meta property="og:image" content="http:\/\/127\.0\.0\.1:8000\/media\/[^"]+"/);
    expect(html).toMatch(/<meta property="og:title"/);
    expect(html).toMatch(/<meta property="og:description"/);
    await page.goto(PUBLIC_PATHS.caseStudy);
    await expect(page.locator("h1")).toContainText("A waitlist that grew");
  });

  test("UI-T-105 / REQ-030 writing filter is an enhancement: all samples listed without JS", async ({ page }) => {
    await page.goto("/writing?format=email");
    const cards = page.locator("main").getByRole("listitem").filter({ has: page.locator('a[href^="/writing/"]') });
    await expect(cards).toHaveCount(12);
  });

  test("REQ-050 every static page has a unique title, description, canonical and og tags", async ({ request }) => {
    const titles = new Set<string>();
    for (const path of Object.values(PUBLIC_PATHS)) {
      const html = await (await request.get(path)).text();
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
      expect(title, path).not.toBe("");
      titles.add(title);
      expect(html, path).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html, path).toMatch(/<link rel="canonical" href="http:\/\/127\.0\.0\.1:8000[^"]*"/);
      expect(html, path).toMatch(/<meta property="og:image" content="http[^"]+"/);
      expect(html, path).toContain("<h1");
    }
    expect(titles.size).toBe(Object.keys(PUBLIC_PATHS).length);
  });
});

test("UI-T-106 mobile menu at 390: focus inside, Escape returns focus, choosing About navigates and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Menu", exact: true });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    expect(inside, `focus left the dialog after ${i + 1} Tab presses`).toBe(true);
  }
  for (const name of ["Work", "Writing", "About", "Contact", "FAQs"]) {
    await expect(dialog.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole("link", { name: /^Book a call/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(menuButton).toBeFocused();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");

  await menuButton.click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  await expect(page.locator("h1")).toBeVisible();
});

test("UI-T-107 (part) header compact after scrolling past the hero; nav aria-current", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const header = page.locator("header").first();
  await expect(header).not.toHaveAttribute("data-compact", "true");
  await page.mouse.wheel(0, 1200);
  await expect(header).toHaveAttribute("data-compact", "true");
  await page.goto("/work/verdant-loop");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Work" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // REQ-002: booking URL "#" in the seed → Book a call goes to Contact.
  await expect(header.getByRole("link", { name: /^Book a call/ })).toHaveAttribute("href", "/contact");
});

test("UI-T-108 writing filter: click Email, reload, Back", async ({ page }) => {
  await page.goto("/writing");
  const filter = page.getByRole("navigation", { name: "Filter by format" });
  await expect(filter.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", /.+/);
  await filter.getByRole("link", { name: "Email" }).click();
  await expect(page).toHaveURL(/\/writing\?format=email$/);
  const cards = page.locator('main a[href^="/writing/"]');
  await expect(cards).toHaveCount(2);
  await expect(page.locator("main")).toContainText("Showing 2 email samples");
  await page.reload();
  await expect(filter.getByRole("link", { name: "Email" })).toHaveAttribute("aria-current", /.+/);
  await expect(cards).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/\/writing$/);
  await expect(filter.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", /.+/);
  await expect(cards).toHaveCount(12);
});

test("UI-T-109 keyboard only: services accordion, FAQs accordion, testimonial carousel (wraps, no autoplay)", async ({ page }) => {
  await page.goto("/");
  // Services accordion: reach the first service button with Tab only.
  const services = page.locator("section").filter({ has: page.getByRole("heading", { name: "What I do" }) });
  const firstService = services.locator("button[aria-expanded]").first();
  await expect(firstService).toHaveAttribute("aria-expanded", "false");
  let reached = false;
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await firstService.evaluate((el) => el === document.activeElement);
  }
  expect(reached, "services accordion reachable by Tab").toBe(true);
  await page.keyboard.press("Enter");
  await expect(firstService).toHaveAttribute("aria-expanded", "true");
  const panelId = await firstService.getAttribute("aria-controls");
  await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(firstService).toHaveAttribute("aria-expanded", "false");

  // Carousel: 5 testimonials; Next from the last wraps; no autoplay.
  const carousel = page.locator('[aria-roledescription="carousel"]');
  const next = carousel.getByRole("button", { name: "Next testimonial" });
  const indicators = carousel.getByRole("button", { name: /^Show testimonial/ });
  await expect(indicators).toHaveCount(5);
  await next.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Enter");
  await expect(indicators.nth(4)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Space");
  await expect(indicators.nth(0)).toHaveAttribute("aria-current", "true");
  const live = carousel.locator('[aria-live="polite"]');
  await expect(live).not.toBeEmpty();
  await carousel.getByRole("button", { name: "Previous testimonial" }).focus();
  await page.keyboard.press("Enter");
  await expect(indicators.nth(4)).toHaveAttribute("aria-current", "true");
  await page.waitForTimeout(10_500);
  await expect(indicators.nth(4)).toHaveAttribute("aria-current", "true");

  // FAQs page accordion.
  await page.goto("/faqs");
  // 4 category groups (h2) followed by the CTA band's own h2.
  const groupHeadings = page.locator("main h2");
  await expect(groupHeadings).toHaveCount(5);
  const faqButtons = page.locator("main button[aria-expanded]");
  await expect(faqButtons).toHaveCount(16);
  for (let i = 0; i < 16; i++) await expect(faqButtons.nth(i)).toHaveAttribute("aria-expanded", "false");
  await faqButtons.nth(0).focus();
  await page.keyboard.press("Space");
  await expect(faqButtons.nth(0)).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(faqButtons.nth(0)).toHaveAttribute("aria-expanded", "false");
});

test("UI-T-112 reduced motion: no glow animation, no transitions, reveal content visible", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/");
  const report = await page.evaluate(() => {
    const animated: string[] = [];
    const transitioned: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const cs = getComputedStyle(el);
      if (cs.animationName !== "none" && cs.animationName !== "") animated.push(`${el.tagName}.${el.className}`);
      const durations = cs.transitionDuration.split(",").map((d) => parseFloat(d));
      if (durations.some((d) => d > 0)) transitioned.push(`${el.tagName}.${el.className} ${cs.transitionProperty}`);
    }
    const hidden = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      (el) => parseFloat(getComputedStyle(el).opacity) < 1,
    ).length;
    return { animated, transitioned, hidden, reveals: document.querySelectorAll("[data-reveal]").length };
  });
  expect(report.animated, "elements still animated under reduced motion").toEqual([]);
  expect(report.transitioned, "elements with transitions under reduced motion").toEqual([]);
  expect(report.hidden, "reveal content hidden under reduced motion").toBe(0);
  // Interactions still work without motion.
  const svc = page.locator("section").filter({ has: page.getByRole("heading", { name: "What I do" }) }).locator("button[aria-expanded]").first();
  await svc.click();
  await expect(svc).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Next testimonial" }).click();
  await expect(page.getByRole("button", { name: "Show testimonial 2 of 5" })).toHaveAttribute("aria-current", "true");
  await context.close();
});

test("UI-T-121 sitemap, robots, admin noindex", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? "");
  expect(locs.filter((l) => /\/work\/[^/]+$/.test(l))).toHaveLength(6);
  expect(locs.filter((l) => /\/writing\/[^/]+$/.test(l))).toHaveLength(12);
  expect(locs).toHaveLength(24);
  expect(locs.some((l) => l.includes("/admin"))).toBe(false);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow:\s*\/admin/);
  const admin = await request.get("/admin/login");
  expect(admin.status()).toBe(200);
  const html = await admin.text();
  expect(html).toMatch(/<meta name="robots" content="noindex, ?nofollow"/);
  expect(admin.headers()["x-robots-tag"] ?? "").toMatch(/noindex/);
});

test("SEC-006 / SEC-UI-010 every request while loading public pages and the admin login stays same-origin; SEC-010 no CSP violations", async ({ page }) => {
  const foreign: string[] = [];
  const cspErrors: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(BASE_URL) && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
  });
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) cspErrors.push(msg.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`Refused to load (CSP violation): ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  for (const path of [...Object.values(PUBLIC_PATHS), "/does-not-exist", "/admin/login"]) {
    const before = cspErrors.length;
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (let i = before; i < cspErrors.length; i++) cspErrors[i] = `${path}: ${cspErrors[i]}`;
  }
  expect(foreign).toEqual([]);
  expect(cspErrors).toEqual([]);
});

test("SEC-006 /docs, /redoc and /openapi.json are 404 with APP_ENV=test; no Server header", async ({ request }) => {
  for (const path of ["/docs", "/redoc", "/openapi.json"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }
  const res = await request.get("/");
  expect(res.headers().server).toBeUndefined();
  expect(res.headers()["content-security-policy"] ?? "").toContain("default-src");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});

test("SEC-UI-002 / SEC-UI-003 dist scan: no inline executable scripts; bundle origins limited", async () => {
  const dist = join(FRONTEND_DIR, "dist");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dist);
  const problems: string[] = [];
  for (const f of files.filter((x) => x.endsWith(".html"))) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
      const attrs = m[1] ?? "";
      if (!/\bsrc=/.test(attrs) && !/type="application\/json"/.test(attrs)) problems.push(`${f}: inline <script${attrs}>`);
    }
    if (html.includes("__staticRouterHydrationData")) problems.push(`${f}: __staticRouterHydrationData`);
  }
  for (const f of files.filter((x) => /[\\/]assets[\\/].*\.js$/.test(x))) {
    const js = readFileSync(f, "utf8");
    for (const m of js.matchAll(/https?:\/\/[A-Za-z0-9.-]+/g)) {
      const origin = m[0];
      // Allowed: site origin, seed example.com, XML/SVG/JSON-schema namespace URIs. Library doc links found in error
      // strings (reactrouter.com, github.com) are recorded as observations, not requests.
      if (/127\.0\.0\.1|localhost|example\.com|www\.w3\.org|json-schema\.org|^https?:\/\/\.$/.test(origin)) continue;
      if (/reactrouter\.com|github\.com|react\.dev|reactjs\.org/.test(origin)) {
        console.log(`SEC-UI-003 observation: library doc URL string in ${f}: ${origin}`);
        continue;
      }
      problems.push(`${f}: ${origin}`);
    }
    if (f.endsWith(".map")) problems.push(`${f}: source map published`);
  }
  expect(problems).toEqual([]);
});

test("F1 (run 2) built site served compressed: main JS and HTML with Content-Encoding br/gzip; /api and /media not compressed", async ({ page }) => {
  const encodings: Record<string, string> = {};
  page.on("response", async (res) => {
    const url = res.url().replace(BASE_URL, "");
    if (/^\/assets\/.*\.(js|css)$/.test(url) || url === "/work") encodings[url] = (await res.allHeaders())["content-encoding"] ?? "";
  });
  await page.goto("/work");
  await page.waitForLoadState("networkidle");
  const js = Object.entries(encodings).filter(([u]) => u.endsWith(".js"));
  expect(js.length).toBeGreaterThan(0);
  for (const [u, enc] of Object.entries(encodings)) expect(enc, u).toMatch(/^(br|gzip)$/);
  const asset = js[0]![0];
  const head = await page.request.get(asset, { headers: { "Accept-Encoding": "br, gzip" } });
  expect(head.headers()["cache-control"] ?? "").toMatch(/immutable/);
  const media = await page.request.get("/media/seed/covers/cs-verdant-loop.svg", { headers: { "Accept-Encoding": "br, gzip" } });
  expect(media.headers()["content-encoding"] ?? "").toBe("");
  const api = await page.request.get("/api/health", { headers: { "Accept-Encoding": "br, gzip" } });
  expect(api.headers()["content-encoding"] ?? "").toBe("");
  console.log(`F1 encodings: ${JSON.stringify(encodings)}`);
});

test("SEC-010 (run 2) no CSP violation while the contact form hydrates, lazy-loads and submits", async ({ page }) => {
  const csp: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => console.error(`Refused to load (CSP violation): ${e.violatedDirective} ${e.blockedURI}`));
  });
  const chunks: string[] = [];
  page.on("request", (r) => {
    if (/\/assets\/.*\.js$/.test(r.url())) chunks.push(r.url().replace(BASE_URL, ""));
  });
  await page.goto("/contact");
  const submit = page.getByRole("button", { name: "Send enquiry" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await page.getByLabel(/^Name/).fill("E2E CSP Sender");
  await page.getByLabel(/^Email/).fill("csp.sender@example.com");
  await page.getByLabel(/^Enquiry type/).selectOption({ index: 1 });
  await page.getByLabel(/^Message/).fill("Checking the form under the strict CSP.");
  await submit.click();
  await expect(page.getByRole("heading", { name: "Message received" })).toBeVisible();
  console.log(`contact JS chunks: ${JSON.stringify(chunks)}`);
  expect(csp).toEqual([]);
});
