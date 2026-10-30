import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderAdminPage, setupAdminServer } from "@/test/admin-render";
import { CATEGORY_NOT_EMPTY } from "./FaqsPage";

setupAdminServer();

const category = (name: string) => screen.getByRole("region", { name: `Category ${name}` });
const faqList = (name: string) => within(category(name)).getByRole("list", { name: `FAQs in ${name}` });

describe("UI-T-097 FAQ categories and FAQs", () => {
  it("delete non-empty category → 409 message, category stays", async () => {
    const { user } = await renderAdminPage("/admin/faqs", "FAQs");
    await screen.findByRole("list", { name: "FAQ categories in display order" });
    expect(screen.getByText("6 FAQs shown in previews")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete category Category 1" }));
    await user.click(screen.getByRole("button", { name: "Delete category" }));
    await findInRegion(CATEGORY_NOT_EMPTY);
    expect(category("Category 1")).toBeInTheDocument();
    expect(db.faqCategories).toHaveLength(4);
  });

  it("move an FAQ to another category → PUT with new category_id; it appears at the end of the target", async () => {
    const { user } = await renderAdminPage("/admin/faqs", "FAQs");
    await screen.findByRole("list", { name: "FAQ categories in display order" });
    const faq = db.faqs[0]!;
    await user.click(within(faqList("Category 1")).getByRole("button", { name: `Edit ${faq.question}` }));
    const panel = screen.getByRole("region", { name: "Edit FAQ" });
    await user.selectOptions(within(panel).getByLabelText(/^Category/), db.faqCategories[1]!.id);
    await user.click(within(panel).getByRole("button", { name: "Save" }));
    await findInRegion("FAQ moved to the end of its new category.", "status");
    expect(requestsTo("PUT", `/api/admin/faqs/${faq.id}`)[0]!.body).toMatchObject({ category_id: db.faqCategories[1]!.id });
    await waitFor(() => {
      const items = within(faqList("Category 2")).getAllByRole("listitem");
      expect(items).toHaveLength(5);
      expect(items[4]).toHaveTextContent(faq.question);
    });
    expect(within(faqList("Category 1")).getAllByRole("listitem")).toHaveLength(3);
  });

  it("toggle 'Show in preview' updates the preview count", async () => {
    const { user } = await renderAdminPage("/admin/faqs", "FAQs");
    await screen.findByText("6 FAQs shown in previews");
    const faq = db.faqs[8]!;
    await user.click(screen.getByRole("button", { name: `Edit ${faq.question}` }));
    const panel = screen.getByRole("region", { name: "Edit FAQ" });
    await user.click(within(panel).getByRole("checkbox", { name: "Show in preview" }));
    await user.click(within(panel).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("7 FAQs shown in previews")).toBeInTheDocument();
  });

  it("reorder within a category sends { category_id, ids }", async () => {
    const { user } = await renderAdminPage("/admin/faqs", "FAQs");
    await screen.findByRole("list", { name: "FAQ categories in display order" });
    const inCat = db.faqs.filter((f) => f.category_id === db.faqCategories[2]!.id);
    await user.click(within(faqList("Category 3")).getByRole("button", { name: `Move ${inCat[0]!.question} down` }));
    await waitFor(() => expect(requestsTo("PUT", "/api/admin/faqs/order")).toHaveLength(1));
    expect(requestsTo("PUT", "/api/admin/faqs/order")[0]!.body).toEqual({
      category_id: db.faqCategories[2]!.id,
      ids: [inCat[1]!.id, inCat[0]!.id, inCat[2]!.id, inCat[3]!.id],
    });
    expect(within(faqList("Category 3")).getAllByRole("listitem")[1]).toHaveTextContent(inCat[0]!.question);
  });

  it("no categories → create-a-category-first empty state; category without FAQs message", async () => {
    db.faqs = db.faqs.filter((f) => f.category_id !== db.faqCategories[3]!.id);
    await renderAdminPage("/admin/faqs", "FAQs");
    expect(await within(await screen.findByRole("region", { name: "Category Category 4" })).findByText("No FAQs in this category")).toBeInTheDocument();
  });

  it("empty: no categories", async () => {
    db.faqCategories = [];
    db.faqs = [];
    await renderAdminPage("/admin/faqs", "FAQs");
    expect(await screen.findByText("No FAQ categories yet")).toBeInTheDocument();
  });
});

describe("UI-T-097 / UI-T-081 FAQ panels: unsaved-changes guard", () => {
  it("a dirty FAQ panel asks before switching to the category panel; Discard switches", async () => {
    const { user } = await renderAdminPage("/admin/faqs", "FAQs");
    await screen.findByRole("list", { name: "FAQ categories in display order" });
    const faq = db.faqs[0]!;
    await user.click(within(faqList("Category 1")).getByRole("button", { name: `Edit ${faq.question}` }));
    const panel = screen.getByRole("region", { name: "Edit FAQ" });
    await user.type(within(panel).getByLabelText(/^Question/), "?");
    await user.click(screen.getByRole("button", { name: "Edit category Category 2" }));
    const dialog = screen.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("region", { name: "Edit FAQ" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Edit category" })).getByLabelText(/^Name/)).toHaveValue("Category 2");
  });
});
