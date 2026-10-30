/**
 * `useServerErrors` (UI-040, UI-REV-013): maps an `ApiError` onto React Hook Form fields.
 * - 422 `fields` with dotted paths (e.g. `results.0.value`) whose first segment is a known form field → field errors.
 * - 409 `slug_taken` → error on the `slug` field.
 * - The first mapped field (in form order) receives focus.
 * - Anything else (unknown codes, unknown fields, network, 5xx) → a form-level message returned to the caller.
 */
import { useCallback, useState } from "react";
import type { FieldPath, FieldValues, UseFormSetError, UseFormSetFocus } from "react-hook-form";
import { isApiError } from "../api/errors";
import { errorMessage } from "./states";

export const FORM_ERROR_FALLBACK = "The changes could not be saved. Check the highlighted fields and try again.";

interface ErrorTarget<T extends FieldValues> {
  setError: UseFormSetError<T>;
  setFocus: UseFormSetFocus<T>;
}

export function applyServerErrors<T extends FieldValues>(
  form: ErrorTarget<T>,
  error: unknown,
  fieldOrder: readonly string[],
): string | null {
  if (!isApiError(error)) return errorMessage(error);

  const mapped: Array<{ path: string; message: string; rank: number }> = [];
  if (error.code === "slug_taken" && fieldOrder.includes("slug")) {
    mapped.push({ path: "slug", message: error.fields?.slug ?? "This slug is already used. Choose another.", rank: fieldOrder.indexOf("slug") });
  } else if ((error.status === 422 || error.status === 409) && error.fields) {
    for (const [path, message] of Object.entries(error.fields)) {
      const root = path.split(".")[0] ?? path;
      const rank = fieldOrder.indexOf(root);
      if (rank >= 0) mapped.push({ path, message, rank });
    }
  }

  if (mapped.length === 0) {
    if (error.status === 422) return FORM_ERROR_FALLBACK;
    return errorMessage(error);
  }

  mapped.sort((a, b) => a.rank - b.rank);
  for (const item of mapped) {
    form.setError(item.path as FieldPath<T>, { type: "server", message: item.message });
  }
  const first = mapped[0]!;
  // Focus the field, or its array root when the nested input is not registered on its own.
  const before = document.activeElement;
  try {
    form.setFocus(first.path as FieldPath<T>);
  } catch {
    // Unregistered nested path.
  }
  if (document.activeElement === before) {
    try {
      form.setFocus(first.path.split(".")[0] as FieldPath<T>);
    } catch {
      // Nothing focusable for this field.
    }
  }
  return null;
}

/** Keeps the form-level alert message and exposes the mapper bound to `form`. */
export function useServerErrors<T extends FieldValues>(form: ErrorTarget<T>, fieldOrder: readonly string[]) {
  const [formError, setFormError] = useState<string | null>(null);
  const { setError, setFocus } = form;
  const handle = useCallback(
    (error: unknown) => setFormError(applyServerErrors({ setError, setFocus }, error, fieldOrder)),
    [setError, setFocus, fieldOrder],
  );
  const clear = useCallback(() => setFormError(null), []);
  return { formError, handle, clear };
}
