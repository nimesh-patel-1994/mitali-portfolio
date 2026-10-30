import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiError, db, requestsTo } from "@/test/admin-handlers";
import { enquiry } from "@/test/admin-fixtures";
import { findInRegion, renderAdminPage, setupAdminServer } from "@/test/admin-render";

const server = setupAdminServer();

describe("UI-T-101 enquiries list", () => {
  it("filter New: URL ?status=new, 3 rows newest first", async () => {
    const { user, router } = await renderAdminPage("/admin/enquiries", "Enquiries");
    await screen.findByRole("table");
    await user.click(screen.getByRole("link", { name: "New" }));
    await waitFor(() => expect(router.state.location.search).toBe("?status=new"));
    expect(screen.getByRole("link", { name: "New" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4));
    const names = within(screen.getByRole("table")).getAllByRole("link").map((l) => l.textContent);
    expect(names).toEqual(["Sender 1", "Sender 2", "Sender 4"]);
    expect(requestsTo("GET", "/api/admin/enquiries").at(-1)!.search).toContain("status=new");
    expect(screen.getByText("3 enquiries (new)")).toBeInTheDocument();
  });

  it("pagination: page 2 of 2", async () => {
    db.enquiries = Array.from({ length: 25 }, (_, i) => enquiry(i + 1, { created_at: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T0${i % 10}:00:00+00:00` }));
    const { user, router } = await renderAdminPage("/admin/enquiries", "Enquiries");
    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Next page" }));
    await waitFor(() => expect(router.state.location.search).toBe("?page=2"));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(6));
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/admin/enquiries");
  });

  it("empty filter → 'No new enquiries' + Show all; empty overall", async () => {
    db.enquiries = [enquiry(1, { status: "archived" })];
    await renderAdminPage("/admin/enquiries?status=new", "Enquiries");
    expect(await screen.findByText("No new enquiries")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all" })).toHaveAttribute("href", "/admin/enquiries");
  });

  it("error → Retry", async () => {
    server.use(http.get("*/api/admin/enquiries", () => apiError(404, "not_found", "x")));
    await renderAdminPage("/admin/enquiries", "Enquiries");
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("UI-T-102 enquiry detail", () => {
  it("message with markup rendered as literal text; mailto reply link", async () => {
    db.enquiries[0] = enquiry(1, { message: 'Hi <img src=x onerror=alert(1)>\nSecond line' });
    await renderAdminPage(`/admin/enquiries/${db.enquiries[0].id}`, "Sender 1");
    const message = screen.getByText(/Hi <img src=x onerror=alert\(1\)>/);
    expect(message.querySelector("img")).toBeNull();
    expect(document.querySelector("main img")).toBeNull();
    expect(message.textContent).toBe("Hi <img src=x onerror=alert(1)>\nSecond line");
    expect(screen.getByRole("link", { name: "Reply by email" })).toHaveAttribute(
      "href",
      "mailto:sender1@example.com?subject=Re%3A%20your%20enquiry",
    );
    expect(screen.getByText("1,000–3,000")).toBeInTheDocument();
  });

  it("mark Replied → PATCH sent, chip updates, list and dashboard invalidated", async () => {
    const e = db.enquiries[0]!;
    const { user } = await renderAdminPage(`/admin/enquiries/${e.id}`, e.name);
    const dashboardBefore = requestsTo("GET", "/api/admin/dashboard").length;
    await user.click(screen.getByRole("radio", { name: "Replied" }));
    await findInRegion("Marked as replied.", "status");
    expect(requestsTo("PATCH", `/api/admin/enquiries/${e.id}`)[0]!.body).toEqual({ status: "replied" });
    expect(screen.getByRole("radio", { name: "Replied" })).toBeChecked();
    expect(screen.getAllByText("Replied").some((el) => el.tagName === "SPAN" && el.className.includes("status"))).toBe(true);
    await waitFor(() => expect(requestsTo("GET", "/api/admin/dashboard").length).toBeGreaterThan(dashboardBefore));
  });

  it("PATCH fails → control reverts with an error", async () => {
    server.use(http.patch("*/api/admin/enquiries/:id", () => apiError(500, "internal_error", "Boom")));
    const e = db.enquiries[0]!;
    const { user } = await renderAdminPage(`/admin/enquiries/${e.id}`, e.name);
    await user.click(screen.getByRole("radio", { name: "Archived" }));
    await findInRegion(/The status could not be changed\./);
    expect(screen.getByRole("radio", { name: "New" })).toBeChecked();
  });

  it("delete → confirm, then back to the list", async () => {
    const e = db.enquiries[1]!;
    const { user, router } = await renderAdminPage(`/admin/enquiries/${e.id}`, e.name);
    await user.click(screen.getByRole("button", { name: "Delete enquiry" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete enquiry" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/enquiries"));
    expect(requestsTo("DELETE", `/api/admin/enquiries/${e.id}`)).toHaveLength(1);
  });

  it("unknown id → not-found state", async () => {
    await renderAdminPage("/admin/enquiries/00000000-0000-4000-8000-999999999999", "Enquiry");
    expect(await screen.findByText("This item no longer exists")).toBeInTheDocument();
  });
});

describe("UI-T-102 enquiry status radios keep keyboard focus while saving", () => {
  it("arrow keys while a PATCH is pending: radios stay enabled and focused; the latest choice is queued and sent next", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const patched: string[] = [];
    server.use(
      http.patch("*/api/admin/enquiries/:id", async ({ request }) => {
        const { status } = (await request.json()) as { status: string };
        patched.push(status);
        if (patched.length === 1) await gate;
        return HttpResponse.json({ ...db.enquiries[0]!, status });
      }),
    );
    const e = db.enquiries[0]!;
    const { user } = await renderAdminPage(`/admin/enquiries/${e.id}`, e.name);
    const radio = (name: string) => screen.getByRole("radio", { name });
    expect(radio("New")).toBeChecked();
    radio("New").focus();

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(patched).toEqual(["replied"]));
    expect(radio("Replied")).toBeChecked();
    expect(radio("Replied")).toHaveFocus();
    for (const name of ["New", "Replied", "Archived"]) expect(radio(name)).toBeEnabled();

    await user.keyboard("{ArrowDown}");
    expect(radio("Archived")).toHaveFocus();
    expect(radio("Archived")).toBeChecked();
    expect(patched).toEqual(["replied"]);

    release();
    await findInRegion("Marked as archived.", "status");
    expect(patched).toEqual(["replied", "archived"]);
    expect(radio("Archived")).toBeChecked();
    expect(radio("Archived")).toHaveFocus();
    expect(screen.queryByText("Marked as replied.")).toBeNull();
  });
});
