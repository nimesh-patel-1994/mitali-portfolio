import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderAdminPage, setupAdminServer } from "@/test/admin-render";

setupAdminServer();

describe("UI-T-092 writing list", () => {
  it("12 rows with format labels and chips; delete with confirmation", async () => {
    const { user } = await renderAdminPage("/admin/writing", "Writing samples");
    const list = await screen.findByRole("list", { name: "Writing samples in display order" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(12);
    expect(within(rows[0]!).getByText(/^Blog · Updated/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/^Web copy · Updated/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Sample")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Published")).toBeInTheDocument();
    const target = db.writing[2]!;
    await user.click(within(list).getByRole("button", { name: `Delete ${target.title}` }));
    await user.click(screen.getByRole("button", { name: "Delete writing sample" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(11));
    expect(requestsTo("DELETE", `/api/admin/writing-samples/${target.id}`)).toHaveLength(1);
  });

  it("empty → empty state with create action", async () => {
    db.writing = [];
    await renderAdminPage("/admin/writing", "Writing samples");
    expect(await screen.findByText("No writing samples yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New writing sample" })).toHaveLength(2);
  });
});

describe("UI-T-093 writing editor", () => {
  it("missing required fields → errors; 6 formats; save shows reading time from the response", async () => {
    const { user } = await renderAdminPage("/admin/writing/new", "New writing sample");
    const format = screen.getByLabelText(/^Format/) as HTMLSelectElement;
    expect(Array.from(format.options).map((o) => o.textContent)).toEqual([
      "Choose a format…",
      "Blog",
      "Web copy",
      "Email",
      "Social",
      "Landing page",
      "Newsletter",
    ]);
    await user.click(screen.getByRole("button", { name: "Create writing sample" }));
    expect(screen.getByLabelText(/^Title/)).toHaveAccessibleDescription(/Enter a title\./);
    expect(format).toHaveAccessibleDescription("Choose a format.");
    expect(screen.getByLabelText(/^Published on/)).toHaveAccessibleDescription("Choose the publication date.");
    expect(screen.getByRole("textbox", { name: /^Body/ })).toHaveAccessibleDescription(/Write the body text\./);
    expect(requestsTo("POST", "/api/admin/writing-samples")).toHaveLength(0);

    await user.type(screen.getByLabelText(/^Title/), "Spring newsletter");
    await user.selectOptions(format, "newsletter");
    await user.type(screen.getByLabelText(/^Published on/), "2026-03-01");
    await user.type(screen.getByLabelText(/^Excerpt/), "A short excerpt.");
    await user.type(screen.getByRole("textbox", { name: /^Body/ }), "Body text");
    await user.click(screen.getByRole("button", { name: "Create writing sample" }));
    await findInRegion("Created “Spring newsletter”.", "status");
    expect(requestsTo("POST", "/api/admin/writing-samples")[0]!.body).toMatchObject({
      slug: "spring-newsletter",
      format: "newsletter",
      published_on: "2026-03-01",
      client_name: null,
      industry: null,
      thumbnail_media_id: null,
    });
    expect(await screen.findByText("Last saved: 321 words, 2 min read.")).toBeInTheDocument();
  });

  it("unknown id → not-found state", async () => {
    await renderAdminPage("/admin/writing/00000000-0000-4000-8000-999999999999", "Edit writing sample");
    expect(await screen.findByText("This item no longer exists")).toBeInTheDocument();
  });
});
