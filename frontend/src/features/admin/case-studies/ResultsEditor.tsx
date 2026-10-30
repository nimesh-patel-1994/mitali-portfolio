/**
 * Case-study Results tab (UI-045, REQ-063, REQ-021, REQ-067). `ReorderableList` of results; each opens an inline
 * form (metric label ≤ 80, value ≤ 30, before value, change, period, Sample data). "Add result" appends an empty
 * form. Delete asks for confirmation. Saving is per row with per-row validation errors.
 * Unsaved rows: Cancel or editing another result asks before discarding; rows report to the page's leave guard.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@/shared/ui/Button/Button";
import { StatusChip } from "@/shared/ui/Chip/Chip";
import { caseStudyApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminCaseStudy, AdminCaseStudyResult } from "../api/types";
import { ConfirmDialog } from "../ui/Dialog";
import { CheckboxField, FormAlert, TextField } from "../ui/fields";
import { ReorderableList, useReorder } from "../ui/ReorderableList";
import { useServerErrors } from "../ui/server-errors";
import { EmptyState, errorMessage } from "../ui/states";
import { useToast } from "../ui/Toast";
import { useDiscardConfirm, useReportDirty } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";
import { RESULT_FIELDS, resultFormValues, resultSchema, type ResultFormValues } from "./schema";
import styles from "./CaseStudies.module.css";

type ResultOutput = ReturnType<typeof resultSchema.parse>;

function ResultForm({
  caseStudyId,
  result,
  onDone,
  onDirtyChange,
}: {
  caseStudyId: string;
  result?: AdminCaseStudyResult;
  onDone: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const form = useForm<ResultFormValues, unknown, ResultOutput>({
    resolver: zodResolver(resultSchema),
    defaultValues: resultFormValues(result),
  });
  const serverErrors = useServerErrors(form, RESULT_FIELDS);
  const discard = useDiscardConfirm();
  useReportDirty(form.formState.isDirty, onDirtyChange);
  const save = useMutation({
    mutationFn: (body: ResultOutput) =>
      result
        ? caseStudyApi.updateAdminCaseStudyResult(caseStudyId, result.id, body)
        : caseStudyApi.createAdminCaseStudyResult(caseStudyId, body),
    onSuccess: () => {
      toast.success(result ? "Result saved." : "Result added.");
      void queryClient.invalidateQueries({ queryKey: adminKeys.caseStudy(caseStudyId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      onDone();
    },
    onError: (error) => serverErrors.handle(error),
  });

  return (
    <FormProvider {...form}>
      <form
        className={styles.resultForm}
        noValidate
        aria-label={result ? `Edit result ${result.metric_label}` : "New result"}
        onSubmit={form.handleSubmit((values) => {
          serverErrors.clear();
          save.mutate(values);
        })}
      >
        <FormAlert message={serverErrors.formError} />
        <div className={styles.resultGrid}>
          <TextField name="metric_label" label="Metric label" required counterMax={80} />
          <TextField name="value" label="Value" required counterMax={30} hint="For example: 48%" />
          <TextField name="before_value" label="Before value" counterMax={30} />
          <TextField name="change_text" label="Change" counterMax={30} hint="For example: +120 %" />
          <TextField name="period" label="Period" counterMax={40} hint="Optional, e.g. 6 months" />
        </div>
        <CheckboxField name="is_sample" label="Sample data" />
        <div className={kit.actions}>
          <Button type="submit" loading={save.isPending}>
            {result ? "Save result" : "Add result"}
          </Button>
          <button type="button" className={kit.smallButton} onClick={() => discard.confirm(form.formState.isDirty, onDone)}>
            Cancel
          </button>
        </div>
      </form>
      {discard.element}
    </FormProvider>
  );
}

export function ResultsEditor({ caseStudy }: { caseStudy: AdminCaseStudy }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = adminKeys.caseStudy(caseStudy.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const discard = useDiscardConfirm();
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminCaseStudyResult | null>(null);

  const read = useCallback(() => queryClient.getQueryData<AdminCaseStudy>(key)?.results, [queryClient, key]);
  const write = useCallback(
    (results: AdminCaseStudyResult[]) =>
      queryClient.setQueryData<AdminCaseStudy>(key, (old) => (old ? { ...old, results } : old)),
    [queryClient, key],
  );
  const send = useCallback((ids: string[]) => caseStudyApi.reorderAdminCaseStudyResults(caseStudy.id, ids), [caseStudy.id]);
  const reorder = useReorder<AdminCaseStudyResult>({
    read,
    write,
    refetchKey: key,
    getId: (r) => r.id,
    getTitle: (r) => r.metric_label,
    send,
  });

  const remove = useMutation({
    mutationFn: (result: AdminCaseStudyResult) => caseStudyApi.deleteAdminCaseStudyResult(caseStudy.id, result.id),
    onSuccess: (_d, result) => {
      setPendingDelete(null);
      toast.success(`Deleted the result “${result.metric_label}”.`);
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
    onError: (error) => {
      setPendingDelete(null);
      toast.error(errorMessage(error));
    },
  });

  return (
    <section aria-labelledby="results-heading" className={kit.page}>
      <h2 id="results-heading" className={kit.sectionTitle}>
        Results
      </h2>
      {caseStudy.results.length === 0 && !adding && <EmptyState title="No results yet" body="Add the numbers that show what changed." />}
      {caseStudy.results.length > 0 && (
        <ReorderableList
          label="Results in display order"
          items={caseStudy.results}
          getId={(r) => r.id}
          getTitle={(r) => r.metric_label}
          onMove={reorder.move}
          saving={reorder.saving}
          announcement={reorder.announcement}
          renderItem={(result) =>
            editing === result.id ? (
              <ResultForm caseStudyId={caseStudy.id} result={result} onDone={() => setEditing(null)} onDirtyChange={setEditDirty} />
            ) : (
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <p className={styles.rowTitle}>
                    {result.metric_label}: {result.value}
                  </p>
                  <p className={kit.muted}>
                    {[result.before_value && `Before ${result.before_value}`, result.change_text, result.period].filter(Boolean).join(" · ")}
                  </p>
                  {result.is_sample && <StatusChip tone="warning">Sample</StatusChip>}
                </div>
                <div className={kit.actions}>
                  <button type="button" className={kit.smallButton} onClick={() => discard.confirm(editing !== null && editDirty, () => setEditing(result.id))}
                    aria-label={`Edit ${result.metric_label}`}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${kit.smallButton} ${kit.dangerButton}`}
                    onClick={() => setPendingDelete(result)}
                    aria-label={`Delete ${result.metric_label}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          }
        />
      )}
      {adding ? (
        <ResultForm caseStudyId={caseStudy.id} onDone={() => setAdding(false)} />
      ) : (
        <div>
          <Button variant="ghost" onClick={() => setAdding(true)}>
            Add result
          </Button>
        </div>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this result?"
          message={`“${pendingDelete.metric_label}” will be removed from this case study.`}
          confirmLabel="Delete result"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {discard.element}
    </section>
  );
}
