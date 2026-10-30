import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { apiError, db, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderAdmin, renderAdminPage, setupAdminServer } from "@/test/admin-render";
import { getCsrfToken } from "../session/session-store";

const server = setupAdminServer();

describe("UI-T-075 admin layout guard and sidebar", () => {
  it("getAdminMe 401 → redirect to login with next", async () => {
    db.loggedIn = false;
    const { router } = renderAdmin("/admin/case-studies");
    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    await screen.findByRole("heading", { level: 1, name: "Admin login" });
    expect(router.state.location.pathname).toBe("/admin/login");
    expect(router.state.location.search).toBe("?next=%2Fadmin%2Fcase-studies");
    expect(screen.queryByText("Your session has ended. Please log in again.")).toBeNull();
  });

  it("200 → sidebar links in order, active aria-current, badge '3 new', title and h1 focus", async () => {
    await renderAdminPage("/admin/case-studies", "Case studies");
    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(await within(nav).findByText("3 new")).toBeInTheDocument();
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Dashboard",
      "Case studies",
      "Writing",
      "Services",
      "Engagement models",
      "Testimonials",
      "FAQs",
      "Values",
      "Process steps",
      "Profile",
      "Settings",
      "Enquiries3 new",
    ]);
    expect(within(nav).getByRole("link", { name: "Case studies" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(await within(nav).findByText("3 new")).toBeInTheDocument();
    expect(document.title).toBe("Case studies — Admin — Mitali");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 })));
    const viewSite = screen.getAllByRole("link", { name: /View site/ })[0]!;
    expect(viewSite).toHaveAttribute("target", "_blank");
    expect(viewSite).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("session expires on a later request → cache cleared, login with next and the session-ended notice", async () => {
    const { router, user } = await renderAdminPage("/admin", "Dashboard");
    server.use(http.get("*/api/admin/services", () => apiError(401, "unauthenticated", "Expired")));
    db.loggedIn = false;
    await user.click(within(screen.getByRole("navigation", { name: "Admin" })).getByRole("link", { name: "Services" }));
    await screen.findByRole("heading", { level: 1, name: "Admin login" });
    expect(router.state.location.search).toBe("?next=%2Fadmin%2Fservices");
    await findInRegion("Your session has ended. Please log in again.", "status");
    expect(getCsrfToken()).toBeNull();
  });

  it("mobile drawer: Menu opens a dialog with the admin nav; Escape closes it", async () => {
    const { user } = await renderAdminPage("/admin", "Dashboard");
    const menu = screen.getByRole("button", { name: "Menu" });
    await user.click(menu);
    const dialog = screen.getByRole("dialog", { name: "Admin menu" });
    expect(within(dialog).getByRole("navigation", { name: "Admin" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(menu);
  });
});

describe("UI-T-076 logout", () => {
  it("204 → cache cleared and navigation to login", async () => {
    const { user, router } = await renderAdminPage("/admin", "Dashboard");
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Admin login" });
    expect(router.state.location.pathname).toBe("/admin/login");
    expect(getCsrfToken()).toBeNull();
    expect(db.loggedIn).toBe(false);
  });

  it("500 → still cleared and navigated to login", async () => {
    server.use(http.post("*/api/admin/auth/logout", () => HttpResponse.json({ error: { code: "internal_error", message: "x" } }, { status: 500 })));
    const { user, router } = await renderAdminPage("/admin", "Dashboard");
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0]!);
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/login"));
    expect(getCsrfToken()).toBeNull();
  });
});

describe("UI-T-075 / UI-REV-008 admin navigation: scroll reset, h1 focus, wordmark label", () => {
  it("wordmark links are named 'Mitali admin, dashboard' and lead to /admin", async () => {
    await renderAdminPage("/admin/case-studies", "Case studies");
    const marks = screen.getAllByRole("link", { name: "Mitali admin, dashboard" });
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark).toHaveAttribute("href", "/admin");
  });

  it("push to another screen scrolls to the top and focuses the new h1 without scrolling", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const { user } = await renderAdminPage("/admin/case-studies", "Case studies");
    scrollTo.mockClear();
    focus.mockClear();
    const nav = screen.getByRole("navigation", { name: "Admin" });
    await user.click(within(nav).getByRole("link", { name: "Services" }));
    const h1 = await screen.findByRole("heading", { level: 1, name: "Services" });
    await waitFor(() => expect(document.activeElement).toBe(h1));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    const h1Call = focus.mock.contexts.indexOf(h1);
    expect(focus.mock.calls[h1Call]).toEqual([{ preventScroll: true }]);
  });

  it("back (POP) does not scroll; a search-only change (list filter) does not scroll", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    const { router } = await renderAdminPage("/admin/case-studies", "Case studies");
    await act(async () => {
      await router.navigate("/admin/enquiries");
    });
    await screen.findByRole("heading", { level: 1, name: "Enquiries" });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    scrollTo.mockClear();
    await act(async () => {
      await router.navigate("/admin/enquiries?status=new");
    });
    expect(router.state.location.search).toBe("?status=new");
    await act(async () => {
      await router.navigate(-2);
    });
    await screen.findByRole("heading", { level: 1, name: "Case studies" });
    expect(router.state.historyAction).toBe("POP");
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("UI-T-076 / UI-040 logout with unsaved changes", () => {
  async function dirtyServicesPanel() {
    const rendered = await renderAdminPage("/admin/services", "Services");
    await screen.findByRole("list", { name: "Services in display order" });
    await rendered.user.click(screen.getAllByRole("button", { name: "New service" })[0]!);
    const panel = screen.getByRole("region", { name: "New service" });
    await rendered.user.type(within(panel).getByLabelText(/^Name/), "Draft");
    return rendered;
  }
  const logoutCalls = () => requestsTo("POST", "/api/admin/auth/logout").length;

  it("dirty + Log out + Keep editing → still logged in, no logout request, edits kept", async () => {
    const { user, router } = await dirtyServicesPanel();
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0]!);
    const dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(logoutCalls()).toBe(0);
    expect(db.loggedIn).toBe(true);
    expect(getCsrfToken()).not.toBeNull();
    expect(router.state.location.pathname).toBe("/admin/services");
    expect(within(screen.getByRole("region", { name: "New service" })).getByLabelText(/^Name/)).toHaveValue("Draft");
  });

  it("dirty + Log out + Discard → logout sent, lands on the login page (not blocked, no endless spinner)", async () => {
    const { user, router } = await dirtyServicesPanel();
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0]!);
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Discard and log out" }));
    await screen.findByRole("heading", { level: 1, name: "Admin login" });
    expect(router.state.location.pathname).toBe("/admin/login");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText("Checking your session…")).toBeNull();
    expect(logoutCalls()).toBe(1);
    expect(db.loggedIn).toBe(false);
    expect(getCsrfToken()).toBeNull();
  });

  it("clean page + Log out → no confirmation, straight to login", async () => {
    const { user, router } = await renderAdminPage("/admin/services", "Services");
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Admin login" });
    expect(router.state.location.pathname).toBe("/admin/login");
    expect(logoutCalls()).toBe(1);
  });
});
