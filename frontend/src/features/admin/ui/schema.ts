/**
 * Zod building blocks mirroring the contract input schemas (UI-040, UI-REV-013). Form values are strings/booleans;
 * the schemas trim, check lengths/patterns/enums and output the contract shape (empty optional text → null).
 */
import { z } from "@/shared/zod/classic";
import { SLUG_MAX, SLUG_PATTERN } from "./SlugField";

export function tooLong(max: number): string {
  return `Keep this to ${max.toLocaleString("en")} characters or fewer.`;
}

/** Required text: trimmed, 1..max, not blank. */
export function requiredText(max: number, emptyMessage = "This field is required.") {
  return z.string().trim().min(1, emptyMessage).max(max, tooLong(max));
}

/** Optional text: trimmed; empty → null; ≤ max. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, tooLong(max))
    .transform((value) => (value === "" ? null : value));
}

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Enter a slug.")
  .max(SLUG_MAX, tooLong(SLUG_MAX))
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens only (no spaces).");

/** `StringList` (≤ 30 items of 1..60 chars) or a custom limit; blank rows are an error, not silently dropped. */
export function stringList(maxItems = 30, maxLength = 60, minItems = 0, itemNoun = "item") {
  return z
    .array(z.string().trim().min(1, `Fill in or remove this ${itemNoun}.`).max(maxLength, tooLong(maxLength)))
    .min(minItems, `Add at least ${minItems} ${itemNoun}${minItems === 1 ? "" : "s"}.`)
    .max(maxItems, `Keep the list to ${maxItems} ${itemNoun}s or fewer.`);
}

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter an email address.")
  .max(254, tooLong(254))
  .pipe(z.email("Enter an email address like name@example.com."));

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .min(1, "Enter a web address.")
  .max(500, tooLong(500))
  .refine(isHttpUrl, "Enter a full web address starting with https:// or http://.");

export const ALT_REQUIRED = "Add alt text for this image.";

/** Adds "alt required when media is set" to an object schema (REQ-063, TS-010 step 6). */
export function requireAltWhenMedia(mediaKey: string, altKey: string) {
  return (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const media = value[mediaKey];
    const alt = value[altKey];
    if (typeof media === "string" && media !== "" && (typeof alt !== "string" || alt.trim() === "")) {
      ctx.addIssue({ code: "custom", path: [altKey], message: ALT_REQUIRED });
    }
  };
}

/** Media id form value ("" / null → null). */
export const mediaIdSchema = z
  .string()
  .nullable()
  .transform((value) => (value ? value : null));

/** Alt text form value: trimmed, ≤ 250, empty → null. */
export const altSchema = z
  .string()
  .nullable()
  .transform((value) => (value ?? "").trim())
  .pipe(z.string().max(250, tooLong(250)))
  .transform((value) => (value === "" ? null : value));
