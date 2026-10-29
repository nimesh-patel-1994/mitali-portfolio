/**
 * ResponsiveImage (UI-013, SEC-UI-009). Renders an API `ImageRef` as `<img src srcset sizes width height alt>`.
 * - Lazy by default; `priority` (the LCP image only) → eager + fetchpriority="high".
 * - SVG refs have an empty srcset.
 * - Only root-relative `/media/` URLs are used; anything else, a missing ref or a load error shows a
 *   token-coloured block with the same aspect ratio (an SVG spacer keeps the ratio without inline styles).
 */
import { useState } from "react";
import type { ImageRef } from "@/api/types";
import { cx } from "@/shared/utils/cx";
import { isSafeMediaUrl } from "@/shared/utils/url";
import styles from "./ResponsiveImage.module.css";

export interface AspectRatio {
  width: number;
  height: number;
}

export interface ResponsiveImageProps {
  image: ImageRef | null | undefined;
  /** `sizes` attribute matching the rendered width per breakpoint (REQ-NFR-004). */
  sizes: string;
  priority?: boolean;
  /** Decorative images get alt="" (caller decides; content images always use the API alt). */
  decorative?: boolean;
  /** Ratio of the fallback block when the ref is missing (default 16:9). */
  fallbackRatio?: AspectRatio;
  className?: string;
}

const DEFAULT_RATIO: AspectRatio = { width: 16, height: 9 };

function buildSrcSet(image: ImageRef): string | undefined {
  if (image.mime === "image/svg+xml") return undefined;
  const entries = image.srcset.filter((s) => isSafeMediaUrl(s.url) && Number.isInteger(s.width) && s.width > 0);
  if (entries.length === 0) return undefined;
  return entries.map((s) => `${s.url} ${s.width}w`).join(", ");
}

export function ResponsiveImage({
  image,
  sizes,
  priority = false,
  decorative = false,
  fallbackRatio,
  className,
}: ResponsiveImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = image && isSafeMediaUrl(image.url) ? image : null;

  if (!usable || failedSrc === usable.url) {
    const ratio = usable ? { width: usable.width, height: usable.height } : (fallbackRatio ?? DEFAULT_RATIO);
    const label = !decorative && image?.alt ? image.alt : undefined;
    return (
      <span
        className={cx(styles.fallback, className)}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        data-fallback="true"
      >
        <svg className={styles.spacer} viewBox={`0 0 ${ratio.width} ${ratio.height}`} aria-hidden="true" focusable="false" />
      </span>
    );
  }

  return (
    <img
      className={cx(styles.image, className)}
      src={usable.url}
      srcSet={buildSrcSet(usable)}
      sizes={buildSrcSet(usable) ? sizes : undefined}
      width={usable.width}
      height={usable.height}
      alt={decorative ? "" : usable.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      onError={() => setFailedSrc(usable.url)}
    />
  );
}
