/**
 * `StringListInput` (UI-040): add / remove / reorder short strings with limits (channels, goals, tags, deliverables,
 * features, skills, tools, bio paragraphs). At the item limit "Add" is disabled and the limit is explained; at the
 * minimum "Remove" is disabled and explained. Rows keep stable keys while they move (UI-REV-016).
 */
import { useId, useRef, useState } from "react";
import { get, useController, useFormContext, useFormState } from "react-hook-form";
import { cx } from "@/shared/utils/cx";
import { ChevronDownIcon, ChevronUpIcon } from "@/shared/ui/Icon/Icon";
import { counterText, RequiredMark } from "./fields";
import styles from "./Kit.module.css";

export interface StringListFieldProps {
  name: string;
  label: string;
  /** Singular noun for one row, e.g. "Channel", "Paragraph". */
  itemLabel: string;
  maxItems: number;
  maxLength: number;
  minItems?: number;
  multiline?: boolean;
  required?: boolean;
  hint?: string;
}

function messageOf(value: unknown): string | undefined {
  const message = (value as { message?: unknown } | undefined)?.message;
  return typeof message === "string" && message !== "" ? message : undefined;
}

export function StringListField({ name, label, itemLabel, maxItems, maxLength, minItems = 0, multiline = false, required, hint }: StringListFieldProps) {
  const { control } = useFormContext();
  const { field } = useController({ control, name });
  const { errors } = useFormState({ control, name });
  const base = useId();
  const nextKey = useRef(0);
  const [keys, setKeys] = useState<string[]>([]);

  const values: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];
  const rowKeys = values.map((_, i) => keys[i] ?? `${base}-initial-${i}`);
  const listError = messageOf(get(errors, name)) ?? messageOf(get(errors, `${name}.root`));
  const atMax = values.length >= maxItems;
  const atMin = values.length <= minItems;
  const lower = itemLabel.toLowerCase();

  const freshKey = () => {
    nextKey.current += 1;
    return `${base}-k${nextKey.current}`;
  };

  const update = (nextValues: string[], nextKeys: string[]) => {
    setKeys(nextKeys);
    field.onChange(nextValues);
  };

  const add = () => {
    if (atMax) return;
    update([...values, ""], [...rowKeys, freshKey()]);
  };

  const remove = (index: number) => {
    if (atMin) return;
    update(
      values.filter((_, i) => i !== index),
      rowKeys.filter((_, i) => i !== index),
    );
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    const nextValues = [...values];
    const nextKeys = [...rowKeys];
    [nextValues[index], nextValues[target]] = [nextValues[target]!, nextValues[index]!];
    [nextKeys[index], nextKeys[target]] = [nextKeys[target]!, nextKeys[index]!];
    update(nextValues, nextKeys);
  };

  const change = (index: number, text: string) => {
    const nextValues = [...values];
    nextValues[index] = text;
    field.onChange(nextValues);
  };

  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const limitId = `${base}-limit`;

  return (
    <fieldset className={styles.field} aria-describedby={[hint ? hintId : null, listError ? errorId : null].filter(Boolean).join(" ") || undefined}>
      <legend className={styles.label}>
        {label}
        {required && <RequiredMark />}
      </legend>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {values.length > 0 && (
        <ul className={styles.list}>
          {values.map((value, index) => {
            const inputId = `${base}-item-${rowKeys[index]}`;
            const itemErrorId = `${inputId}-error`;
            const itemError = messageOf(get(errors, `${name}.${index}`));
            const rowLabel = `${itemLabel} ${index + 1}`;
            const common = {
              id: inputId,
              value,
              className: cx(styles.input, multiline && styles.textarea),
              "aria-invalid": itemError ? true : undefined,
              "aria-describedby": itemError ? itemErrorId : undefined,
              onBlur: field.onBlur,
              ref: index === 0 ? field.ref : undefined,
            };
            return (
              <li key={rowKeys[index]} className={styles.field}>
                <label htmlFor={inputId} className="visually-hidden">
                  {rowLabel}
                </label>
                <div className={styles.listRow}>
                  {multiline ? (
                    <textarea rows={4} {...common} onChange={(e) => change(index, e.target.value)} />
                  ) : (
                    <input type="text" {...common} onChange={(e) => change(index, e.target.value)} />
                  )}
                  <button type="button" className={styles.smallButton} onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${rowLabel} up`}>
                    <ChevronUpIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() => move(index, 1)}
                    disabled={index === values.length - 1}
                    aria-label={`Move ${rowLabel} down`}
                  >
                    <ChevronDownIcon />
                  </button>
                  <button
                    type="button"
                    className={cx(styles.smallButton, styles.dangerButton)}
                    onClick={() => remove(index)}
                    disabled={atMin}
                    aria-label={`Remove ${rowLabel}`}
                  >
                    Remove
                  </button>
                </div>
                {multiline && (
                  <p className={styles.counter} data-over={value.length > maxLength || undefined}>
                    {counterText(value.length, maxLength)}
                  </p>
                )}
                {itemError && (
                  <p id={itemErrorId} className={styles.error}>
                    {itemError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.smallButton} onClick={add} disabled={atMax} aria-describedby={atMax ? limitId : undefined}>
          Add {lower}
        </button>
      </div>
      {atMax && (
        <p id={limitId} className={styles.hint}>
          You can add up to {maxItems} {maxItems === 1 ? lower : `${lower}s`}.
        </p>
      )}
      {atMin && minItems > 0 && (
        <p className={styles.hint}>
          Keep at least {minItems} {minItems === 1 ? lower : `${lower}s`}.
        </p>
      )}
      {listError && (
        <p id={errorId} className={styles.error}>
          {listError}
        </p>
      )}
    </fieldset>
  );
}
