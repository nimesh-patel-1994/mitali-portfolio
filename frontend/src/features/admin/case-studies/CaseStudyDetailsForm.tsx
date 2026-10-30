/**
 * Case-study Details tab (UI-044, REQ-063, REQ-067, REQ-021). Form = `CaseStudyInput`; "Save" sends a full PUT (or
 * POST on create, then navigates to `/admin/case-studies/:id`). "Clear sample flags" (shown when the case study or
 * any result is flagged): confirmation, then the case-study PUT with `is_sample=false` and one result PUT per
 * flagged result; partial failure names the items that failed.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Button } from "@/shared/ui/Button/Button";
import { caseStudyApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminCaseStudy } from "../api/types";
import { MarkdownField } from "../markdown/MarkdownField";
import { MediaField } from "../media/MediaField";
import { ConfirmDialog } from "../ui/Dialog";
import { CheckboxField, FormAlert, TextAreaField, TextField } from "../ui/fields";
import { useServerErrors } from "../ui/server-errors";
import { SlugField } from "../ui/SlugField";
import { StringListField } from "../ui/StringListField";
import { useToast } from "../ui/Toast";
import { useReportDirty, useUnsavedChangesBypass } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";
import {
  CASE_STUDY_FIELDS,
  CASE_STUDY_LIMITS,
  caseStudyFormValues,
  caseStudyInputFrom,
  caseStudySchema,
  resultInputFrom,
  type CaseStudyFormOutput,
  type CaseStudyFormValues,
} from "./schema";

export const SAMPLE_CLEARED = "Sample flags cleared.";

export function CaseStudyDetailsForm({ caseStudy }: { caseStudy?: AdminCaseStudy }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = caseStudy === undefined;
  const form = useForm<CaseStudyFormValues, unknown, CaseStudyFormOutput>({
    resolver: zodResolver(caseStudySchema),
    defaultValues: caseStudyFormValues(caseStudy),
  });
  const serverErrors = useServerErrors(form, CASE_STUDY_FIELDS);
  // The editor page owns the single leave-page guard for all three tabs (CaseStudyEditorPage).
  useReportDirty(form.formState.isDirty);
  const bypassGuard = useUnsavedChangesBypass();
  const [confirmClear, setConfirmClear] = useState(false);

  const save = useMutation({
    mutationFn: (body: CaseStudyFormOutput) =>
      isNew ? caseStudyApi.createAdminCaseStudy(body) : caseStudyApi.updateAdminCaseStudy(caseStudy.id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.caseStudy(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: adminKeys.caseStudies });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      form.reset(caseStudyFormValues(saved));
      toast.success(isNew ? `Created “${saved.title}”.` : "Changes saved.");
      if (isNew) {
        bypassGuard();
        navigate(`/admin/case-studies/${saved.id}`, { replace: true });
      }
    },
    onError: (error) => serverErrors.handle(error),
  });

  const flaggedResults = caseStudy?.results.filter((r) => r.is_sample) ?? [];
  const showClear = caseStudy !== undefined && (caseStudy.is_sample || flaggedResults.length > 0);

  const clearSample = useMutation({
    mutationFn: async (cs: AdminCaseStudy) => {
      const failed: string[] = [];
      let updated: AdminCaseStudy | null = null;
      try {
        updated = await caseStudyApi.updateAdminCaseStudy(cs.id, { ...caseStudyInputFrom(cs), is_sample: false });
      } catch {
        failed.push(`the case study “${cs.title}”`);
      }
      for (const result of cs.results.filter((r) => r.is_sample)) {
        try {
          await caseStudyApi.updateAdminCaseStudyResult(cs.id, result.id, { ...resultInputFrom(result), is_sample: false });
        } catch {
          failed.push(`the result “${result.metric_label}”`);
        }
      }
      return { failed, updated };
    },
    onSuccess: ({ failed, updated }, cs) => {
      setConfirmClear(false);
      void queryClient.invalidateQueries({ queryKey: adminKeys.caseStudy(cs.id) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.caseStudies });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      if (updated) form.resetField("is_sample", { defaultValue: false });
      if (failed.length === 0) toast.success(SAMPLE_CLEARED);
      else toast.error(`Some sample flags could not be cleared: ${failed.join(", ")}. Please try again.`);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    serverErrors.clear();
    save.mutate(values);
  });

  return (
    <FormProvider {...form}>
      <form className={kit.form} noValidate onSubmit={onSubmit} aria-label="Case study details">
        <FormAlert message={serverErrors.formError} />
        <TextField name="title" label="Title" required counterMax={CASE_STUDY_LIMITS.title} />
        <SlugField follow={isNew} publicPrefix="/work/" />
        <div className={kit.grid2}>
          <TextField name="client_name" label="Client name" required counterMax={CASE_STUDY_LIMITS.client_name} />
          <TextField name="client_industry" label="Client industry" required counterMax={CASE_STUDY_LIMITS.client_industry} />
          <TextField name="campaign_type" label="Campaign type" required counterMax={CASE_STUDY_LIMITS.campaign_type} />
          <TextField name="timeline" label="Timeline" required hint="For example: 3 months" counterMax={CASE_STUDY_LIMITS.timeline} />
          <TextField name="year" label="Year" required inputMode="numeric" hint="2000 to 2100" />
        </div>
        <div className={kit.grid2}>
          <StringListField name="channels" label="Channels" itemLabel="Channel" maxItems={30} maxLength={60} />
          <StringListField name="goals" label="Goals" itemLabel="Goal" maxItems={30} maxLength={60} />
        </div>
        <TextAreaField name="summary" label="Summary" required counterMax={CASE_STUDY_LIMITS.summary} />
        <MarkdownField name="problem_md" label="The problem" required maxLength={CASE_STUDY_LIMITS.markdown} />
        <MarkdownField name="solution_md" label="The solution" required maxLength={CASE_STUDY_LIMITS.markdown} />
        <MediaField label="Cover image" mediaName="cover_media_id" altName="cover_alt" image={caseStudy?.cover} />
        <fieldset className={kit.fieldset}>
          <legend className={kit.legend}>Visibility</legend>
          <div className={kit.checks}>
            <CheckboxField name="is_published" label="Published" />
            <CheckboxField name="is_featured" label="Featured on the home page" />
            <CheckboxField name="is_sample" label="Sample data" />
          </div>
        </fieldset>
        <div className={kit.formFooter}>
          <Button type="submit" loading={save.isPending}>
            {isNew ? "Create case study" : "Save"}
          </Button>
          {showClear && (
            <Button variant="ghost" onClick={() => setConfirmClear(true)}>
              Clear sample flags
            </Button>
          )}
          <p className={kit.muted}>Visible on the site after the next rebuild.</p>
        </div>
      </form>
      {confirmClear && caseStudy && (
        <ConfirmDialog
          title="Clear sample flags?"
          message={`“${caseStudy.title}” and ${flaggedResults.length} flagged ${flaggedResults.length === 1 ? "result" : "results"} will no longer be marked as sample data.`}
          confirmLabel="Clear sample flags"
          busy={clearSample.isPending}
          onConfirm={() => clearSample.mutate(caseStudy)}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </FormProvider>
  );
}
