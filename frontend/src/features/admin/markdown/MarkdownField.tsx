/** React Hook Form binding for `MarkdownEditor` (UI-041). */
import { useController, useFormContext } from "react-hook-form";
import { useFieldError } from "../ui/fields";
import { MarkdownEditor } from "./MarkdownEditor";

export interface MarkdownFieldProps {
  name: string;
  label: string;
  maxLength: number;
  required?: boolean;
}

export function MarkdownField({ name, label, maxLength, required }: MarkdownFieldProps) {
  const { control } = useFormContext();
  const { field } = useController({ control, name });
  const error = useFieldError(name);
  return (
    <MarkdownEditor
      label={label}
      value={typeof field.value === "string" ? field.value : ""}
      onChange={field.onChange}
      onBlur={field.onBlur}
      inputRef={field.ref}
      error={error}
      required={required}
      maxLength={maxLength}
    />
  );
}
