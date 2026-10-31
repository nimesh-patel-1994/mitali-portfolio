/**
 * Chips (UI-108, DES-052): Antonio 500 uppercase labels with a 1 px border in the strong line colour and a full
 * radius. `FilterChip` is a link chip (writing filter, PH-3) with `aria-current="true"` and an accent fill (ink
 * text) when active; the state is never shown by colour alone.
 */
import type { ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import { AppLink } from "../AppLink/AppLink";
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
    <AppLink
      to={to}
      preventScrollReset
      aria-current={active ? "true" : undefined}
      className={cx(styles.chip, styles.filter, active && styles.active, className)}
    >
      {children}
    </AppLink>
  );
}
