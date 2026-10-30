import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db, requestsTo } from "@/test/admin-handlers";
import { id } from "@/test/admin-fixtures";
import { findInRegion, pasteInto, renderAdminPage, setupAdminServer } from "@/test/admin-render";

setupAdminServer();

const panel = () => screen.getByRole("region", { name: /^(New|Edit) / });

describe("UI-T-094 services", () => {
  it("create in the panel with 2 deliverables; edit; delete; list refreshed", async () => {
    const { user } = await renderAdminPage("/admin/services", "Services");
    const list = await screen.findByRole("list", { name: "Services in display order" });
    await user.click(screen.getByRole("button", { name: "New service" }));
    await waitFor(() => expect(document.activeElement).toHaveTextContent("New service"));
    const p = panel();
    await user.type(within(p).getByLabelText(/^Name/), "Brand audits");
    await pasteInto(user, within(p).getByLabelText(/^Description/), "A careful look at every word.");
    await user.click(within(p).getByRole("button", { name: "Add deliverable" }));
    await pasteInto(user, within(p).getByLabelText("Deliverable 1"), "Audit report");
    await user.click(within(p).getByRole("button", { name: "Add deliverable" }));
    await pasteInto(user, within(p).getByLabelText("Deliverable 2"), "Workshop");
    await user.click(within(p).getByRole("button", { name: "Create service" }));
    await findInRegion("Created “Brand audits”.", "status");
    expect(requestsTo("POST", "/api/admin/services")[0]!.body).toEqual({
      name: "Brand audits",
      description: "A careful look at every word.",
      deliverables: ["Audit report", "Workshop"],
      is_published: true,
    });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(6));

    const first = db.services[0]!;
    await user.click(within(list).getByRole("button", { name: `Edit ${first.name}` }));
    const edit = panel();
    await user.clear(within(edit).getByLabelText(/^Name/));
    await user.type(within(edit).getByLabelText(/^Name/), "Strategy sprints");
    await user.click(within(edit).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/services/${first.id}`)).toHaveLength(1));
    expect(await within(list).findByText("Strategy sprints")).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: `Delete ${db.services[1]!.name}` }));
    await user.click(screen.getByRole("button", { name: "Delete service" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(5));
  });

  it("empty list → empty state with create; server 422 mapped onto the field", async () => {
    db.services = [];
    await renderAdminPage("/admin/services", "Services");
    expect(await screen.findByText("No services yet")).toBeInTheDocument();
  });
});

describe("UI-T-095 engagement models", () => {
  it("target 'Contact page' → PUT body cta_target contact; over-long label error", async () => {
    const { user } = await renderAdminPage("/admin/engagement-models", "Engagement models");
    const list = await screen.findByRole("list", { name: "Engagement models in display order" });
    const model = db.engagementModels[0]!;
    await user.click(within(list).getByRole("button", { name: `Edit ${model.name}` }));
    const p = panel();
    await user.click(within(p).getByRole("radio", { name: "Contact page" }));
    const label = within(p).getByLabelText(/^Button label/);
    fireEvent.change(label, { target: { value: "x".repeat(41) } });
    await user.click(within(p).getByRole("button", { name: "Save" }));
    expect(label).toHaveAccessibleDescription(/Keep this to 40 characters or fewer\./);
    expect(requestsTo("PUT", `/api/admin/engagement-models/${model.id}`)).toHaveLength(0);
    await user.clear(label);
    await user.type(label, "Say hello");
    await user.click(within(p).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/engagement-models/${model.id}`)).toHaveLength(1));
    expect(requestsTo("PUT", `/api/admin/engagement-models/${model.id}`)[0]!.body).toMatchObject({
      cta_target: "contact",
      cta_label: "Say hello",
      features: ["Feature A"],
    });
  });
});

describe("UI-T-096 testimonials", () => {
  it("linked case study / None; 601-character quote error", async () => {
    const { user } = await renderAdminPage("/admin/testimonials", "Testimonials");
    const list = await screen.findByRole("list", { name: "Testimonials in display order" });
    const t1 = db.testimonials[0]!;
    await user.click(within(list).getByRole("button", { name: `Edit ${t1.author_name}` }));
    let p = panel();
    const select = (await within(p).findByRole("option", { name: db.caseStudies[0]!.title })).closest("select")!;
    expect(select).toHaveValue(id(10, 1));
    await user.selectOptions(select, "");
    await user.click(within(p).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/testimonials/${t1.id}`)).toHaveLength(1));
    expect((requestsTo("PUT", `/api/admin/testimonials/${t1.id}`)[0]!.body as { case_study_id: unknown }).case_study_id).toBeNull();

    const t2 = db.testimonials[1]!;
    await user.click(within(list).getByRole("button", { name: `Edit ${t2.author_name}` }));
    p = panel();
    const select2 = (await within(p).findByRole("option", { name: db.caseStudies[2]!.title })).closest("select")!;
    await user.selectOptions(select2, db.caseStudies[2]!.id);
    fireEvent.change(within(p).getByLabelText(/^Quote/), { target: { value: "q".repeat(601) } });
    await user.click(within(p).getByRole("button", { name: "Save" }));
    expect(within(p).getByLabelText(/^Quote/)).toHaveAccessibleDescription(/Keep this to 600 characters or fewer\./);
    expect(requestsTo("PUT", `/api/admin/testimonials/${t2.id}`)).toHaveLength(0);
    fireEvent.change(within(p).getByLabelText(/^Quote/), { target: { value: "Short and sweet." } });
    await user.click(within(p).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/testimonials/${t2.id}`)).toHaveLength(1));
    expect((requestsTo("PUT", `/api/admin/testimonials/${t2.id}`)[0]!.body as { case_study_id: unknown }).case_study_id).toBe(db.caseStudies[2]!.id);
  });
});

describe("UI-T-098 values and process steps share one component", () => {
  it.each([
    ["/admin/values", "Values", "value", "values"],
    ["/admin/process-steps", "Process steps", "process step", "process-steps"],
  ] as const)("%s: create, publish toggle, reorder, delete hit the right operations", async (path, title, noun, api) => {
    const { user } = await renderAdminPage(path, title);
    const list = await screen.findByRole("list", { name: `${title} in display order` });
    if (api === "process-steps") expect(screen.getByText("The site shows these as a staircase in this order.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `New ${noun}` }));
    const p = panel();
    await user.type(within(p).getByLabelText(/^Title/), "Curiosity");
    await user.type(within(p).getByLabelText(/^Description/), "Ask why twice.");
    await user.click(within(p).getByRole("checkbox", { name: "Published" }));
    await user.click(within(p).getByRole("button", { name: `Create ${noun}` }));
    await waitFor(() => expect(requestsTo("POST", `/api/admin/${api}`)).toHaveLength(1));
    expect(requestsTo("POST", `/api/admin/${api}`)[0]!.body).toEqual({ title: "Curiosity", body: "Ask why twice.", is_published: false });

    const items = within(list).getAllByRole("listitem");
    await user.click(within(items[0]!).getByRole("button", { name: /down$/ }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/${api}/order`)).toHaveLength(1));

    await user.click(within(items[1]!).getByRole("button", { name: /^Delete / }));
    await user.click(screen.getByRole("button", { name: `Delete ${noun}` }));
    await waitFor(() => expect(requestsTo("DELETE", new RegExp(`/api/admin/${api}/.+`))).toHaveLength(1));
  });
});

describe("UI-T-094 / UI-T-081 side-panel unsaved-changes guard", () => {
  it("dirty panel: Close and switching item ask first; Keep editing keeps the edit; Discard switches; navigation is guarded", async () => {
    const { user, router } = await renderAdminPage("/admin/services", "Services");
    const list = await screen.findByRole("list", { name: "Services in display order" });
    const [s1, s2] = [db.services[0]!, db.services[1]!];

    // A clean panel closes and switches without asking.
    await user.click(within(list).getByRole("button", { name: `Edit ${s1.name}` }));
    await user.click(within(list).getByRole("button", { name: `Edit ${s2.name}` }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(within(panel()).getByLabelText(/^Name/)).toHaveValue(s2.name);

    await user.type(within(panel()).getByLabelText(/^Name/), " (draft)");
    await user.click(within(panel()).getByRole("button", { name: "Close" }));
    let dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(within(panel()).getByLabelText(/^Name/)).toHaveValue(`${s2.name} (draft)`);

    await user.click(within(list).getByRole("button", { name: `Edit ${s1.name}` }));
    dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(within(panel()).getByLabelText(/^Name/)).toHaveValue(`${s2.name} (draft)`);

    await user.click(within(screen.getByRole("navigation", { name: "Admin" })).getByRole("link", { name: "Values" }));
    dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await user.click(within(dialog).getByRole("button", { name: "Stay on page" }));
    expect(router.state.location.pathname).toBe("/admin/services");

    await user.click(within(list).getByRole("button", { name: `Edit ${s1.name}` }));
    dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));
    expect(within(panel()).getByLabelText(/^Name/)).toHaveValue(s1.name);
    await waitFor(() => expect(document.activeElement).toHaveTextContent("Edit service"));

    // Clean again: Close needs no confirmation and navigation is free.
    await user.click(within(panel()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("region", { name: /^(New|Edit) / })).toBeNull();
    await user.click(within(screen.getByRole("navigation", { name: "Admin" })).getByRole("link", { name: "Values" }));
    await screen.findByRole("heading", { level: 1, name: "Values" });
  });

  it("a successful save closes the dirty panel without asking", async () => {
    const { user } = await renderAdminPage("/admin/services", "Services");
    const list = await screen.findByRole("list", { name: "Services in display order" });
    const s1 = db.services[0]!;
    await user.click(within(list).getByRole("button", { name: `Edit ${s1.name}` }));
    await user.type(within(panel()).getByLabelText(/^Name/), "!");
    await user.click(within(panel()).getByRole("button", { name: "Save" }));
    await findInRegion(`Saved “${s1.name}!”.`, "status");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("region", { name: /^(New|Edit) / })).toBeNull();
  });
});

describe("UI-T-094 / UI-040 re-opening the same panel after Discard remounts the form", () => {
  it("dirty 'new' panel → New service → Discard: fields are empty, Close does not ask; re-dirtied panel is guarded", async () => {
    const { user, router } = await renderAdminPage("/admin/services", "Services");
    await screen.findByRole("list", { name: "Services in display order" });
    await user.click(screen.getAllByRole("button", { name: "New service" })[0]!);
    await user.type(within(panel()).getByLabelText(/^Name/), "Draft");

    await user.click(screen.getAllByRole("button", { name: "New service" })[0]!);
    let dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));
    expect(within(panel()).getByLabelText(/^Name/)).toHaveValue("");

    await user.click(within(panel()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("region", { name: /^(New|Edit) / })).toBeNull();

    // Same identity again: the remounted form reports dirty again, so Close and navigation are guarded.
    await user.click(screen.getAllByRole("button", { name: "New service" })[0]!);
    await user.type(within(panel()).getByLabelText(/^Name/), "Again");
    await user.click(screen.getAllByRole("button", { name: "New service" })[0]!);
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
    await user.type(within(panel()).getByLabelText(/^Name/), "Third");
    await user.click(within(panel()).getByRole("button", { name: "Close" }));
    dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    await user.click(within(screen.getByRole("navigation", { name: "Admin" })).getByRole("link", { name: "Values" }));
    dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await user.click(within(dialog).getByRole("button", { name: "Stay on page" }));
    expect(router.state.location.pathname).toBe("/admin/services");
    expect(within(panel()).getByLabelText(/^Name/)).toHaveValue("Third");
  });

  it("dirty edit panel → Edit on the same item → Discard: the saved values are back", async () => {
    const { user } = await renderAdminPage("/admin/services", "Services");
    const list = await screen.findByRole("list", { name: "Services in display order" });
    const s1 = db.services[0]!;
    await user.click(within(list).getByRole("button", { name: `Edit ${s1.name}` }));
    await user.type(within(panel()).getByLabelText(/^Name/), " (draft)");
    await user.click(within(list).getByRole("button", { name: `Edit ${s1.name}` }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
    expect(within(panel()).getByLabelText(/^Name/)).toHaveValue(s1.name);
    await user.click(within(panel()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
