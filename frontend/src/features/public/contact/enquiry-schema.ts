/**
 * Enquiry form schema (UI-033, TS-007, UI-REV-013). One Zod schema mirroring the contract's `EnquiryCreate`:
 * name 1..120, email ≤ 254 and valid, enquiry_type enum (the empty placeholder value is rejected as required),
 * budget_range optional enum, company optional ≤ 120,
 * message 1..5000; strings are trimmed before validation. The server stays authoritative (SEC-BE-008).
 * `zod/mini` keeps the contact chunk small (functional API, tree-shakable); it is imported through the jitless
 * wrapper (SEC-010) and lives only in the lazily loaded Contact route chunk, never in the shared entry.
 */
import { z } from "@/shared/zod/mini";
import type { BudgetRange, EnquiryCreate, EnquiryType } from "@/api/types";
import { enquiryForm } from "@/features/public/content/copy";
import { budgetRangeLabels, enquiryTypeLabels } from "@/shared/utils/labels";

export const LIMITS = {
  name: 120,
  email: 254,
  company: 120,
  message: 5000,
} as const;

export const enquiryTypes = Object.keys(enquiryTypeLabels) as [EnquiryType, ...EnquiryType[]];
export const budgetRanges = Object.keys(budgetRangeLabels) as [BudgetRange, ...BudgetRange[]];

const e = enquiryForm.errors;

/** Raw values held by the form (selects use "" for "no choice"). */
export interface EnquiryFormValues {
  name: string;
  email: string;
  enquiry_type: string;
  budget_range: string;
  company: string;
  message: string;
  /** Honeypot: must stay empty. */
  website: string;
}

export type EnquiryField = Exclude<keyof EnquiryFormValues, "website">;

/** Order used to focus the first invalid field. */
export const FIELD_ORDER: EnquiryField[] = ["name", "email", "enquiry_type", "budget_range", "company", "message"];

export const initialValues: EnquiryFormValues = {
  name: "",
  email: "",
  /** Starts on the "Choose one…" placeholder; "" is never a valid choice (CHG-005, REQ-042). */
  enquiry_type: "",
  budget_range: "",
  company: "",
  message: "",
  website: "",
};

export const enquirySchema = z.object({
  name: z.string().check(z.minLength(1, e.nameRequired), z.maxLength(LIMITS.name, e.nameTooLong)),
  email: z
    .string()
    .check(
      z.minLength(1, e.emailRequired),
      z.maxLength(LIMITS.email, e.emailTooLong),
      z.regex(z.regexes.email, e.emailInvalid),
    ),
  enquiry_type: z.enum(enquiryTypes, e.enquiryType),
  budget_range: z.nullable(z.enum(budgetRanges, e.budgetRange)),
  company: z.nullable(z.string().check(z.maxLength(LIMITS.company, e.companyTooLong))),
  message: z.string().check(z.minLength(1, e.messageRequired), z.maxLength(LIMITS.message, e.messageTooLong)),
  website: z.string(),
});

/** Trims every string and maps empty optional values to null (contract shape). */
export function normalise(values: EnquiryFormValues): Record<keyof EnquiryFormValues, string | null> {
  const company = values.company.trim();
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    enquiry_type: values.enquiry_type,
    budget_range: values.budget_range === "" ? null : values.budget_range,
    company: company === "" ? null : company,
    message: values.message.trim(),
    website: values.website,
  };
}

export type FieldErrors = Partial<Record<EnquiryField, string>>;

export type ValidationResult = { ok: true; data: EnquiryCreate } | { ok: false; errors: FieldErrors };

/** Validates the raw form values; returns the request body or the first message per field. */
export function validateEnquiry(values: EnquiryFormValues): ValidationResult {
  const result = z.safeParse(enquirySchema, normalise(values));
  if (result.success) {
    const { website, ...rest } = result.data;
    // The honeypot is sent as entered (empty for people); the server ignores filled submissions (TS-007).
    return { ok: true, data: { ...rest, website } };
  }
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && (FIELD_ORDER as string[]).includes(field)) {
      const key = field as EnquiryField;
      errors[key] ??= issue.message;
    }
  }
  return { ok: false, errors };
}

/** First field (in form order) that has an error. */
export function firstInvalid(errors: FieldErrors): EnquiryField | undefined {
  return FIELD_ORDER.find((field) => errors[field] !== undefined);
}
