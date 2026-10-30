import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { apiError, db, PASSWORD, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderAdmin, setupAdminServer } from "@/test/admin-render";
import { getCsrfToken } from "../session/session-store";

const server = setupAdminServer();

async function openLogin(path = "/admin/login") {
  db.loggedIn = false;
  const rendered = renderAdmin(path);
  await screen.findByRole("heading", { level: 1, name: "Admin login" });
  return rendered;
}

const email = () => screen.getByLabelText(/^Email/);
const password = () => screen.getByLabelText(/^Password/);
const submit = () => screen.getByRole("button", { name: /^Log in|Logging in/ });

describe("UI-T-072 login: validation and success with next", () => {
  it("empty submit shows field errors on both fields and sends nothing", async () => {
    const { user } = await openLogin();
    await user.click(submit());
    expect(email()).toHaveAttribute("aria-invalid", "true");
    expect(email()).toHaveAccessibleDescription("Enter your email address.");
    expect(password()).toHaveAccessibleDescription("Enter your password.");
    expect(document.activeElement).toBe(email());
    expect(requestsTo("POST", "/api/admin/auth/login")).toHaveLength(0);
  });

  it("malformed email is rejected client-side", async () => {
    const { user } = await openLogin();
    await user.type(email(), "admin@");
    await user.type(password(), "x");
    await user.click(submit());
    expect(email()).toHaveAccessibleDescription("Enter an email address like name@example.com.");
    expect(requestsTo("POST", "/api/admin/auth/login")).toHaveLength(0);
  });

  it("200 with next=/admin/enquiries → navigates there; CSRF token kept in memory", async () => {
    const { user, router } = await openLogin("/admin/login?next=%2Fadmin%2Fenquiries");
    expect(email()).toHaveAttribute("autocomplete", "username");
    expect(password()).toHaveAttribute("autocomplete", "current-password");
    await user.type(email(), "admin@example.com");
    await user.type(password(), PASSWORD);
    await user.click(submit());
    await screen.findByRole("heading", { level: 1, name: "Enquiries" });
    expect(router.state.location.pathname).toBe("/admin/enquiries");
    expect(getCsrfToken()).toBe("csrf-token-1");
    expect(requestsTo("POST", "/api/admin/auth/login")[0]!.body).toEqual({ email: "admin@example.com", password: PASSWORD });
  });

  it("show/hide password toggle; paste allowed (no blocking handlers)", async () => {
    const { user } = await openLogin();
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(password()).toHaveAttribute("type", "password");
    await user.click(toggle);
    expect(password()).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
    await user.click(password());
    await user.paste("pasted-secret");
    expect(password()).toHaveValue("pasted-secret");
  });

  it("already logged in → redirected away from the login page", async () => {
    const { router } = renderAdmin("/admin/login");
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    expect(router.state.location.pathname).toBe("/admin");
  });
});

describe("UI-T-073 login: 401 and 429", () => {
  it("401 → generic message, password cleared and focused", async () => {
    const { user } = await openLogin();
    await user.type(email(), "admin@example.com");
    await user.type(password(), "wrong-password");
    await user.click(submit());
    await findInRegion("Email or password is incorrect.");
    await waitFor(() => expect(password()).toHaveValue(""));
    expect(document.activeElement).toBe(password());
    expect(email()).toHaveValue("admin@example.com");
  });

  it("429 → too many attempts", async () => {
    server.use(http.post("*/api/admin/auth/login", () => apiError(429, "too_many_attempts", "Too many")));
    const { user } = await openLogin();
    await user.type(email(), "admin@example.com");
    await user.type(password(), PASSWORD);
    await user.click(submit());
    await findInRegion("Too many attempts. Try again in 15 minutes.");
  });

  it("403 origin rejected / 500 → generic failure message", async () => {
    server.use(http.post("*/api/admin/auth/login", () => apiError(403, "origin_rejected", "Origin")));
    const { user } = await openLogin();
    await user.type(email(), "admin@example.com");
    await user.type(password(), PASSWORD);
    await user.click(submit());
    await findInRegion("Login failed. Please try again.");
  });
});

describe("UI-T-074 login redirect never leaves the admin", () => {
  it.each(["//evil.example", "https://evil.example", "/\\evil", "/work", "%2F%2Fevil.example", "/admin@evil.example", "/administrator"])(
    "next=%s → /admin",
    async (next) => {
      const { user, router } = await openLogin(`/admin/login?next=${encodeURIComponent(next)}`);
      await user.type(email(), "admin@example.com");
      await user.type(password(), PASSWORD);
      await user.click(submit());
      await screen.findByRole("heading", { level: 1, name: "Dashboard" });
      expect(router.state.location.pathname).toBe("/admin");
    },
  );
});

describe("UI-T-071 no browser storage writes (SEC-UI-006)", () => {
  it("login, navigation and logout never write localStorage / sessionStorage / cookies", async () => {
    const local = vi.spyOn(Storage.prototype, "setItem");
    const cookie = vi.spyOn(document, "cookie", "set");
    const { user } = await openLogin("/admin/login?next=%2Fadmin%2Fservices");
    await user.type(email(), "admin@example.com");
    await user.type(password(), PASSWORD);
    await user.click(submit());
    await screen.findByRole("heading", { level: 1, name: "Services" });
    const nav = screen.getByRole("navigation", { name: "Admin" });
    await user.click(within(nav).getByRole("link", { name: "Values" }));
    await screen.findByRole("heading", { level: 1, name: "Values" });
    await user.click(screen.getAllByRole("button", { name: "Log out" })[0]!);
    await screen.findByRole("heading", { level: 1, name: "Admin login" });
    expect(local).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBeNull();
  });
});
