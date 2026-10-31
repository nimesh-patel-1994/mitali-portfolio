/**
 * SampleDataNote (UI-110; behaviour of frontend/ UI-015, REQ-023): small inline note shown only when content is
 * flagged as sample data. Colour from --warning-on-surface (#8C5A00 on light, #FFB74D on deep); always text.
 */
import { sampleNotes } from "@/features/public/content/copy";
import { cx } from "@/shared/utils/cx";
import { InfoIcon } from "../Icon/Icon";
import styles from "./SampleDataNote.module.css";

export interface SampleDataNoteProps {
  show: boolean;
  /** `data` → "Sample data" (results), `caseStudy` → "Sample case study", `sample` → "Sample". */
  variant?: "data" | "caseStudy" | "sample";
  className?: string;
}

export function SampleDataNote({ show, variant = "data", className }: SampleDataNoteProps) {
  if (!show) return null;
  return (
    <p className={cx(styles.note, className)}>
      <InfoIcon className={styles.icon} />
      <span>{sampleNotes[variant]}</span>
    </p>
  );
}
