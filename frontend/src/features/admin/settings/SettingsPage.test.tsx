import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { apiError, db, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderAdminPage, setupAdminServer } from "@/test/admin-render";

const server = setupAdminServer();

async function openForm() {
  const rendered = await renderAdminPage("/admin/settings", "Settings");
  await screen.findByRole("form", { name: "Site settings" });
  return rendered;
}

const field = (label: RegExp) => screen.getByLabelText(label);
const save = () => screen.getByRole("button", { name: "Save settings" });
const puts = () => requestsTo("PUT", "/api/admin/settings");

describe("UI-T-100 settings: email, booking URL, social links", () => {
  it("invalid email and booking URL 'not a url' → field errors, nothing sent", async () => {
    const { user } = await openForm();
    await user.clear(field(/^Contact email/));
    await user.type(field(/^Contact email/), "hello@");
    await user.clear(field(/^Booking URL/));
    await user.type(field(/^Booking URL/), "not a url");
    await user.click(save());
    expect(field(/^Contact email/)).toHaveAccessibleDescription("Enter an email address like name@example.com.");
    expect(field(/^Booking URL/)).toHaveAccessibleDescription(/Leave empty, use #, or enter a full web address/);
    expect(document.activeElement).toBe(field(/^Contact email/));
    expect(puts()).toHaveLength(0);
  });

  it.each([
    ["", null],
    ["#", "#"],
    ["https://cal.example.com/mitali", "https://cal.example.com/mitali"],
  ])("booking URL %j is accepted (sent as %j)", async (input, sent) => {
    const { user } = await openForm();
    await user.clear(field(/^Booking URL/));
    if (input) await user.type(field(/^Booking URL/), input);
    await user.click(save());
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect((puts()[0]!.body as { booking_url: unknown }).booking_url).toBe(sent);
  });

  it("social links: add is disabled at 8", async () => {
    const { user } = await openForm();
    const group = screen.getByRole("group", { name: "Social links" });
    const add = within(group).getByRole("button", { name: "Add social link" });
    for (let i = 0; i < 7; i += 1) await user.click(add);
    expect(within(group).getAllByRole("listitem")).toHaveLength(8);
    expect(add).toBeDisabled();
    expect(within(group).getByText("You can add up to 8 social links.")).toBeInTheDocument();
  });
});

describe("UI-T-125 settings: contact promise and footer rights line (CHG-005)", () => {
  const promise = () => field(/^Contact promise line/);
  const rights = () => field(/^Footer rights line/);

  it("counters show used of 200; empty, whitespace-only and 201 chars are refused with nothing sent", async () => {
    const { user } = await openForm();
    expect(promise()).toHaveAccessibleDescription(
      new RegExp(`Shown under the heading on the Contact page ${db.settings.contact_promise.length} of 200 characters`),
    );
    expect(rights()).toHaveAccessibleDescription(/Shown in the footer's bottom line 50 of 200 characters/);

    await user.clear(promise());
    await user.click(save());
    expect(promise()).toHaveAccessibleDescription(/Enter the promise line for the Contact page\./);
    expect(document.activeElement).toBe(promise());

    fireEvent.change(promise(), { target: { value: "   " } });
    fireEvent.change(rights(), { target: { value: "   " } });
    await user.click(save());
    expect(promise()).toHaveAccessibleDescription(/Enter the promise line for the Contact page\./);
    expect(rights()).toHaveAccessibleDescription(/Enter the rights line for the footer\./);

    fireEvent.change(promise(), { target: { value: "p".repeat(201) } });
    fireEvent.change(rights(), { target: { value: "r".repeat(201) } });
    expect(screen.getAllByText("201 of 200 characters")).toHaveLength(2);
    await user.click(save());
    expect(promise()).toHaveAccessibleDescription(/Keep this to 200 characters or fewer\./);
    expect(rights()).toHaveAccessibleDescription(/Keep this to 200 characters or fewer\./);
    expect(puts()).toHaveLength(0);
  });

  it("200 characters (with surrounding spaces) are sent trimmed", async () => {
    const { user } = await openForm();
    fireEvent.change(promise(), { target: { value: `  ${"p".repeat(200)}  ` } });
    fireEvent.change(rights(), { target: { value: "r".repeat(200) } });
    await user.click(save());
    await findInRegion("Settings saved.", "status");
    expect(puts()[0]!.body).toMatchObject({ contact_promise: "p".repeat(200), footer_rights_line: "r".repeat(200) });
  });

  it("server 422 fields.footer_rights_line → shown on that field with focus", async () => {
    server.use(
      http.put("*/api/admin/settings", () =>
        apiError(422, "validation_error", "Invalid", { footer_rights_line: "The rights line must not be blank." }),
      ),
    );
    const { user } = await openForm();
    await user.click(save());
    await waitFor(() => expect(rights()).toHaveAccessibleDescription(/The rights line must not be blank\./));
    expect(rights()).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(rights());
  });
});
