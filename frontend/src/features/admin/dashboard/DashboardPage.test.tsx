import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiError, db, requestsTo } from "@/test/admin-handlers";
import { dashboard } from "@/test/admin-fixtures";
import { renderAdmin, renderAdminPage, setupAdminServer } from "@/test/admin-render";
import { formatLocalDateTime } from "./DashboardPage";

const server = setupAdminServer();

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
});

const rebuildPanel = () => screen.getByRole("region", { name: "Public site" });

describe("UI-T-077 dashboard rebuild notice", () => {
  it("needs_rebuild → notice with the command; Copy writes it and confirms", async () => {
    const { user } = await renderAdminPage("/admin", "Dashboard");
    // user-event installs its own clipboard stub in setup(); replace it afterwards.
    const writeText = vi.fn(() => Promise.resolve());
    mockClipboard(writeText);
    const panel = await screen.findByRole("region", { name: "Public site" });
    expect(within(panel).getByText(/Site needs rebuilding\. Content changed on/)).toBeInTheDocument();
    expect(within(panel).getByText(formatLocalDateTime(db.dashboard.content_changed_at))).toHaveAttribute("datetime", db.dashboard.content_changed_at);
    expect(within(panel).getByText("cd frontend; npm run build:site").tagName).toBe("CODE");
    await user.click(within(panel).getByRole("button", { name: "Copy command" }));
    expect(writeText).toHaveBeenCalledWith("cd frontend; npm run build:site");
    expect(await within(panel).findByText("Command copied.")).toBeInTheDocument();
  });

  it("up to date → success text with the build time", async () => {
    db.dashboard = dashboard({ needs_rebuild: false });
    await renderAdminPage("/admin", "Dashboard");
    await screen.findByRole("region", { name: "Public site" });
    expect(within(rebuildPanel()).getByText(/Public site is up to date — last built/)).toBeInTheDocument();
    expect(within(rebuildPanel()).queryByRole("button", { name: "Copy command" })).toBeNull();
  });

  it("last_build null → never-built notice plus the command", async () => {
    db.dashboard = dashboard({ last_build: null, needs_rebuild: true });
    await renderAdminPage("/admin", "Dashboard");
    await screen.findByRole("region", { name: "Public site" });
    expect(within(rebuildPanel()).getByText("The site has not been built yet.")).toBeInTheDocument();
    expect(within(rebuildPanel()).getByText("cd frontend; npm run build:site")).toBeInTheDocument();
  });

  it("clipboard rejects → text selected and 'Press Ctrl+C to copy'", async () => {
    const { user } = await renderAdminPage("/admin", "Dashboard");
    mockClipboard(() => Promise.reject(new Error("denied")));
    const panel = await screen.findByRole("region", { name: "Public site" });
    await user.click(within(panel).getByRole("button", { name: "Copy command" }));
    expect(await within(panel).findByText("Press Ctrl+C to copy.")).toBeInTheDocument();
    expect(window.getSelection()?.toString()).toBe("cd frontend; npm run build:site");
  });
});

describe("UI-T-078 dashboard loading, error and success", () => {
  it("loading skeleton while the request is pending", async () => {
    server.use(
      http.get("*/api/admin/dashboard", async () => {
        await delay(200);
        return HttpResponse.json(dashboard());
      }),
    );
    renderAdmin("/admin");
    expect(await screen.findByText("Loading the dashboard…")).toBeInTheDocument();
    await screen.findByRole("region", { name: "Public site" });
  });

  it("500 → error with Retry that refetches", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/admin/dashboard", () => {
        calls += 1;
        return calls <= 3 ? apiError(500, "internal_error", "Boom") : HttpResponse.json(dashboard());
      }),
    );
    const { user } = await renderAdminPage("/admin", "Dashboard");
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByText("The server had a problem. Please try again.")).toBeInTheDocument();
    await user.click(retry);
    await screen.findByRole("region", { name: "Public site" });
    expect(calls).toBe(4);
  });

  it("success: new-enquiry link to ?status=new and the counts table with links", async () => {
    await renderAdminPage("/admin", "Dashboard");
    const enquiries = await screen.findByRole("region", { name: "Enquiries" });
    expect(within(enquiries).getByText("New enquiries: 3")).toBeInTheDocument();
    expect(within(enquiries).getByRole("link", { name: "View new enquiries" })).toHaveAttribute("href", "/admin/enquiries?status=new");
    const table = within(screen.getByRole("region", { name: "Content" })).getByRole("table");
    const caseRow = within(table).getByRole("row", { name: /Case studies/ });
    expect(within(caseRow).getByRole("link", { name: "Case studies" })).toHaveAttribute("href", "/admin/case-studies");
    expect(within(caseRow).getAllByRole("cell").map((c) => c.textContent)).toEqual(["6", "6"]);
    const testimonials = within(table).getByRole("row", { name: /Testimonials/ });
    expect(within(testimonials).getAllByRole("cell").map((c) => c.textContent)).toEqual(["4", "5"]);
    await waitFor(() => expect(requestsTo("GET", "/api/admin/dashboard").length).toBeGreaterThan(0));
  });
});
