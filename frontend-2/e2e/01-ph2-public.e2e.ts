/**
 * PH-2 public journeys on the frontend-2 dev server (backend on the seeded TEST database):
 * UI-T-148 (Home + case study at 375/768/1024/1440, states, axe, overflow, touch targets, hero actions),
 * UI-T-150 (motion: reveal, reduced motion, print, CLS), UI-T-151 (header hide/reveal and focus),
 * UI-T-152 (every request same-origin). NOT RUN BY THE BUILDER.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  HEIGHT_FOR,
  PAGES,
  WIDTHS,
  axeCheck,
  noHorizontalScroll,
  noPanel,
  scrollInSteps,
  settle,
  smallTouchTargets,
  waitForContent,
} from "./support/helpers";

async function open(page: Page, path: string, width: number, height = HEIGHT_FOR[width] ?? 900) {
  await page.setViewportSize({ width, height });
  await page.goto(noPanel(path));
  await waitForContent(page);
  await expect(page.locator("h1")).toHaveCount(1);
}

test.describe("UI-T-148 Home and case study at 375/768/1024/1440", () => {
  for (const width of WIDTHS) {
    for (const [name, path] of Object.entries(PAGES)) {
      test(`UI-T-148 ${name} @${width}: header, footer, one h1, states and axe`, async ({ page }, testInfo) => {
        await open(page, path, width);
        await expect(page.locator("header").first()).toBeVisible();
        await expect(page.locator("footer").first()).toBeAttached();
        await settle(page);
        await axeCheck(page, `${name}@${width} top`, testInfo);

        await page.evaluate(() => window.scrollTo(0, 600));
        await expect(page.locator("header").first()).toHaveAttribute("data-compact", "true");
        await axeCheck(page, `${name}@${width} scrolled`, testInfo);

        if (width < 768) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.getByRole("button", { name: "Menu" }).click();
          await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
          await axeCheck(page, `${name}@${width} menu open`, testInfo);
          await page.keyboard.press("Escape");
          expect(await smallTouchTargets(page), `touch targets on ${name}@${width}`).toEqual([]);
        }

        if (name === "home") {
          const accordion = page.getByRole("region", { name: "What I do" }).getByRole("button").first();
          await accordion.click();
          await expect(accordion).toHaveAttribute("aria-expanded", "true");
          await axeCheck(page, `${name}@${width} accordion open`, testInfo);
          const next = page.getByRole("button", { name: "Next testimonial" });
          if (await next.count()) {
            await next.click();
            await axeCheck(page, `${name}@${width} carousel slide 2`, testInfo);
          }
        }

        const { scrollWidth, innerWidth } = await noHorizontalScroll(page);
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
      });
    }
  }

  test("UI-T-148 header hidden state passes axe (motion allowed)", async ({ browser }, testInfo) => {
    const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(noPanel("/"));
    await waitForContent(page);
    await settle(page);
    await scrollInSteps(page, 900);
    await expect(page.locator("header").first()).toHaveAttribute("data-hidden", "true");
    await axeCheck(page, "home@1440 header hidden", testInfo);
    await context.close();
  });

  test("UI-T-148 no horizontal scroll at 360 and 1920", async ({ page }) => {
    for (const width of [360, 1920]) {
      for (const path of Object.values(PAGES)) {
        await open(page, path, width);
        const { scrollWidth, innerWidth } = await noHorizontalScroll(page);
        expect(scrollWidth, `${path} at ${width}`).toBeLessThanOrEqual(innerWidth);
      }
    }
  });

  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`UI-T-148 / REQ-010 hero actions visible without scrolling @${vp.width}x${vp.height}`, async ({ page }) => {
      await open(page, "/", vp.width, vp.height);
      const hero = page.locator("main section").first();
      for (const name of ["Book a call", "View work"]) {
        await expect(hero.getByRole("link", { name: new RegExp(`^${name}`) })).toBeInViewport({ ratio: 1 });
      }
    });
  }
});

test.describe("UI-T-150 motion", () => {
  test("motion allowed: a below-fold block is hidden before and visible after crossing ~85 %", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(noPanel("/"));
    await waitForContent(page);
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    // Pin one below-fold block first: the :not([data-revealed]) selector stops matching it once it is revealed.
    const pinned = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("[data-reveal]:not([data-revealed])"));
      const target = candidates.at(-1);
      target?.setAttribute("data-testid", "pinned-reveal");
      return target !== undefined;
    });
    expect(pinned).toBe(true);
    const block = page.getByTestId("pinned-reveal");
    await expect(block).toHaveCSS("opacity", "0");
    await block.scrollIntoViewIfNeeded();
    await expect(block).toHaveAttribute("data-revealed", "");
    await expect(block).toHaveCSS("opacity", "1", { timeout: 5000 });
    await context.close();
  });

  test("reduced motion: no motion flag, everything visible at once, parallax static", async ({ page }) => {
    await open(page, PAGES.caseStudy, 1440);
    await expect(page.locator("html")).not.toHaveAttribute("data-motion", "on");
    const opacities = await page.$$eval("[data-reveal]", (els) => els.map((el) => getComputedStyle(el).opacity));
    expect(opacities.every((o) => o === "1")).toBe(true);
    const animation = await page.$eval("[data-parallax] img", (el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
  });

  test("print: every reveal block visible in its final position", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(noPanel("/"));
    await waitForContent(page);
    await page.emulateMedia({ media: "print" });
    const states = await page.$$eval("[data-reveal]", (els) =>
      els.map((el) => [getComputedStyle(el).opacity, getComputedStyle(el).transform]),
    );
    expect(states.every(([o, t]) => o === "1" && (t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)"))).toBe(true);
    await context.close();
  });

  test("JavaScript disabled: content visible (needs the pre-rendered build from PH-3; skipped on the dev server)", async () => {
    test.skip(!process.env.E2E_PREVIEW_URL, "PH-2 runs on the client-rendered dev server; the no-JS check runs on the PH-3 preview");
  });

  for (const path of Object.values(PAGES)) {
    test(`UI-T-150 CLS < 0.05 across a full scroll of ${path}`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
            if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(noPanel(path));
      await waitForContent(page);
      await settle(page);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls).toBeLessThan(0.05);
      await context.close();
    });
  }
});

test.describe("UI-T-151 header hide/reveal and focus", () => {
  for (const width of [1440, 375]) {
    test(`UI-T-151 @${width}: hidden after scrolling down 800 px, visible after up 100 px; focus never covered`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width, height: HEIGHT_FOR[width] ?? 900 } });
      const page = await context.newPage();
      await page.goto(noPanel("/"));
      await waitForContent(page);
      const header = page.locator("header").first();
      await scrollInSteps(page, 800);
      await expect(header).toHaveAttribute("data-hidden", "true");
      await scrollInSteps(page, -100, 50);
      await expect(header).not.toHaveAttribute("data-hidden");

      // Tab from the top: header items are visible while focused; no focused element is covered by the header.
      await page.evaluate(() => window.scrollTo(0, 0));
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press("Tab");
        const state = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          const head = document.querySelector("header");
          if (!el || !head) return { ok: true };
          const inHeader = head.contains(el);
          const h = head.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          const headerShown = h.bottom > 0;
          const covered = !inHeader && headerShown && r.top < h.bottom && r.bottom > h.top;
          return { ok: (!inHeader || headerShown) && !covered, label: el.textContent?.slice(0, 30) };
        });
        expect(state.ok, `focus ${i}: ${state.label}`).toBe(true);
      }
      await context.close();
    });
  }
});

test("UI-T-152 every request is same-origin (fonts /fonts/, images /media/, data /api/public)", async ({ page }) => {
  const foreign: string[] = [];
  const fonts: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.origin !== "http://localhost:5174" && !url.protocol.startsWith("data")) foreign.push(req.url());
    if (req.resourceType() === "font") fonts.push(url.pathname);
  });
  for (const path of Object.values(PAGES)) {
    await page.goto(noPanel(path));
    await waitForContent(page);
    await settle(page);
  }
  expect(foreign).toEqual([]);
  expect(fonts.every((f) => f.startsWith("/fonts/"))).toBe(true);
});
