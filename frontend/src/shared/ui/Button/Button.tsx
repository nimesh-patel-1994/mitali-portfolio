/** Button (UI-006): primary (green fill), secondary (cream fill), ghost (transparent with a 1 px border). */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Disables the button, sets aria-busy and shows a spinner; the label stays for screen readers. */
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function buttonClassName(variant: ButtonVariant, fullWidth = false, extra?: string): string {
  return cx(styles.button, styles[variant], fullWidth && styles.fullWidth, extra);
}

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.label}>{children}</span>
    </button>
  );
}
