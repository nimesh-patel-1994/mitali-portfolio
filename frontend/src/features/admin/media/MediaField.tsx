/**
 * `MediaField` (UI-042; used for cover, thumbnail and portrait): current image thumbnail, "Choose image" / "Remove"
 * buttons and a required alt-text input whenever an image is set (validated by the form schema, REQ-063).
 */
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { ImageRef, MediaAsset } from "../api/types";
import { TextField } from "../ui/fields";
import kit from "../ui/Kit.module.css";
import { MediaPicker } from "./MediaPicker";
import { thumbnailUrl } from "./media-utils";
import styles from "./MediaField.module.css";

export const ALT_HINT = "Describe the image for people who cannot see it";

export interface MediaFieldProps {
  label: string;
  mediaName: string;
  altName: string;
  /** The image currently saved on the server (for the initial thumbnail). */
  image: ImageRef | null | undefined;
}

export function MediaField({ label, mediaName, altName, image }: MediaFieldProps) {
  const { setValue, getValues } = useFormContext();
  const mediaId = useWatch({ name: mediaName }) as unknown;
  const [picked, setPicked] = useState<{ id: string; url: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const hasImage = typeof mediaId === "string" && mediaId !== "";
  const previewUrl = hasImage ? (picked && picked.id === mediaId ? picked.url : thumbnailUrl(image)) : null;

  const select = (asset: MediaAsset) => {
    setPicked({ id: asset.id, url: thumbnailUrl(asset) });
    setValue(mediaName, asset.id, { shouldDirty: true });
    const currentAlt = getValues(altName) as unknown;
    if ((typeof currentAlt !== "string" || currentAlt.trim() === "") && asset.alt) {
      setValue(altName, asset.alt, { shouldDirty: true });
    }
    setOpen(false);
  };

  const remove = () => {
    setPicked(null);
    setValue(mediaName, null, { shouldDirty: true });
    setValue(altName, "", { shouldDirty: true });
  };

  return (
    <fieldset className={`${kit.fieldset} ${styles.media}`}>
      <legend className={kit.legend}>{label}</legend>
      <div className={styles.row}>
        {previewUrl ? (
          <img src={previewUrl} alt="" className={kit.thumb} />
        ) : (
          <span className={kit.thumbEmpty} aria-hidden="true" />
        )}
        <div className={kit.actions}>
          <button type="button" className={kit.smallButton} onClick={() => setOpen(true)}>
            {hasImage ? "Change image" : "Choose image"}
          </button>
          {hasImage && (
            <button type="button" className={`${kit.smallButton} ${kit.dangerButton}`} onClick={remove}>
              Remove image
            </button>
          )}
        </div>
      </div>
      {!hasImage && <p className={kit.muted}>No image selected.</p>}
      {hasImage && <TextField name={altName} label="Alt text" required hint={ALT_HINT} counterMax={250} />}
      {open && <MediaPicker onSelect={select} onClose={() => setOpen(false)} />}
    </fieldset>
  );
}
