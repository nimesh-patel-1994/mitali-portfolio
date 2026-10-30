/**
 * Contact + admin journeys (ui-scope 6.1), run serially on one seeded TEST database:
 * UI-T-110, 111, 113, 115, 116, 117, 118, 119, 122, 126, 104 (unpublished), 107 (booking URL), 114 (last),
 * plus REQ-042/043/060/063/065/066 acceptance checks and axe on the main admin screens.
 */
import { expect, test, type Page } from "@playwright/test";
import { BASE_URL, clearLimits, rebuildSite } from "./support/harness";
import { HEIGHT_FOR, WIDTHS, axeCheck, loginAdmin } from "./support/helpers";

// Tests run in file order in one worker (workers: 1); later tests rely on earlier state, failures do not skip the rest.

const CONTACT_PROMISE_DEFAULT = "Tell me what you're working on. I reply to every enquiry within two working days.";
const FOOTER_RIGHTS_DEFAULT = "All rights reserved. Words, as always, are my own.";
const NEW_PROMISE = "E2E promise line: replies within one working day.";
const NEW_RIGHTS = "E2E rights line, all words reserved.";
const NEW_BIO = "E2E bio paragraph: plans first, then sentences that earn their place.";
const EDITED_TITLE = "Turning invoicing questions into organic sign-ups (E2E edit)";
const NEW_CASE = { title: "E2E Spring Launch Plan", slug: "e2e-spring-launch-plan" };
const DRAFT_CASE = { title: "E2E Hidden Draft", slug: "e2e-hidden-draft" };

async function fillContact(page: Page, overrides: Partial<Record<"name" | "email" | "message", string>> = {}) {
  await page.getByLabel(/^Name/).fill(overrides.name ?? "Asha Tester");
  await page.getByLabel(/^Email/).fill(overrides.email ?? "asha.tester@example.com");
  await page.getByLabel(/^Enquiry type/).selectOption({ index: 1 });
  await page.getByLabel(/^Message/).fill(overrides.message ?? "We need a content plan for a spring product launch.");
}

async function adminJson<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(path);
  expect(res.status(), path).toBe(200);
  return (await res.json()) as T;
}

async function newEnquiryTotal(page: Page): Promise<number> {
  return (await adminJson<{ total: number }>(page, "/api/admin/enquiries?status=new")).total;
}

async function pngBytes(page: Page, w = 1200, h = 800, hue = 120): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ w, h, hue }) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d")!;
      g.fillStyle = `hsl(${hue} 60% 40%)`;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "white";
      g.fillRect(w / 4, h / 4, w / 2, h / 2);
      return c.toDataURL("image/png");
    },
    { w, h, hue },
  );
  return Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
}

async function caseStudyIdBySlug(page: Page, slug: string): Promise<string> {
  const list = await adminJson<{ items: { id: string; slug: string }[] } | { id: string; slug: string }[]>(page, "/api/admin/case-studies");
  const items = Array.isArray(list) ? list : list.items;
  const found = items.find((i) => i.slug === slug);
  expect(found, `case study ${slug}`).toBeTruthy();
  return found!.id;
}

test("UI-T-126 (before) fresh seed: Contact promise and footer rights line show the initial texts", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator("main")).toContainText(CONTACT_PROMISE_DEFAULT);
  await expect(page.locator("footer")).toContainText(FOOTER_RIGHTS_DEFAULT);
});

test("UI-T-110 / REQ-042 contact: empty submit errors, enquiry type required, server error keeps input, valid submit, listed in admin", async ({ page }) => {
  clearLimits();
  await page.goto("/contact");
  const submit = page.getByRole("button", { name: "Send enquiry" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByLabel(/^Name/)).toBeFocused();
  for (const msg of ["Enter your name.", "Enter your email address.", "Choose what your enquiry is about.", "Write a short message about your project."]) {
    await expect(page.getByText(msg)).toBeVisible();
  }
  // Malformed email → field error, focus on Email.
  await page.getByLabel(/^Name/).fill("Asha Tester");
  await page.getByLabel(/^Email/).fill("not-an-email");
  await page.getByLabel(/^Message/).fill("Hello");
  await page.getByLabel(/^Enquiry type/).selectOption({ index: 1 });
  await submit.click();
  await expect(page.getByText("Enter an email address like name@example.com.")).toBeVisible();
  await expect(page.getByLabel(/^Email/)).toBeFocused();

  // Server failure and unreachable server → error, input kept.
  await page.route("**/api/public/enquiries", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal_error", message: "x" } }) }));
  await fillContact(page);
  await submit.click();
  await expect(page.getByText("Your message didn't send. Please try again in a moment.")).toBeVisible();
  await expect(page.getByLabel(/^Name/)).toHaveValue("Asha Tester");
  await page.unroute("**/api/public/enquiries");
  await page.route("**/api/public/enquiries", (route) => route.abort("connectionrefused"));
  await submit.click();
  await expect(page.getByText("Your message didn't send. Please try again in a moment.")).toBeVisible();
  await expect(page.getByLabel(/^Message/)).toHaveValue(/content plan/);
  await page.unroute("**/api/public/enquiries");

  // Admin baseline count.
  const adminPage = await page.context().newPage();
  await loginAdmin(adminPage);
  const before = await newEnquiryTotal(adminPage);

  await fillContact(page, { name: "E2E Valid Sender" });
  await submit.click();
  await expect(page.getByRole("heading", { name: "Message received" })).toBeVisible();
  expect(await newEnquiryTotal(adminPage)).toBe(before + 1);

  await adminPage.goto("/admin/enquiries?status=new");
  await expect(adminPage.getByText("E2E Valid Sender").first()).toBeVisible();
  await adminPage.close();
});

test("REQ-043 honeypot: filled hidden field shows confirmation but stores nothing", async ({ page }) => {
  await loginAdmin(page);
  const before = await newEnquiryTotal(page);
  const visitor = await page.context().browser()!.newPage();
  await visitor.goto("/contact");
  await fillContact(visitor, { name: "E2E Honeypot Bot" });
  await visitor.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, "http://spam.example");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await visitor.getByRole("button", { name: "Send enquiry" }).click();
  await expect(visitor.getByRole("heading", { name: "Message received" })).toBeVisible();
  expect(await newEnquiryTotal(page)).toBe(before);
  await visitor.close();
});

test("UI-T-111 / REQ-043 rate limit: 6th valid submission within the window shows try-again-later, input kept", async ({ page }) => {
  clearLimits();
  for (let i = 1; i <= 6; i++) {
    await page.goto("/contact");
    await fillContact(page, { name: `E2E Rate ${i}` });
    await page.getByRole("button", { name: "Send enquiry" }).click();
    if (i <= 5) {
      await expect(page.getByRole("heading", { name: "Message received" }), `submission ${i}`).toBeVisible();
    } else {
      await expect(page.getByText("You've sent several messages in a short time. Please try again later.")).toBeVisible();
      await expect(page.getByLabel(/^Name/)).toHaveValue("E2E Rate 6");
      await expect(page.getByLabel(/^Message/)).toHaveValue(/content plan/);
    }
  }
  clearLimits();
});

test("UI-T-113 / REQ-060 admin auth: redirect, generic error, next, logout, old session refused", async ({ page }) => {
  await page.goto("/admin/case-studies");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fcase-studies/);
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel(/^Password/).fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel(/^Password/).fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  clearLimits();
  await loginAdmin(page, "/admin/case-studies");
  await expect(page).toHaveURL(/\/admin\/case-studies$/);
  await expect(page.getByRole("heading", { name: "Case studies", level: 1 })).toBeVisible();

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "mp_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
  const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  expect(storage).toEqual({ local: 0, session: 0 });

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  const old = await page.request.get("/api/admin/auth/me", { headers: { cookie: `mp_session=${session?.value}` } });
  expect(old.status()).toBe(401);
  await page.goto("/admin/case-studies");
  await expect(page).toHaveURL(/\/admin\/login/);
  clearLimits();
});

test("REQ-063 / UI-T-104 create case studies: duplicate slug refused, draft stays 404", async ({ page }) => {
  // Leaving the dirty form after the duplicate-slug error raises the leave-page prompt (UI-040): accept it.
  page.on("dialog", (d) => void d.accept());
  await loginAdmin(page);
  const create = async (title: string, slug?: string) => {
    await page.goto("/admin/case-studies/new");
    await page.getByLabel(/^Title/).fill(title);
    if (slug) await page.getByLabel(/^Slug/).fill(slug);
    await page.getByLabel(/^Client name/).fill("E2E Client Co.");
    await page.getByLabel(/^Client industry/).fill("Retail");
    await page.getByLabel(/^Campaign type/).fill("Product launch");
    await page.getByLabel(/^Timeline/).fill("3 months");
    await page.getByLabel(/^Year/).fill("2026");
    await page.getByLabel(/^Summary/).fill("An original E2E case study summary.");
    await page.getByRole("textbox", { name: /^The problem/ }).fill("The **problem** in brief.");
    await page.getByRole("textbox", { name: /^The solution/ }).fill("The solution with a list:\n\n- one\n- two");
    await page.getByRole("button", { name: "Create case study" }).click();
  };
  // Duplicate slug.
  await create("Duplicate Slug Attempt", "verdant-loop");
  await expect(page.getByText(/slug/i).filter({ hasText: /taken|already|in use/i }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/case-studies\/new$/);
  // Valid draft (unpublished) and the main one.
  await create(DRAFT_CASE.title);
  await expect(page).toHaveURL(/\/admin\/case-studies\/[0-9a-f-]{36}$/);
  await create(NEW_CASE.title);
  await expect(page).toHaveURL(/\/admin\/case-studies\/[0-9a-f-]{36}$/);
  const list = await adminJson<unknown>(page, "/api/admin/case-studies");
  expect(JSON.stringify(list)).not.toContain("Duplicate Slug Attempt");
  expect((await page.request.get(`/work/${DRAFT_CASE.slug}`)).status()).toBe(404);
});

test("REQ-063 results: add a result to the new case study", async ({ page }) => {
  await loginAdmin(page);
  const id = await caseStudyIdBySlug(page, NEW_CASE.slug);
  await page.goto(`/admin/case-studies/${id}`);
  await page.getByRole("tab", { name: "Results" }).click();
  await page.getByRole("button", { name: "Add result" }).click();
  // Empty label → field errors.
  await page.getByRole("form", { name: "New result" }).getByRole("button", { name: "Add result" }).click();
  await expect(page.getByText("Enter a metric label.")).toBeVisible();
  const form = page.getByRole("form", { name: "New result" });
  await form.getByLabel(/^Metric label/).fill("Qualified leads");
  await form.getByLabel(/^Value/).fill("+64%");
  await form.getByLabel(/^Change/).fill("+120 %");
  await form.getByRole("button", { name: "Add result" }).click();
  await expect(page.getByRole("list", { name: "Results in display order" })).toContainText("Qualified leads");
});

test("UI-T-116 gallery: .gif rejected, PNG uploaded through the browser, alt required, half layout, reorder persisted", async ({ page }) => {
  await loginAdmin(page);
  const id = await caseStudyIdBySlug(page, NEW_CASE.slug);
  await page.goto(`/admin/case-studies/${id}`);
  await page.getByRole("tab", { name: "Gallery" }).click();

  const addViaUpload = async (file: { name: string; mimeType: string; buffer: Buffer }) => {
    await page.getByRole("button", { name: "Add image" }).click();
    const dialog = page.getByRole("dialog", { name: "Choose image" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("tab", { name: "Upload" }).click();
    await dialog.getByLabel("Choose an image file").setInputFiles(file);
    return dialog;
  };

  // GIF → client-side rejection, nothing uploaded.
  let uploads = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/admin/media") && r.method() === "POST") uploads++;
  });
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  let dialog = await addViaUpload({ name: "tiny.gif", mimeType: "image/gif", buffer: gif });
  await expect(dialog.getByRole("alert")).toContainText(/JPEG, PNG, WebP or SVG/i);
  expect(uploads).toBe(0);
  // Server-side check too: the API rejects a GIF with 415.
  const csrf = (await page.context().cookies()).find((c) => c.name === "mp_csrf")?.value ?? "";
  const serverGif = await page.request.post("/api/admin/media", {
    headers: { "X-CSRF-Token": csrf, Origin: BASE_URL },
    multipart: { file: { name: "tiny.gif", mimeType: "image/gif", buffer: gif } },
  });
  expect(serverGif.status()).toBe(415);

  // PNG → uploaded and selected.
  await dialog.getByLabel("Choose an image file").setInputFiles({ name: "e2e-gallery-1.png", mimeType: "image/png", buffer: await pngBytes(page, 1200, 800, 140) });
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  const tileForm = page.getByRole("form", { name: "New gallery image" });
  await expect(tileForm).toBeVisible();
  await expect(tileForm.getByRole("button", { name: "Save image" })).toBeDisabled();
  await expect(tileForm.getByText("Add alt text before saving")).toBeVisible();
  await tileForm.getByLabel(/^Alt text/).fill("E2E gallery tile one");
  await tileForm.getByLabel("Half width").check();
  await tileForm.getByRole("button", { name: "Save image" }).click();
  const gallery = page.getByRole("list", { name: "Gallery images in display order" });
  await expect(gallery).toContainText("E2E gallery tile one");

  // Second image, full width.
  dialog = await addViaUpload({ name: "e2e-gallery-2.png", mimeType: "image/png", buffer: await pngBytes(page, 900, 600, 30) });
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await page.getByRole("form", { name: "New gallery image" }).getByLabel(/^Alt text/).fill("E2E gallery tile two");
  await page.getByRole("form", { name: "New gallery image" }).getByRole("button", { name: "Save image" }).click();
  await expect(gallery).toContainText("E2E gallery tile two");

  // Reorder by keyboard: move tile two up.
  const up = page.getByRole("button", { name: /^Move .*E2E gallery tile two.* up$/ });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(gallery.locator("li").first()).toContainText("E2E gallery tile two");
  await page.reload();
  await page.getByRole("tab", { name: "Gallery" }).click();
  await expect(page.getByRole("list", { name: "Gallery images in display order" }).locator("li").first()).toContainText("E2E gallery tile two");
  const detail = await adminJson<{ images: { alt: string; layout: string; position: number }[] }>(page, `/api/admin/case-studies/${id}`);
  expect(detail.images.map((i) => [i.alt, i.layout])).toEqual([
    ["E2E gallery tile two", "full"],
    ["E2E gallery tile one", "half"],
  ]);
});

test("REQ-063 publish the new case study", async ({ page }) => {
  await loginAdmin(page);
  const id = await caseStudyIdBySlug(page, NEW_CASE.slug);
  await page.goto(`/admin/case-studies/${id}`);
  await page.getByLabel("Published", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Changes saved.").first()).toBeVisible();
});

test("UI-T-115 (part 1) edit a title, move another case study up (keyboard), dashboard says rebuild", async ({ page }) => {
  await loginAdmin(page);
  const id = await caseStudyIdBySlug(page, "northpeak-ledger");
  await page.goto(`/admin/case-studies/${id}`);
  await page.getByLabel(/^Title/).fill(EDITED_TITLE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Changes saved.").first()).toBeVisible();

  await page.goto("/admin/case-studies");
  const list = page.getByRole("list", { name: "Case studies in display order" });
  await expect(list).toContainText("A brand voice for small-group adventures");
  const titlesBefore = await list.locator("li").allInnerTexts();
  const trailIndex = titlesBefore.findIndex((t) => t.includes("A brand voice for small-group adventures"));
  expect(trailIndex).toBeGreaterThan(0);
  const up = page.getByRole("button", { name: "Move A brand voice for small-group adventures up" });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(list.locator("li").nth(trailIndex - 1)).toContainText("A brand voice for small-group adventures");
  await expect(up).toBeFocused();

  await page.goto("/admin");
  await expect(page.getByText(/Site needs rebuilding/)).toBeVisible();
  await expect(page.getByText("npm run build:site").first()).toBeVisible();
});

test("UI-T-117 (part 1) unpublish a testimonial; deleting a non-empty FAQ category is refused", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/testimonials");
  const list = page.getByRole("list", { name: "Testimonials in display order" });
  await list.getByRole("button", { name: /^Edit / }).first().click();
  await page.getByLabel("Published", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(list.locator("li").first()).toContainText(/Draft|Unpublished|Hidden/i);

  await page.goto("/admin/faqs");
  const del = page.getByRole("button", { name: /^Delete category / }).first();
  const name = ((await del.getAttribute("aria-label")) ?? "").replace("Delete category ", "");
  await del.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByText("Move or delete the FAQs in this category first.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: `Category ${name}` })).toBeVisible();
});

test("UI-T-118 (part 1) clear sample flags on a seeded case study", async ({ page }) => {
  await loginAdmin(page);
  const id = await caseStudyIdBySlug(page, "kesar-and-clay");
  await page.goto(`/admin/case-studies/${id}`);
  await page.getByRole("button", { name: "Clear sample flags" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Clear sample flags" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Clear sample flags" })).toBeHidden();
  const detail = await adminJson<{ is_sample: boolean; results: { is_sample: boolean }[] }>(page, `/api/admin/case-studies/${id}`);
  expect(detail.is_sample).toBe(false);
  expect(detail.results.every((r) => !r.is_sample)).toBe(true);
});

test("UI-T-122 / UI-T-126 / REQ-065 settings and profile: invalid values refused, new values saved", async ({ page }) => {
  await loginAdmin(page);
  const before = await adminJson<Record<string, unknown>>(page, "/api/admin/settings");
  await page.goto("/admin/settings");
  const form = page.getByRole("form", { name: "Site settings" });
  const save = form.getByRole("button", { name: "Save settings" });

  // Invalid booking URL.
  await form.getByLabel(/^Booking URL/).fill("not a url");
  await save.click();
  await expect(form.getByLabel(/^Booking URL/)).toHaveAttribute("aria-invalid", "true");
  // Invalid contact email.
  await form.getByLabel(/^Contact email/).fill("not-an-email");
  await save.click();
  await expect(form.getByLabel(/^Contact email/)).toHaveAttribute("aria-invalid", "true");
  // Empty contact promise.
  await form.getByLabel(/^Contact promise line/).fill("");
  await save.click();
  await expect(form.getByText("Enter the promise line for the Contact page.")).toBeVisible();
  expect(await adminJson<Record<string, unknown>>(page, "/api/admin/settings")).toEqual(before);

  await page.reload();
  await form.getByLabel(/^Booking URL/).fill("https://example.com/book");
  await form.getByLabel(/^Contact promise line/).fill(NEW_PROMISE);
  await form.getByLabel(/^Footer rights line/).fill(NEW_RIGHTS);
  await form.getByRole("button", { name: "Add social link" }).click();
  const n = ((before.social_links as unknown[]) ?? []).length + 1;
  await form.getByLabel(new RegExp(`^Link ${n} label`)).fill("Dribbble");
  await form.getByLabel(new RegExp(`^Link ${n} address`)).fill("https://example.com/dribbble");
  await save.click();
  await expect(page.getByText("Settings saved.").first()).toBeVisible();
  const after = await adminJson<{ booking_url: string; contact_promise: string; footer_rights_line: string; social_links: { label: string }[] }>(page, "/api/admin/settings");
  expect(after.booking_url).toBe("https://example.com/book");
  expect(after.contact_promise).toBe(NEW_PROMISE);
  expect(after.footer_rights_line).toBe(NEW_RIGHTS);
  expect(after.social_links.map((s) => s.label)).toContain("Dribbble");

  await page.goto("/admin/profile");
  const profile = page.getByRole("form", { name: "Profile" });
  await profile.getByLabel("Paragraph 1", { exact: true }).fill(NEW_BIO);
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.").first()).toBeVisible();
});

test("REQ-052 rebuild: dashboard notice clears; public site shows every change (UI-T-115/117/118/122/126/107/104/063)", async ({ page, context }) => {
  rebuildSite();
  await loginAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText(/Public site is up to date/)).toBeVisible();

  // UI-T-115: new title and order on /work.
  await page.goto("/work");
  const cards = page.locator('main a[href^="/work/"]');
  const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  const admin = await adminJson<{ slug: string; is_published: boolean }[] | { items: { slug: string; is_published: boolean }[] }>(page, "/api/admin/case-studies");
  const adminOrder = (Array.isArray(admin) ? admin : admin.items).filter((c) => c.is_published).map((c) => `/work/${c.slug}`);
  expect([...new Set(hrefs)]).toEqual(adminOrder);
  await expect(page.locator("main")).toContainText(EDITED_TITLE);
  expect(adminOrder).toContain(`/work/${NEW_CASE.slug}`);
  expect(adminOrder).not.toContain(`/work/${DRAFT_CASE.slug}`);

  // REQ-063: the new case study with its result and half/full gallery.
  await page.goto(`/work/${NEW_CASE.slug}`);
  await expect(page.locator("h1")).toHaveText(NEW_CASE.title);
  await expect(page.locator("main")).toContainText("Qualified leads");
  await expect(page.locator("main")).toContainText("+64%");
  await expect(page.locator("main")).toContainText("+120 %");
  const tiles = page.locator("main img[alt^='E2E gallery tile']");
  await expect(tiles).toHaveCount(2);
  await expect(tiles.nth(0)).toHaveAttribute("alt", "E2E gallery tile two");
  for (const img of await tiles.all()) {
    const src = (await img.getAttribute("src")) ?? "";
    expect(src.startsWith("/media/")).toBe(true);
    expect((await page.request.get(src)).status()).toBe(200);
    expect((await img.getAttribute("srcset")) ?? "").toMatch(/\d+w/);
  }

  // UI-T-104 / REQ-022: draft is 404 and absent from the sitemap.
  const draft = await page.request.get(`/work/${DRAFT_CASE.slug}`);
  expect(draft.status()).toBe(404);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain(DRAFT_CASE.slug);
  expect(sitemap).toContain(NEW_CASE.slug);

  // UI-T-117: carousel shows one fewer slide.
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Show testimonial/ })).toHaveCount(4);

  // UI-T-118: no sample notes on the cleared case study.
  // The seeded chart gallery tile has the caption "Sample data" (content, editable); the notes are what REQ-067 covers.
  const notesText = () =>
    page.locator("main").evaluate((m) => {
      const clone = m.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("figcaption").forEach((f) => f.remove());
      return clone.innerText;
    });
  await page.goto("/work/kesar-and-clay");
  expect(await notesText()).not.toContain("Sample data");
  expect(await notesText()).not.toContain("Sample case study");
  await page.goto("/work/verdant-loop");
  expect(await notesText()).toContain("Sample data");
  expect(await notesText()).toContain("Sample case study");

  // UI-T-122: footer link, story block paragraph.
  await page.goto("/about");
  const dribbble = page.locator("footer").getByRole("link", { name: /Dribbble/ });
  await expect(dribbble).toHaveAttribute("href", "https://example.com/dribbble");
  await expect(dribbble).toHaveAttribute("target", "_blank");
  await expect(dribbble).toHaveAttribute("rel", /noopener/);
  await expect(dribbble).toHaveAttribute("rel", /noreferrer/);
  await expect(page.locator("main")).toContainText(NEW_BIO);
  await page.goto("/");
  await expect(page.locator("main")).toContainText(NEW_BIO);

  // UI-T-126: promise line and rights line on every page.
  await page.goto("/contact");
  await expect(page.locator("main")).toContainText(NEW_PROMISE);
  await expect(page.locator("main")).not.toContainText(CONTACT_PROMISE_DEFAULT);
  for (const path of ["/", "/work", "/writing", "/about", "/contact", "/faqs", `/work/${NEW_CASE.slug}`]) {
    await page.goto(path);
    await expect(page.locator("footer"), path).toContainText(NEW_RIGHTS);
  }

  // UI-T-107 / REQ-002: Book a call opens the settings URL in a new tab (external host stubbed, never contacted).
  await context.route("https://example.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" }));
  await page.goto("/work");
  const book = page.locator("header").getByRole("link", { name: /^Book a call/ });
  await expect(book).toHaveAttribute("href", "https://example.com/book");
  await expect(book).toHaveAttribute("target", "_blank");
  const [popup] = await Promise.all([page.waitForEvent("popup"), book.click()]);
  expect(popup.url()).toBe("https://example.com/book");
  await popup.close();
});

test("UI-T-107 (part 2) booking URL cleared and rebuilt → Book a call goes to /contact", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/settings");
  const form = page.getByRole("form", { name: "Site settings" });
  await form.getByLabel(/^Booking URL/).fill("");
  await form.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.").first()).toBeVisible();
  rebuildSite();
  await page.goto("/about");
  const book = page.locator("header").getByRole("link", { name: /^Book a call/ });
  await expect(book).toHaveAttribute("href", "/contact");
  await expect(book).not.toHaveAttribute("target", "_blank");
});

test("REQ-063 delete a case study with results and gallery: confirmation required, children removed", async ({ page }) => {
  await loginAdmin(page);
  const id = await caseStudyIdBySlug(page, NEW_CASE.slug);
  await page.goto("/admin/case-studies");
  await page.getByRole("button", { name: `Delete ${NEW_CASE.title}` }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(/results/i);
  await expect(confirm).toContainText(/gallery/i);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  expect((await page.request.get(`/api/admin/case-studies/${id}`)).status()).toBe(200);
  await page.getByRole("button", { name: `Delete ${NEW_CASE.title}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete case study" }).click();
  await expect(page.getByRole("list", { name: "Case studies in display order" })).not.toContainText(NEW_CASE.title);
  expect((await page.request.get(`/api/admin/case-studies/${id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/admin/case-studies/${id}/results`)).status()).not.toBe(200);
});

test("UI-T-119 / REQ-066 enquiries: filter New, open one, mark Replied, dashboard count decreases", async ({ page }) => {
  await loginAdmin(page);
  const all = await adminJson<{ total: number; items: { status: string; created_at: string }[] }>(page, "/api/admin/enquiries");
  const newTotal = await newEnquiryTotal(page);
  expect(all.items.map((i) => i.created_at)).toEqual([...all.items.map((i) => i.created_at)].sort().reverse());

  await page.goto("/admin");
  await expect(page.getByText(`New enquiries: ${newTotal}`)).toBeVisible();
  await page.goto("/admin/enquiries");
  await page.getByRole("navigation", { name: "Filter enquiries by status" }).getByRole("link", { name: "New" }).click();
  await expect(page).toHaveURL(/status=new/);
  const rows = page.locator("main").getByRole("link", { name: /.+/ }).filter({ has: page.locator("text=/.+/") });
  expect(await rows.count()).toBeGreaterThan(0);
  await page.locator('main a[href^="/admin/enquiries/"]').first().click();
  await page.getByLabel("Replied", { exact: true }).click();
  await expect(page.getByLabel("Replied", { exact: true })).toBeChecked();
  await expect(page.getByText("Marked as replied.")).toBeVisible();
  await page.getByRole("link", { name: "Back to enquiries" }).click();
  await page.goto("/admin");
  await expect(page.getByText(`New enquiries: ${newTotal - 1}`)).toBeVisible();
  expect(await newEnquiryTotal(page)).toBe(newTotal - 1);
});

test.describe("axe on main admin screens at 360/810/1440", () => {
  for (const width of WIDTHS) {
    test(`admin screens axe @${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: HEIGHT_FOR[width] ?? 900 });
      await page.goto("/admin/login");
      await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
      await axeCheck(page, "admin-login", width, testInfo);
      await loginAdmin(page);
      const id = await caseStudyIdBySlug(page, "verdant-loop");
      for (const [label, path] of [
        ["admin-dashboard", "/admin"],
        ["admin-case-studies", "/admin/case-studies"],
        ["admin-case-study-editor", `/admin/case-studies/${id}`],
        ["admin-writing", "/admin/writing"],
        ["admin-faqs", "/admin/faqs"],
        ["admin-testimonials", "/admin/testimonials"],
        ["admin-enquiries", "/admin/enquiries"],
        ["admin-settings", "/admin/settings"],
        ["admin-profile", "/admin/profile"],
      ] as const) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        await axeCheck(page, label, width, testInfo);
      }
    });
  }
});

test("UI-T-114 / REQ-061 5 wrong logins then the correct password → too many attempts, no dashboard", async ({ page }) => {
  clearLimits();
  await page.goto("/admin/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Email").fill("e2e-admin@example.com");
    await page.getByLabel(/^Password/).fill(`wrong-password-${i}`);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  }
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel(/^Password/).fill(process.env.E2E_ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Too many attempts. Try again in 15 minutes.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
  clearLimits();
});
