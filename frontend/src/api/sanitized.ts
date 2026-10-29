/**
 * Branded type for HTML that the backend has already sanitized (TS-012, SEC-UI-001).
 * `SanitizedHtml` accepts only this type. Values are created exclusively by the typed response mappers
 * (`src/app/content/mappers.ts` and, later, the admin Markdown preview mapper); ESLint forbids importing
 * `trustApiSanitizedHtml` anywhere else. Never create it from user input or string concatenation.
 */
declare const sanitizedHtmlBrand: unique symbol;

export type SanitizedHtmlString = string & { readonly [sanitizedHtmlBrand]: "SanitizedHtmlString" };

/** Marks an API `*_html` field (sanitized server-side with nh3) as safe to insert. */
export function trustApiSanitizedHtml(value: string): SanitizedHtmlString {
  return value as SanitizedHtmlString;
}
