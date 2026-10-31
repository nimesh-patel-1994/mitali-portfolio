/**
 * Button (UI-108, DES-052): 48 px tall, 2 px radius, Public Sans 600, sentence case.
 * `primary` = green fill + ink text (13.48:1); `secondary` = transparent with a 2 px border in the surface ink.
 * Hover shows the label underline (never an opacity change). `loading` disables the button, sets aria-busy and
 * shows a spinner; the label stays for screen readers.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
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
