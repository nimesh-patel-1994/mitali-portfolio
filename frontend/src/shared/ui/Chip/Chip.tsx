/**
 * Chips (UI-009). `Chip`: outlined label. `FilterChip`: link chip for the writing filter (`aria-current="true"`
 * when active). `StatusChip`: admin status label that always carries text (never colour alone).
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "@/shared/utils/cx";
import styles from "./Chip.module.css";

export interface ChipProps {
  children: ReactNode;
  className?: string;
}

export function Chip({ children, className }: ChipProps) {
  return <span className={cx(styles.chip, className)}>{children}</span>;
}

export interface FilterChipProps {
  to: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}

export function FilterChip({ to, active, children, className }: FilterChipProps) {
  return (
    <Link
      to={to}
      preventScrollReset
      aria-current={active ? "true" : undefined}
      className={cx(styles.chip, styles.filter, active && styles.active, className)}
    >
      {children}
    </Link>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export interface StatusChipProps {
  tone: StatusTone;
  /** Visible text label, e.g. "Published", "Draft", "Sample", "New". */
  children: ReactNode;
  className?: string;
}

export function StatusChip({ tone, children, className }: StatusChipProps) {
  return <span className={cx(styles.chip, styles.status, styles[tone], className)}>{children}</span>;
}
