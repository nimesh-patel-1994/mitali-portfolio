/**
 * MetaRow (UI-110, DES-052): project facts as a `<dl>` in field order, 4 columns from --bp-lg, 2 from --bp-md and
 * 1 below; each field has a top hairline, a muted label above and the value below. Empty values are skipped.
 */
import { cx } from "@/shared/utils/cx";
import styles from "./MetaRow.module.css";

export interface MetaField {
  label: string;
  value: string;
}

export interface MetaRowProps {
  fields: MetaField[];
  label: string;
  className?: string;
}

export function MetaRow({ fields, label, className }: MetaRowProps) {
  const visible = fields.filter((f) => f.value.trim() !== "");
  if (visible.length === 0) return null;
  return (
    <dl className={cx(styles.row, className)} aria-label={label}>
      {visible.map((field) => (
        <div key={field.label} className={styles.field}>
          <dt className={styles.label}>{field.label}</dt>
          <dd className={styles.value}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
