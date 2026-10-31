/**
 * MediaBand (UI-109, TS-022 step 3, DES-058): a full-bleed image band. The image is 116 % of the frame height and,
 * where CSS scroll-driven animations exist and motion is allowed, drifts slowly while the band crosses the viewport
 * (`animation-timeline: view()`, transform only). Elsewhere the image is static and centred. No JavaScript.
 */
import type { ImageRef } from "@/api/types";
import { cx } from "@/shared/utils/cx";
import { ResponsiveImage, type SlotRatio } from "../ResponsiveImage/ResponsiveImage";
import styles from "./MediaBand.module.css";

export interface MediaBandProps {
  image: ImageRef | null | undefined;
  sizes?: string;
  ratio?: SlotRatio;
  /** The page's LCP image (case-study cover). */
  priority?: boolean;
  className?: string;
}

export function MediaBand({ image, sizes = "100vw", ratio = "16x9", priority = false, className }: MediaBandProps) {
  return (
    <div className={cx(styles.band, className)} data-parallax="">
      <ResponsiveImage
        image={image}
        sizes={sizes}
        ratio={ratio}
        priority={priority}
        radius="lg"
        imageClassName={styles.image}
      />
    </div>
  );
}
