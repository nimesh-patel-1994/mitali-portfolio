/**
 * Form kit fields (UI-040, ui-scope 3.3 rule 6, UI-REV-013) bound to React Hook Form through `useFormContext`.
 * Every field has a visible label (required fields marked with "*" plus "(required)" for screen readers), an
 * optional hint, an optional character counter and an error message; hint, counter and error are linked with
 * `aria-describedby`, and invalid fields carry `aria-invalid="true"`.
 */
import { useId, type HTMLInputTypeAttribute, type ReactNode } from "react";
import { get, useFormContext, useFormState, useWatch, type FieldValues } from "react-hook-form";
import { cx } from "@/shared/utils/cx";
import styles from "./Kit.module.css";

export function counterText(used: number, max: number): string {
  return `${used.toLocaleString("en")} of ${max.toLocaleString("en")} characters`;
}

export function useFieldError(name: string): string | undefined {
  const { control } = useFormContext();
  const { errors } = useFormState({ control, name });
  const error = get(errors, name) as { message?: unknown } | undefined;
  return typeof error?.message === "string" && error.message !== "" ? error.message : undefined;
}

export interface FieldIds {
  id: string;
  hintId: string;
  counterId: string;
  errorId: string;
}

export function useFieldIds(): FieldIds {
  const base = useId();
  return { id: `${base}-input`, hintId: `${base}-hint`, counterId: `${base}-counter`, errorId: `${base}-error` };
}

export function describedBy(ids: FieldIds, parts: { hint?: boolean; counter?: boolean; error?: boolean }): string | undefined {
  const list = [parts.hint && ids.hintId, parts.counter && ids.counterId, parts.error && ids.errorId].filter(Boolean);
  return list.length > 0 ? list.join(" ") : undefined;
}

export function RequiredMark() {
  return (
    <>
      <span className={styles.required} aria-hidden="true">
        {" "}
        *
      </span>
      <span className="visually-hidden"> (required)</span>
    </>
  );
}

export interface FieldShellProps {
  ids: FieldIds;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  counter?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint + counter + error, in that visual order. */
export function FieldShell({ ids, label, required, hint, counter, error, children, className }: FieldShellProps) {
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={ids.id} className={styles.label}>
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      {hint !== undefined && (
        <p id={ids.hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {counter}
      {error && (
        <p id={ids.errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function Counter({ name, max, id }: { name: string; max: number; id: string }) {
  const value = useWatch({ name }) as unknown;
  const used = typeof value === "string" ? value.length : 0;
  return (
    <p id={id} className={styles.counter} data-over={used > max || undefined}>
      {counterText(used, max)}
    </p>
  );
}

interface BaseProps {
  name: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export interface TextFieldProps extends BaseProps {
  type?: HTMLInputTypeAttribute;
  /** Shows a "used of max" counter (the limit itself is validated by the Zod schema). */
  counterMax?: number;
  autoComplete?: string;
  inputMode?: "text" | "email" | "url" | "numeric" | "decimal";
  placeholder?: string;
}

export function TextField({ name, label, required, hint, className, disabled, type = "text", counterMax, autoComplete, inputMode, placeholder }: TextFieldProps) {
  const { register } = useFormContext<FieldValues>();
  const ids = useFieldIds();
  const error = useFieldError(name);
  return (
    <FieldShell
      ids={ids}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
      counter={counterMax !== undefined ? <Counter name={name} max={counterMax} id={ids.counterId} /> : undefined}
    >
      <input
        id={ids.id}
        type={type}
        className={styles.input}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { hint: hint !== undefined, counter: counterMax !== undefined, error: !!error })}
        {...register(name)}
      />
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends BaseProps {
  counterMax?: number;
  rows?: number;
}

export function TextAreaField({ name, label, required, hint, className, disabled, counterMax, rows = 4 }: TextAreaFieldProps) {
  const { register } = useFormContext<FieldValues>();
  const ids = useFieldIds();
  const error = useFieldError(name);
  return (
    <FieldShell
      ids={ids}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
      counter={counterMax !== undefined ? <Counter name={name} max={counterMax} id={ids.counterId} /> : undefined}
    >
      <textarea
        id={ids.id}
        rows={rows}
        className={cx(styles.input, styles.textarea)}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { hint: hint !== undefined, counter: counterMax !== undefined, error: !!error })}
        {...register(name)}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends BaseProps {
  options: readonly SelectOption[];
  /** Optional first option with value "" (e.g. "None", "Choose one…"). */
  placeholder?: string;
}

export function SelectField({ name, label, required, hint, className, disabled, options, placeholder }: SelectFieldProps) {
  const { register } = useFormContext<FieldValues>();
  const ids = useFieldIds();
  const error = useFieldError(name);
  return (
    <FieldShell ids={ids} label={label} required={required} hint={hint} error={error} className={className}>
      <select
        id={ids.id}
        className={styles.input}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { hint: hint !== undefined, error: !!error })}
        {...register(name)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({ name, label, hint, className, disabled }: Omit<BaseProps, "required">) {
  const { register } = useFormContext<FieldValues>();
  const ids = useFieldIds();
  const error = useFieldError(name);
  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.check} htmlFor={ids.id}>
        <input
          id={ids.id}
          type="checkbox"
          disabled={disabled}
          aria-describedby={describedBy(ids, { hint: hint !== undefined, error: !!error })}
          {...register(name)}
        />
        <span>{label}</span>
      </label>
      {hint !== undefined && (
        <p id={ids.hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export interface RadioGroupFieldProps extends BaseProps {
  options: readonly SelectOption[];
}

export function RadioGroupField({ name, label, required, hint, className, disabled, options }: RadioGroupFieldProps) {
  const { register } = useFormContext<FieldValues>();
  const ids = useFieldIds();
  const error = useFieldError(name);
  return (
    <fieldset
      className={cx(styles.field, className)}
      aria-describedby={describedBy(ids, { hint: hint !== undefined, error: !!error })}
      aria-invalid={error ? true : undefined}
    >
      <legend className={styles.label}>
        {label}
        {required && <RequiredMark />}
      </legend>
      <div className={styles.radios}>
        {options.map((option) => (
          <label key={option.value} className={styles.radio}>
            <input type="radio" value={option.value} disabled={disabled} {...register(name)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {hint !== undefined && (
        <p id={ids.hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.errorId} className={styles.error}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className={styles.formAlert}>
      {message}
    </p>
  );
}
