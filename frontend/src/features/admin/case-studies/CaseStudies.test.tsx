import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db, requestsTo } from "@/test/admin-handlers";
import { adminCaseStudy, result } from "@/test/admin-fixtures";
import { findInRegion, pasteInto, renderAdminPage, setupAdminServer } from "@/test/admin-render";
import { ADD_ALT_BEFORE_SAVING } from "./schema";

setupAdminServer();

const listEl = () => screen.getByRole("list", { name: "Case studies in display order" });

describe("UI-T-087 case studies list", () => {
  it("6 rows in order with chips, edit links and a create action", async () => {
    await renderAdminPage("/admin/case-studies", "Case studies");
    await screen.findByRole("list", { name: "Case studies in display order" });
    const rows = within(listEl()).getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.querySelector("p")?.textContent)).toEqual(db.caseStudies.map((c) => c.title));
    const first = rows[0]!;
    expect(within(first).getByText("Published")).toBeInTheDocument();
    expect(within(first).getByText("Featured")).toBeInTheDocument();
    expect(within(first).getByText("Sample")).toBeInTheDocument();
    expect(within(rows[5]!).queryByText("Featured")).toBeNull();
    expect(within(first).getByRole("link", { name: `Edit ${db.caseStudies[0]!.title}` })).toHaveAttribute("href", `/admin/case-studies/${db.caseStudies[0]!.id}`);
    expect(screen.getByRole("link", { name: "New case study" })).toHaveAttribute("href", "/admin/case-studies/new");
  });

  it("0 rows → empty state with create action", async () => {
    db.caseStudies = [];
    await renderAdminPage("/admin/case-studies", "Case studies");
    expect(await screen.findByText("No case studies yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New case study" })).toHaveLength(2);
  });

  it("delete: confirmation mentions results and gallery; then DELETE and the list refreshes", async () => {
    const { user } = await renderAdminPage("/admin/case-studies", "Case studies");
    await screen.findByRole("list", { name: "Case studies in display order" });
    const target = db.caseStudies[1]!;
    await user.click(screen.getByRole("button", { name: `Delete ${target.title}` }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete this case study?" });
    expect(dialog).toHaveTextContent(/results and gallery entries/);
    expect(dialog).toHaveTextContent(target.title);
    await user.click(within(dialog).getByRole("button", { name: "Delete case study" }));
    await findInRegion(`Deleted “${target.title}”.`, "status");
    await waitFor(() => expect(within(listEl()).getAllByRole("listitem")).toHaveLength(5));
    expect(requestsTo("DELETE", `/api/admin/case-studies/${target.id}`)).toHaveLength(1);
  });
});

/** Required fields that UI-T-088 does not examine: filled by paste (one input event each) to keep the test fast. */
async function fillRequired(user: Awaited<ReturnType<typeof renderAdminPage>>["user"]) {
  await pasteInto(user, screen.getByLabelText(/^Client name/), "Harbour Tea Co.");
  await pasteInto(user, screen.getByLabelText(/^Client industry/), "Food and drink");
  await pasteInto(user, screen.getByLabelText(/^Campaign type/), "Launch");
  await pasteInto(user, screen.getByLabelText(/^Timeline/), "3 months");
  await pasteInto(user, screen.getByLabelText(/^Year/), "2026");
  await pasteInto(user, screen.getByLabelText(/^Summary/), "A short summary.");
  await pasteInto(user, screen.getByRole("textbox", { name: /^The problem/ }), "Problem text");
  await pasteInto(user, screen.getByRole("textbox", { name: /^The solution/ }), "Solution text");
}

describe("UI-T-088 case-study create", () => {
  it("slug follows the title until edited; invalid slug error; 201 → /:id with tabs enabled", async () => {
    const { user, router } = await renderAdminPage("/admin/case-studies/new", "New case study");
    expect(screen.getByRole("tab", { name: "Results" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Gallery" })).toBeDisabled();
    expect(screen.getByText("Save the case study first to add results and gallery images.")).toBeInTheDocument();

    const title = screen.getByLabelText(/^Title/);
    const slug = screen.getByLabelText(/^Slug/);
    await user.type(title, "Spring Launch Plan");
    expect(slug).toHaveValue("spring-launch-plan");
    expect(screen.getByText(/Public address: \/work\/spring-launch-plan/)).toBeInTheDocument();

    await user.clear(slug);
    await user.type(slug, "Bad Slug");
    await user.type(title, " Two");
    expect(slug).toHaveValue("Bad Slug");
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Create case study" }));
    expect(slug).toHaveAccessibleDescription(/Use lowercase letters, numbers and single hyphens only/);
    expect(document.activeElement).toBe(slug);
    expect(requestsTo("POST", "/api/admin/case-studies")).toHaveLength(0);

    await user.clear(slug);
    await user.type(slug, "spring-launch-plan");
    await user.click(screen.getByRole("button", { name: "Create case study" }));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/admin\/case-studies\/[0-9a-f-]{36}$/));
    const body = requestsTo("POST", "/api/admin/case-studies")[0]!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      title: "Spring Launch Plan Two",
      slug: "spring-launch-plan",
      year: 2026,
      channels: [],
      cover_media_id: null,
      cover_alt: null,
      is_published: false,
    });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Results" })).toBeEnabled());
    expect(screen.getByRole("tab", { name: "Gallery" })).toBeEnabled();
  });
});

describe("UI-T-089 case-study edit", () => {
  it("409 slug_taken → slug field error", async () => {
    const cs = db.caseStudies[0]!;
    const { user } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    const slug = screen.getByLabelText(/^Slug/);
    await user.clear(slug);
    await user.type(slug, db.caseStudies[1]!.slug);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(slug).toHaveAccessibleDescription(/This slug is already used by another case study\./));
    expect(document.activeElement).toBe(slug);
  });

  it("publish toggle → PUT body has is_published (full replace) and a success toast", async () => {
    db.caseStudies[0] = adminCaseStudy(1, { is_published: false });
    const cs = db.caseStudies[0];
    const { user } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    await user.click(screen.getByRole("checkbox", { name: "Published" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await findInRegion("Changes saved.", "status");
    const body = requestsTo("PUT", `/api/admin/case-studies/${cs.id}`)[0]!.body as Record<string, unknown>;
    expect(body.is_published).toBe(true);
    expect(Object.keys(body).sort()).toEqual(
      [
        "slug", "title", "client_name", "client_industry", "campaign_type", "channels", "goals", "summary", "problem_md",
        "solution_md", "year", "timeline", "cover_media_id", "cover_alt", "is_featured", "is_published", "is_sample",
      ].sort(),
    );
  });

  it("Clear sample flags with 2 flagged results → one case-study PUT and 2 result PUTs, success toast", async () => {
    db.caseStudies[0] = adminCaseStudy(1, {
      is_sample: true,
      results: [result(1, 1, { is_sample: true }), result(1, 2, { is_sample: false }), result(1, 3, { is_sample: true })],
    });
    const cs = db.caseStudies[0];
    const { user } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    await user.click(screen.getByRole("button", { name: "Clear sample flags" }));
    const dialog = screen.getByRole("alertdialog", { name: "Clear sample flags?" });
    expect(dialog).toHaveTextContent("2 flagged results");
    await user.click(within(dialog).getByRole("button", { name: "Clear sample flags" }));
    await findInRegion("Sample flags cleared.", "status");
    expect(requestsTo("PUT", `/api/admin/case-studies/${cs.id}`)).toHaveLength(1);
    expect((requestsTo("PUT", `/api/admin/case-studies/${cs.id}`)[0]!.body as { is_sample: boolean }).is_sample).toBe(false);
    const resultPuts = requestsTo("PUT", /\/results\/[^/]+$/);
    expect(resultPuts.map((r) => r.path.split("/").pop())).toEqual([cs.results[0]!.id, cs.results[2]!.id]);
    expect(resultPuts.every((r) => (r.body as { is_sample: boolean }).is_sample === false)).toBe(true);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Clear sample flags" })).toBeNull());
  });

  it("unknown id → not-found state", async () => {
    await renderAdminPage("/admin/case-studies/00000000-0000-4000-8000-999999999999", "Edit case study");
    expect(await screen.findByText("This item no longer exists")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Back to case studies" }).length).toBeGreaterThan(0);
  });
});

describe("UI-T-090 results editor", () => {
  it("add with empty label → errors; valid add; edit; delete; reorder — right operations and ids", async () => {
    const cs = db.caseStudies[0]!;
    const { user } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    await user.click(screen.getByRole("tab", { name: "Results" }));
    await user.click(screen.getByRole("button", { name: "Add result" }));
    const form = screen.getByRole("form", { name: "New result" });
    await user.click(within(form).getByRole("button", { name: "Add result" }));
    expect(within(form).getByLabelText(/^Metric label/)).toHaveAccessibleDescription(/Enter a metric label\./);
    expect(requestsTo("POST", `/api/admin/case-studies/${cs.id}/results`)).toHaveLength(0);

    await user.type(within(form).getByLabelText(/^Metric label/), "Open rate");
    await user.type(within(form).getByLabelText(/^Value/), "48%");
    await user.click(within(form).getByRole("button", { name: "Add result" }));
    await findInRegion("Result added.", "status");
    expect(requestsTo("POST", `/api/admin/case-studies/${cs.id}/results`)[0]!.body).toEqual({
      metric_label: "Open rate",
      value: "48%",
      before_value: null,
      change_text: null,
      period: null,
      is_sample: false,
    });
    const list = await screen.findByRole("list", { name: "Results in display order" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(4));

    const r1 = cs.results[0]!;
    await user.click(within(list).getByRole("button", { name: `Edit ${r1.metric_label}` }));
    const edit = screen.getByRole("form", { name: `Edit result ${r1.metric_label}` });
    await user.clear(within(edit).getByLabelText(/^Value/));
    await user.type(within(edit).getByLabelText(/^Value/), "99%");
    await user.click(within(edit).getByRole("button", { name: "Save result" }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/case-studies/${cs.id}/results/${r1.id}`)).toHaveLength(1));

    await user.click(within(list).getByRole("button", { name: `Move ${cs.results[1]!.metric_label} up` }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/case-studies/${cs.id}/results/order`)).toHaveLength(1));
    const ids = (requestsTo("PUT", `/api/admin/case-studies/${cs.id}/results/order`)[0]!.body as { ids: string[] }).ids;
    expect(ids.slice(0, 2)).toEqual([cs.results[1]!.id, cs.results[0]!.id]);
    expect(ids).toHaveLength(4);

    await user.click(within(list).getByRole("button", { name: `Delete ${cs.results[2]!.metric_label}` }));
    await user.click(screen.getByRole("button", { name: "Delete result" }));
    await waitFor(() => expect(requestsTo("DELETE", `/api/admin/case-studies/${cs.id}/results/${cs.results[2]!.id}`)).toHaveLength(1));
  });

  it("no results → empty state", async () => {
    db.caseStudies[0] = adminCaseStudy(1, { results: [], is_sample: false });
    const { user } = await renderAdminPage(`/admin/case-studies/${db.caseStudies[0].id}`, db.caseStudies[0].title);
    await user.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByText("No results yet")).toBeInTheDocument();
  });
});

describe("UI-T-091 gallery editor", () => {
  it("add without alt blocked; with alt + half → create with layout; preview classes; reorder and delete", async () => {
    const cs = db.caseStudies[0]!;
    const { user } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    await user.click(screen.getByRole("tab", { name: "Gallery" }));
    const preview = screen.getByRole("list", { name: "Gallery layout preview" });
    expect(Array.from(preview.children).map((li) => li.getAttribute("data-layout"))).toEqual(["full", "half", "half"]);
    expect(preview.children[0]).toHaveClass("previewFull");
    expect(preview.children[1]).toHaveClass("previewHalf");

    await user.click(screen.getByRole("button", { name: "Add image" }));
    const dialog = screen.getByRole("dialog", { name: "Choose image" });
    await user.click(within(dialog).getByRole("tab", { name: "Library" }));
    await user.click(await within(dialog).findByRole("button", { name: "Choose asset-4.png, 1600 × 900" }));
    const form = screen.getByRole("form", { name: "New gallery image" });
    expect(within(form).getByText(ADD_ALT_BEFORE_SAVING)).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Save image" })).toBeDisabled();

    await user.type(within(form).getByLabelText(/^Alt text/), "Campaign poster on a wall");
    await user.click(within(form).getByRole("radio", { name: "Half width" }));
    expect(within(form).queryByText(ADD_ALT_BEFORE_SAVING)).toBeNull();
    await user.click(within(form).getByRole("button", { name: "Save image" }));
    await findInRegion("Image added to the gallery.", "status");
    expect(requestsTo("POST", `/api/admin/case-studies/${cs.id}/images`)[0]!.body).toEqual({
      media_id: db.media[3]!.id,
      alt: "Campaign poster on a wall",
      caption: null,
      layout: "half",
    });

    const list = screen.getByRole("list", { name: "Gallery images in display order" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(4));
    await user.click(within(list).getByRole("button", { name: `Move ${cs.images[0]!.alt} down` }));
    await waitFor(() => expect(requestsTo("PUT", `/api/admin/case-studies/${cs.id}/images/order`)).toHaveLength(1));

    await user.click(within(list).getByRole("button", { name: `Delete ${cs.images[1]!.alt}` }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("The image stays in the media library");
    await user.click(screen.getByRole("button", { name: "Remove image" }));
    await waitFor(() => expect(requestsTo("DELETE", `/api/admin/case-studies/${cs.id}/images/${cs.images[1]!.id}`)).toHaveLength(1));
  });
});

describe("UI-T-081 / UI-REV-008 case-study editor tabs keep unsaved edits", () => {
  it("all three panels exist (aria-controls targets), inactive ones hidden; a title edit survives a tab round trip", async () => {
    const cs = db.caseStudies[0]!;
    const { user } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    const tabs = within(screen.getByRole("tablist", { name: "Case study sections" })).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute("aria-controls")!);
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute("role", "tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", tab.id);
      expect(panel!.hidden).toBe(tab.getAttribute("aria-selected") !== "true");
    }

    const title = screen.getByLabelText(/^Title/);
    await user.clear(title);
    await user.type(title, "Edited title");
    await user.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByRole("tabpanel", { name: "Results" })).toBeVisible();
    expect(screen.queryByRole("form", { name: "Case study details" })).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Edited title");
  });

  it("the leave-page guard still fires for an unsaved Details edit while another tab is shown", async () => {
    const cs = db.caseStudies[0]!;
    const { user, router } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    await user.type(screen.getByLabelText(/^Title/), " (draft)");
    await user.click(screen.getByRole("tab", { name: "Gallery" }));
    await user.click(within(screen.getByRole("navigation", { name: "Admin" })).getByRole("link", { name: "Services" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await user.click(within(dialog).getByRole("button", { name: "Stay on page" }));
    expect(router.state.location.pathname).toBe(`/admin/case-studies/${cs.id}`);
    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue(`${cs.title} (draft)`);
  });

  it("an unsaved result row asks before Cancel or editing another result, and guards navigation", async () => {
    const cs = db.caseStudies[0]!;
    const { user, router } = await renderAdminPage(`/admin/case-studies/${cs.id}`, cs.title);
    await user.click(screen.getByRole("tab", { name: "Results" }));
    const list = screen.getByRole("list", { name: "Results in display order" });
    const [r1, r2] = [cs.results[0]!, cs.results[1]!];
    await user.click(within(list).getByRole("button", { name: `Edit ${r1.metric_label}` }));
    const edit = screen.getByRole("form", { name: `Edit result ${r1.metric_label}` });
    await user.type(within(edit).getByLabelText(/^Period/), "x");

    await user.click(within(list).getByRole("button", { name: `Edit ${r2.metric_label}` }));
    let dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("form", { name: `Edit result ${r1.metric_label}` })).toBeInTheDocument();

    await user.click(within(screen.getByRole("navigation", { name: "Admin" })).getByRole("link", { name: "Services" }));
    dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await user.click(within(dialog).getByRole("button", { name: "Stay on page" }));
    expect(router.state.location.pathname).toBe(`/admin/case-studies/${cs.id}`);

    await user.click(within(screen.getByRole("form", { name: `Edit result ${r1.metric_label}` })).getByRole("button", { name: "Cancel" }));
    dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("form", { name: `Edit result ${r1.metric_label}` })).toBeNull();
    await user.click(within(list).getByRole("button", { name: `Edit ${r2.metric_label}` }));
    expect(screen.getByRole("form", { name: `Edit result ${r2.metric_label}` })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
