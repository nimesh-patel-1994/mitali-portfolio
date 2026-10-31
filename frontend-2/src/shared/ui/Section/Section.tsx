/**
 * Section (UI-101, DES-051, DES-060, DES-061): renders `<section data-surface="base|band|deep|deep-alt">`; the
 * surface aliases (surfaces.css) switch text, accent, line and focus colours with it. Content sits in the near
 * full-bleed `.bleed` wrapper unless `inner="none"`; `padded` applies the vertical rhythm (`--section-gap`).
 */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./Section.module.css";

export type Surface = "base" | "band" | "deep" | "deep-alt";

export const SURFACES: readonly Surface[] = ["base", "band", "deep", "deep-alt"];

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  surface: Surface;
  as?: "section" | "div" | "article" | "aside";
  /** `bleed` = viewport minus the inset, up to --layout-max; `none` = no wrapper (full-bleed media). */
  inner?: "bleed" | "none";
  padded?: boolean;
  children?: ReactNode;
}

export function Section({
  surface,
  as: Tag = "section",
  inner = "bleed",
  padded = true,
  className,
  children,
  ...rest
}: SectionProps) {
  return (
    <Tag data-surface={surface} className={cx(styles.section, padded && styles.padded, className)} {...rest}>
      {inner === "none" ? children : <div className="bleed">{children}</div>}
    </Tag>
  );
}
