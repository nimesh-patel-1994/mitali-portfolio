/**
 * ResponsiveImage (UI-109, TS-025, DES-062; behaviour ported from frontend/ UI-013, SEC-UI-009).
 * - A frame with a slot ratio (`data-ratio` = 16x9, 4x3, 3x2, 5x6 or 1x1, chosen by the slot and styled by an
 *   attribute selector, never an inline style) reserves the box before the image loads; the frame shows --surface-skeleton and
 *   the image simply paints over it (no fade-in, so pre-rendered images never wait for JavaScript).
 * - `<img src srcset sizes width height alt>`; lazy by default; `priority` (one per page) → eager +
 *   `fetchpriority="high"`. SVG refs have an empty srcset.
 * - Only root-relative `/media/` URLs are used; anything else, a missing ref or a load error shows a fallback block
 *   in the same frame (no layout shift).
 * The REQ-095 loading polish (placeholder shimmer, LCP preload) is PH-3.
 */
import { useState } from "react";
import type { ImageRef } from "@/api/types";
import { cx } from "@/shared/utils/cx";
import { isSafeMediaUrl } from "@/shared/utils/url";
import styles from "./ResponsiveImage.module.css";

export type SlotRatio = "16x9" | "4x3" | "3x2" | "5x6" | "1x1";


export interface ResponsiveImageProps {
  image: ImageRef | null | undefined;
  /** `sizes` attribute matching the rendered width per breakpoint (REQ-NFR-004). */
  sizes: string;
  ratio: SlotRatio;
  priority?: boolean;
  /** Decorative images get alt="" (caller decides; content images always use the API alt). */
  decorative?: boolean;
  radius?: "lg" | "md" | "none";
  className?: string;
  /** Extra class on the <img> (e.g. the parallax band's taller image). */
  imageClassName?: string;
}

function buildSrcSet(image: ImageRef): string | undefined {
  if (image.mime === "image/svg+xml") return undefined;
  const entries = image.srcset.filter((s) => isSafeMediaUrl(s.url) && Number.isInteger(s.width) && s.width > 0);
  if (entries.length === 0) return undefined;
  return entries.map((s) => `${s.url} ${s.width}w`).join(", ");
}

export function ResponsiveImage({
  image,
  sizes,
  ratio,
  priority = false,
  decorative = false,
  radius = "none",
  className,
  imageClassName,
}: ResponsiveImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = image && isSafeMediaUrl(image.url) ? image : null;
  const frameClass = cx(styles.frame, radius !== "none" && styles[radius], className);

  if (!usable || failedSrc === usable.url) {
    const label = !decorative && image?.alt ? image.alt : undefined;
    return (
      <span className={frameClass} data-ratio={ratio}>
        <span
          className={styles.fallback}
          role={label ? "img" : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : true}
          data-fallback="true"
        />
      </span>
    );
  }

  const srcSet = buildSrcSet(usable);
  return (
    <span className={frameClass} data-ratio={ratio}>
      <img
        className={cx(styles.image, imageClassName)}
        src={usable.url}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        width={usable.width}
        height={usable.height}
        alt={decorative ? "" : usable.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        onError={() => setFailedSrc(usable.url)}
      />
    </span>
  );
}
