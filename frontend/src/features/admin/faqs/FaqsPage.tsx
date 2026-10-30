/**
 * FAQ categories and FAQs `/admin/faqs` (UI-052, REQ-064, REQ-006, REQ-041).
 * - Categories as a `ReorderableList`; each holds its FAQs as a nested `ReorderableList` (reorder within the
 *   category; body `{ category_id, ids }`).
 * - Category panel: name (unique, ≤ 80), Published. FAQ panel: category (changing it moves the FAQ to the end of the
 *   target category), question (≤ 200), answer (plain text ≤ 2000; blank line = new paragraph), Show in preview,
 *   Published. Shows the count of preview FAQs.
 * - Deleting a non-empty category → 409 `category_not_empty` → "Move or delete the FAQs in this category first."
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "@/shared/zod/classic";
import { Button } from "@/shared/ui/Button/Button";
import { StatusChip } from "@/shared/ui/Chip/Chip";
import { faqApi } from "../api/admin-api";
import { isApiError } from "../api/errors";
import { adminKeys } from "../api/query";
import type { AdminFaq, AdminFaqCategory } from "../api/types";
import { ConfirmDialog } from "../ui/Dialog";
import { CheckboxField, FormAlert, SelectField, TextAreaField, TextField } from "../ui/fields";
import { PublishChips } from "../ui/PublishChips";
import { ReorderableList, useListReorder, useReorder } from "../ui/ReorderableList";
import { requiredText } from "../ui/schema";
import { useServerErrors } from "../ui/server-errors";
import { SidePanel, useGuardedPanel } from "../ui/SidePanel";
import { AdminPage, EmptyState, errorMessage, ErrorState, LoadingState } from "../ui/states";
import { useToast } from "../ui/Toast";
import { useReportDirty } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";
import caseStyles from "../case-studies/CaseStudies.module.css";
import styles from "./FaqsPage.module.css";

export const CATEGORY_NOT_EMPTY = "Move or delete the FAQs in this category first.";

export function previewCountText(count: number): string {
  return `${count} ${count === 1 ? "FAQ" : "FAQs"} shown in previews`;
}

const categorySchema = z.object({ name: requiredText(80, "Enter a category name."), is_published: z.boolean() });
type CategoryValues = z.input<typeof categorySchema>;

const faqSchema = z.object({
  category_id: z.string().min(1, "Choose a category."),
  question: requiredText(200, "Enter the question."),
  answer: requiredText(2000, "Write the answer."),
  show_in_preview: z.boolean(),
  is_published: z.boolean(),
});
type FaqValues = z.input<typeof faqSchema>;

type Panel =
  | { kind: "category"; category?: AdminFaqCategory }
  | { kind: "faq"; faq?: AdminFaq; categoryId: string };

function useInvalidateFaqs() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.faqCategories });
    void queryClient.invalidateQueries({ queryKey: adminKeys.faqs });
    void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
  }, [queryClient]);
}

interface PanelCallbacks {
  onClose: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function CategoryPanel({ category, onClose, onSaved, onDirtyChange }: { category?: AdminFaqCategory } & PanelCallbacks) {
  const toast = useToast();
  const invalidate = useInvalidateFaqs();
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: category?.name ?? "", is_published: category?.is_published ?? true },
  });
  const serverErrors = useServerErrors(form, ["name", "is_published"]);
  useReportDirty(form.formState.isDirty, onDirtyChange);
  const save = useMutation({
    mutationFn: (body: CategoryValues) => (category ? faqApi.updateCategory(category.id, body) : faqApi.createCategory(body)),
    onSuccess: (saved) => {
      toast.success(category ? `Saved “${saved.name}”.` : `Created “${saved.name}”.`);
      invalidate();
      onSaved();
    },
    onError: (error) => serverErrors.handle(error),
  });
  return (
    <SidePanel title={category ? "Edit category" : "New category"} onClose={onClose}>
      {(headingId) => (
        <FormProvider {...form}>
          <form
            className={kit.form}
            noValidate
            aria-labelledby={headingId}
            onSubmit={form.handleSubmit((values) => {
              serverErrors.clear();
              save.mutate(values);
            })}
          >
            <FormAlert message={serverErrors.formError} />
            <TextField name="name" label="Name" required counterMax={80} hint="Each category name must be unique." />
            <CheckboxField name="is_published" label="Published" />
            <div className={kit.formFooter}>
              <Button type="submit" loading={save.isPending}>
                {category ? "Save" : "Create category"}
              </Button>
              <button type="button" className={kit.smallButton} onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </FormProvider>
      )}
    </SidePanel>
  );
}

function FaqPanel({
  faq,
  categoryId,
  categories,
  onClose,
  onSaved,
  onDirtyChange,
}: { faq?: AdminFaq; categoryId: string; categories: AdminFaqCategory[] } & PanelCallbacks) {
  const toast = useToast();
  const invalidate = useInvalidateFaqs();
  const form = useForm<FaqValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      category_id: faq?.category_id ?? categoryId,
      question: faq?.question ?? "",
      answer: faq?.answer ?? "",
      show_in_preview: faq?.show_in_preview ?? false,
      is_published: faq?.is_published ?? true,
    },
  });
  const serverErrors = useServerErrors(form, ["category_id", "question", "answer", "show_in_preview", "is_published"]);
  useReportDirty(form.formState.isDirty, onDirtyChange);
  const save = useMutation({
    mutationFn: (body: FaqValues) => (faq ? faqApi.updateFaq(faq.id, body) : faqApi.createFaq(body)),
    onSuccess: (saved) => {
      const moved = faq !== undefined && saved.category_id !== faq.category_id;
      toast.success(moved ? "FAQ moved to the end of its new category." : faq ? "FAQ saved." : "FAQ added.");
      invalidate();
      onSaved();
    },
    onError: (error) => serverErrors.handle(error),
  });
  return (
    <SidePanel title={faq ? "Edit FAQ" : "New FAQ"} onClose={onClose}>
      {(headingId) => (
        <FormProvider {...form}>
          <form
            className={kit.form}
            noValidate
            aria-labelledby={headingId}
            onSubmit={form.handleSubmit((values) => {
              serverErrors.clear();
              save.mutate(values);
            })}
          >
            <FormAlert message={serverErrors.formError} />
            <SelectField
              name="category_id"
              label="Category"
              required
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              hint={faq ? "Changing the category moves the FAQ to the end of that category." : undefined}
            />
            <TextField name="question" label="Question" required counterMax={200} />
            <TextAreaField name="answer" label="Answer" required counterMax={2000} rows={6} hint="Plain text. Leave a blank line to start a new paragraph." />
            <div className={kit.checks}>
              <CheckboxField name="show_in_preview" label="Show in preview" />
              <CheckboxField name="is_published" label="Published" />
            </div>
            <div className={kit.formFooter}>
              <Button type="submit" loading={save.isPending}>
                {faq ? "Save" : "Add FAQ"}
              </Button>
              <button type="button" className={kit.smallButton} onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </FormProvider>
      )}
    </SidePanel>
  );
}

function CategoryFaqs({ category, faqs, onEdit, onDelete }: { category: AdminFaqCategory; faqs: AdminFaq[]; onEdit: (faq: AdminFaq) => void; onDelete: (faq: AdminFaq) => void }) {
  const queryClient = useQueryClient();
  const read = useCallback(
    () => queryClient.getQueryData<AdminFaq[]>(adminKeys.faqs)?.filter((f) => f.category_id === category.id),
    [queryClient, category.id],
  );
  const write = useCallback(
    (ordered: AdminFaq[]) =>
      queryClient.setQueryData<AdminFaq[]>(adminKeys.faqs, (all) => {
        if (!all) return all;
        const queue = [...ordered];
        return all.map((f) => (f.category_id === category.id ? (queue.shift() ?? f) : f));
      }),
    [queryClient, category.id],
  );
  const send = useCallback((ids: string[]) => faqApi.reorderFaqs(category.id, ids), [category.id]);
  const reorder = useReorder<AdminFaq>({ read, write, refetchKey: adminKeys.faqs, getId: (f) => f.id, getTitle: (f) => f.question, send });

  if (faqs.length === 0) return <p className={kit.muted}>No FAQs in this category</p>;
  return (
    <ReorderableList
      label={`FAQs in ${category.name}`}
      items={faqs}
      getId={(f) => f.id}
      getTitle={(f) => f.question}
      onMove={reorder.move}
      saving={reorder.saving}
      announcement={reorder.announcement}
      renderItem={(faq) => (
        <div className={caseStyles.row}>
          <div className={caseStyles.rowText}>
            <p className={caseStyles.rowTitle}>{faq.question}</p>
            <span className={kit.chips}>
              <PublishChips published={faq.is_published} />
              {faq.show_in_preview && <StatusChip tone="neutral">In preview</StatusChip>}
            </span>
          </div>
          <div className={kit.actions}>
            <button type="button" className={kit.smallButton} onClick={() => onEdit(faq)} aria-label={`Edit ${faq.question}`}>
              Edit
            </button>
            <button type="button" className={`${kit.smallButton} ${kit.dangerButton}`} onClick={() => onDelete(faq)} aria-label={`Delete ${faq.question}`}>
              Delete
            </button>
          </div>
        </div>
      )}
    />
  );
}

type PendingDelete = { kind: "category"; category: AdminFaqCategory } | { kind: "faq"; faq: AdminFaq };

export function FaqsPage() {
  const toast = useToast();
  const invalidate = useInvalidateFaqs();
  const panels = useGuardedPanel<Panel>();
  const { panel, open } = panels;
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const categories = useQuery({ queryKey: adminKeys.faqCategories, queryFn: faqApi.listCategories });
  const faqs = useQuery({ queryKey: adminKeys.faqs, queryFn: () => faqApi.listFaqs() });
  const reorderCategories = useListReorder<AdminFaqCategory>({
    queryKey: adminKeys.faqCategories,
    getId: (c) => c.id,
    getTitle: (c) => c.name,
    send: faqApi.reorderCategories,
  });

  const remove = useMutation({
    mutationFn: (target: PendingDelete) => (target.kind === "category" ? faqApi.removeCategory(target.category.id) : faqApi.removeFaq(target.faq.id)),
    onSuccess: (_d, target) => {
      setPendingDelete(null);
      toast.success(target.kind === "category" ? `Deleted the category “${target.category.name}”.` : "FAQ deleted.");
      invalidate();
    },
    onError: (error) => {
      setPendingDelete(null);
      if (isApiError(error) && error.code === "category_not_empty") setRefusal(CATEGORY_NOT_EMPTY);
      else toast.error(errorMessage(error));
    },
  });

  const newCategory = (
    <button type="button" className={kit.smallButton} onClick={() => open({ kind: "category" })}>
      New category
    </button>
  );
  const allFaqs = faqs.data ?? [];
  const previewCount = allFaqs.filter((f) => f.show_in_preview && f.is_published).length;
  const isPending = categories.isPending || faqs.isPending;
  const error = categories.error ?? faqs.error;

  return (
    <AdminPage title="FAQs" actions={newCategory}>
      {refusal && (
        <p role="alert" className={kit.formAlert}>
          {refusal}
        </p>
      )}
      {!isPending && !error && <p className={kit.hint}>{previewCountText(previewCount)}</p>}
      <div className={kit.split} data-panel-open={panel ? "" : undefined}>
        <div>
          {isPending && <LoadingState />}
          {error && (
            <ErrorState
              error={error}
              onRetry={() => {
                void categories.refetch();
                void faqs.refetch();
              }}
            />
          )}
          {categories.data && faqs.data && categories.data.length === 0 && (
            <EmptyState title="No FAQ categories yet" body="Create a category first, then add questions to it." action={newCategory} />
          )}
          {categories.data && faqs.data && categories.data.length > 0 && (
            <ReorderableList
              label="FAQ categories in display order"
              items={categories.data}
              getId={(c) => c.id}
              getTitle={(c) => c.name}
              onMove={reorderCategories.move}
              saving={reorderCategories.saving}
              announcement={reorderCategories.announcement}
              renderItem={(category) => (
                <section className={styles.category} aria-label={`Category ${category.name}`}>
                  <div className={caseStyles.row}>
                    <div className={caseStyles.rowText}>
                      <h2 className={styles.categoryName}>{category.name}</h2>
                      <PublishChips published={category.is_published} />
                    </div>
                    <div className={kit.actions}>
                      <button type="button" className={kit.smallButton} onClick={() => open({ kind: "faq", categoryId: category.id })} aria-label={`Add FAQ to ${category.name}`}>
                        Add FAQ
                      </button>
                      <button type="button" className={kit.smallButton} onClick={() => open({ kind: "category", category })} aria-label={`Edit category ${category.name}`}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${kit.smallButton} ${kit.dangerButton}`}
                        onClick={() => {
                          setRefusal(null);
                          setPendingDelete({ kind: "category", category });
                        }}
                        aria-label={`Delete category ${category.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <CategoryFaqs
                    category={category}
                    faqs={allFaqs.filter((f) => f.category_id === category.id)}
                    onEdit={(faq) => open({ kind: "faq", faq, categoryId: faq.category_id })}
                    onDelete={(faq) => setPendingDelete({ kind: "faq", faq })}
                  />
                </section>
              )}
            />
          )}
        </div>
        {panel?.kind === "category" && (
          <CategoryPanel
            key={`${panels.panelKey}:${panel.category?.id ?? "new"}`}
            category={panel.category}
            onClose={panels.close}
            onSaved={panels.closeSaved}
            onDirtyChange={panels.onDirtyChange}
          />
        )}
        {panel?.kind === "faq" && categories.data && (
          <FaqPanel
            key={`${panels.panelKey}:${panel.faq?.id ?? `new-${panel.categoryId}`}`}
            faq={panel.faq}
            categoryId={panel.categoryId}
            categories={categories.data}
            onClose={panels.close}
            onSaved={panels.closeSaved}
            onDirtyChange={panels.onDirtyChange}
          />
        )}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.kind === "category" ? "Delete this category?" : "Delete this FAQ?"}
          message={
            pendingDelete.kind === "category"
              ? `“${pendingDelete.category.name}” will be deleted. Categories that still contain FAQs cannot be deleted.`
              : `“${pendingDelete.faq.question}” will be deleted. This cannot be undone.`
          }
          confirmLabel={pendingDelete.kind === "category" ? "Delete category" : "Delete FAQ"}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {panels.element}
    </AdminPage>
  );
}
