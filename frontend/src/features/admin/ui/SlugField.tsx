/**
 * `SlugInput` (UI-040, UI-044, TS-010): on create it suggests a slug from the title until the slug is edited by
 * hand; the pattern hint matches the contract (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 80 characters).
 */
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { describedBy, FieldShell, useFieldError, useFieldIds } from "./fields";
import styles from "./Kit.module.css";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 80;
export const SLUG_HINT = "Lowercase letters, numbers and single hyphens, e.g. spring-launch-plan.";

/** "Spring Launch Plan!" → "spring-launch-plan" (ASCII, ≤ 80 chars, no leading/trailing hyphen). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export interface SlugFieldProps {
  name?: string;
  sourceName?: string;
  /** Follow the title (create mode) until edited by hand. */
  follow: boolean;
  publicPrefix: string;
}

export function SlugField({ name = "slug", sourceName = "title", follow, publicPrefix }: SlugFieldProps) {
  const { register, setValue } = useFormContext();
  const [edited, setEdited] = useState(false);
  const source = useWatch({ name: sourceName }) as unknown;
  const slug = useWatch({ name }) as unknown;
  const ids = useFieldIds();
  const error = useFieldError(name);

  useEffect(() => {
    if (!follow || edited || typeof source !== "string") return;
    setValue(name, slugify(source), { shouldDirty: true });
  }, [follow, edited, source, name, setValue]);

  const field = register(name, {
    onChange: () => setEdited(true),
  });

  return (
    <FieldShell ids={ids} label="Slug" required hint={SLUG_HINT} error={error}>
      <input
        id={ids.id}
        type="text"
        className={styles.input}
        autoComplete="off"
        spellCheck={false}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { hint: true, error: !!error })}
        {...field}
      />
      <p className={styles.hint}>
        Public address: {publicPrefix}
        {typeof slug === "string" && slug !== "" ? slug : "…"}. Visible on the site after the next rebuild.
      </p>
    </FieldShell>
  );
}
