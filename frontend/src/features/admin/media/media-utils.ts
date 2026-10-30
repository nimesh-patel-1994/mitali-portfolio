/** Media helpers (UI-042, TS-011, SEC-UI-009). Client checks are UX only; the server detects type from content. */
import type { ImageRef, MediaAsset } from "../api/types";
import { isSafeMediaUrl } from "@/shared/utils/url";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPT = "image/jpeg,image/png,image/webp,image/svg+xml";
const ACCEPTED_TYPES = new Set(ACCEPT.split(","));
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|svg)$/i;

export const MEDIA_MESSAGES = {
  tooLarge: "Images must be 10 MB or smaller.",
  wrongType: "Upload a JPEG, PNG, WebP or SVG image.",
  invalidImage: "This file could not be read as an image.",
  inUse: "This image is used by content. Remove it there first.",
  processing: "Processing image…",
  empty: "No images yet — upload one",
} as const;

/** Returns an error message, or null when the file may be uploaded. */
export function checkUploadFile(file: File): string | null {
  const typeOk = file.type ? ACCEPTED_TYPES.has(file.type) : ACCEPTED_EXTENSIONS.test(file.name);
  if (!typeOk) return MEDIA_MESSAGES.wrongType;
  if (file.size > MAX_UPLOAD_BYTES) return MEDIA_MESSAGES.tooLarge;
  return null;
}

/** Smallest safe URL for a thumbnail (`/media/...` only), or null. */
export function thumbnailUrl(source: Pick<MediaAsset, "url" | "variants"> | Pick<ImageRef, "url" | "srcset"> | null | undefined): string | null {
  if (!source) return null;
  const variants = "variants" in source ? source.variants : source.srcset;
  const smallest = [...variants].sort((a, b) => a.width - b.width)[0];
  const url = smallest?.url ?? source.url;
  return isSafeMediaUrl(url) ? url : null;
}

export function assetName(asset: MediaAsset): string {
  return asset.original_filename?.trim() || asset.url.split("/").pop() || "Image";
}
