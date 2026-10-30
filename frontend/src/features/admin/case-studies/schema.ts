/** Zod schemas mirroring `CaseStudyInput`, `CaseStudyResultInput` and `CaseStudyImageInput` (UI-044..UI-046). */
import { z } from "@/shared/zod/classic";
import type { AdminCaseStudy, AdminCaseStudyResult, CaseStudyInput, CaseStudyResultInput } from "../api/types";
import { altSchema, mediaIdSchema, optionalText, requireAltWhenMedia, requiredText, slugSchema, stringList, tooLong } from "../ui/schema";

export const CASE_STUDY_LIMITS = {
  title: 120,
  client_name: 120,
  client_industry: 80,
  campaign_type: 60,
  summary: 600,
  markdown: 20_000,
  timeline: 40,
} as const;

export const caseStudySchema = z
  .object({
    title: requiredText(CASE_STUDY_LIMITS.title, "Enter a title."),
    slug: slugSchema,
    client_name: requiredText(CASE_STUDY_LIMITS.client_name, "Enter the client name."),
    client_industry: requiredText(CASE_STUDY_LIMITS.client_industry, "Enter the client's industry."),
    campaign_type: requiredText(CASE_STUDY_LIMITS.campaign_type, "Enter the campaign type."),
    channels: stringList(30, 60, 0, "channel"),
    goals: stringList(30, 60, 0, "goal"),
    summary: requiredText(CASE_STUDY_LIMITS.summary, "Write a short summary."),
    problem_md: requiredText(CASE_STUDY_LIMITS.markdown, "Describe the problem."),
    solution_md: requiredText(CASE_STUDY_LIMITS.markdown, "Describe the solution."),
    year: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Enter a four-digit year, e.g. 2026.")
      .transform(Number)
      .pipe(z.number().int().min(2000, "Use a year from 2000 to 2100.").max(2100, "Use a year from 2000 to 2100.")),
    timeline: requiredText(CASE_STUDY_LIMITS.timeline, "Enter the timeline, e.g. 3 months."),
    cover_media_id: mediaIdSchema,
    cover_alt: altSchema,
    is_featured: z.boolean(),
    is_published: z.boolean(),
    is_sample: z.boolean(),
  })
  .superRefine(requireAltWhenMedia("cover_media_id", "cover_alt"));

export type CaseStudyFormValues = z.input<typeof caseStudySchema>;
export type CaseStudyFormOutput = z.output<typeof caseStudySchema>;

/** Form order used to focus the first server error. */
export const CASE_STUDY_FIELDS = [
  "title",
  "slug",
  "client_name",
  "client_industry",
  "campaign_type",
  "channels",
  "goals",
  "summary",
  "problem_md",
  "solution_md",
  "year",
  "timeline",
  "cover_media_id",
  "cover_alt",
  "is_featured",
  "is_published",
  "is_sample",
] as const;

export function caseStudyFormValues(cs?: AdminCaseStudy): CaseStudyFormValues {
  return {
    title: cs?.title ?? "",
    slug: cs?.slug ?? "",
    client_name: cs?.client_name ?? "",
    client_industry: cs?.client_industry ?? "",
    campaign_type: cs?.campaign_type ?? "",
    channels: cs?.channels ?? [],
    goals: cs?.goals ?? [],
    summary: cs?.summary ?? "",
    problem_md: cs?.problem_md ?? "",
    solution_md: cs?.solution_md ?? "",
    year: cs ? String(cs.year) : "",
    timeline: cs?.timeline ?? "",
    cover_media_id: cs?.cover_media_id ?? null,
    cover_alt: cs?.cover_alt ?? "",
    is_featured: cs?.is_featured ?? false,
    is_published: cs?.is_published ?? false,
    is_sample: cs?.is_sample ?? false,
  };
}

/** Saved case study → full `CaseStudyInput` (PUT is a full replace). */
export function caseStudyInputFrom(cs: AdminCaseStudy): CaseStudyInput {
  return {
    slug: cs.slug,
    title: cs.title,
    client_name: cs.client_name,
    client_industry: cs.client_industry,
    campaign_type: cs.campaign_type,
    channels: cs.channels,
    goals: cs.goals,
    summary: cs.summary,
    problem_md: cs.problem_md,
    solution_md: cs.solution_md,
    year: cs.year,
    timeline: cs.timeline,
    cover_media_id: cs.cover_media_id,
    cover_alt: cs.cover_alt,
    is_featured: cs.is_featured,
    is_published: cs.is_published,
    is_sample: cs.is_sample,
  };
}

/* ---------------------------------------------------------------- results */
export const resultSchema = z.object({
  metric_label: requiredText(80, "Enter a metric label."),
  value: requiredText(30, "Enter the value."),
  before_value: optionalText(30),
  change_text: optionalText(30),
  period: optionalText(40),
  is_sample: z.boolean(),
});

export type ResultFormValues = z.input<typeof resultSchema>;
export const RESULT_FIELDS = ["metric_label", "value", "before_value", "change_text", "period", "is_sample"] as const;

export function resultFormValues(result?: AdminCaseStudyResult): ResultFormValues {
  return {
    metric_label: result?.metric_label ?? "",
    value: result?.value ?? "",
    before_value: result?.before_value ?? "",
    change_text: result?.change_text ?? "",
    period: result?.period ?? "",
    is_sample: result?.is_sample ?? false,
  };
}

export function resultInputFrom(result: AdminCaseStudyResult): CaseStudyResultInput {
  return {
    metric_label: result.metric_label,
    value: result.value,
    before_value: result.before_value,
    change_text: result.change_text,
    period: result.period,
    is_sample: result.is_sample,
  };
}

/* ---------------------------------------------------------------- gallery images */
export const ADD_ALT_BEFORE_SAVING = "Add alt text before saving";

export const imageSchema = z.object({
  alt: z.string().trim().min(1, ADD_ALT_BEFORE_SAVING).max(250, tooLong(250)),
  caption: optionalText(200),
  layout: z.enum(["full", "half"], "Choose a layout."),
});

export type ImageFormValues = z.input<typeof imageSchema>;
export const IMAGE_FIELDS = ["alt", "caption", "layout"] as const;
