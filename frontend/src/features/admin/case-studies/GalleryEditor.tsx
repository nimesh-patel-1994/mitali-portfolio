/**
 * Case-study Gallery tab (UI-046, REQ-063, REQ-021, TS-011). "Add image" opens the media picker; the new tile needs
 * alt text (≤ 250) before "Save" is enabled and shows "Add alt text before saving" otherwise; caption optional
 * (≤ 200); layout Full / Half (radio group). A layout preview mirrors the public gallery (full spans two columns,
 * halves side by side). `ReorderableList` for order; delete asks for confirmation (the media stays in the library).
 * Unsaved tiles: Cancel or editing another image asks before discarding; tiles report to the page's leave guard.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Button } from "@/shared/ui/Button/Button";
import { imageLayoutLabels } from "@/shared/utils/labels";
import { cx } from "@/shared/utils/cx";
import { caseStudyApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminCaseStudy, AdminCaseStudyImage, MediaAsset } from "../api/types";
import { MediaPicker } from "../media/MediaPicker";
import { ALT_HINT } from "../media/MediaField";
import { assetName, thumbnailUrl } from "../media/media-utils";
import { ConfirmDialog } from "../ui/Dialog";
import { FormAlert, RadioGroupField, TextField } from "../ui/fields";
import { ReorderableList, useReorder } from "../ui/ReorderableList";
import { useServerErrors } from "../ui/server-errors";
import { EmptyState, errorMessage } from "../ui/states";
import { useToast } from "../ui/Toast";
import { useDiscardConfirm, useReportDirty } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";
import { ADD_ALT_BEFORE_SAVING, IMAGE_FIELDS, imageSchema, type ImageFormValues } from "./schema";
import styles from "./CaseStudies.module.css";

type ImageOutput = ReturnType<typeof imageSchema.parse>;

const LAYOUT_OPTIONS = (["full", "half"] as const).map((value) => ({ value, label: imageLayoutLabels[value] }));

interface TileTarget {
  mediaId: string;
  thumb: string | null;
  name: string;
}

function ImageForm({
  caseStudyId,
  target,
  image,
  onDone,
  onDirtyChange,
}: {
  caseStudyId: string;
  target: TileTarget;
  image?: AdminCaseStudyImage;
  onDone: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const form = useForm<ImageFormValues, unknown, ImageOutput>({
    resolver: zodResolver(imageSchema),
    defaultValues: { alt: image?.alt ?? "", caption: image?.caption ?? "", layout: image?.layout ?? "full" },
  });
  const alt = useWatch({ control: form.control, name: "alt" });
  const altMissing = alt.trim() === "";
  const serverErrors = useServerErrors(form, IMAGE_FIELDS);
  const discard = useDiscardConfirm();
  useReportDirty(form.formState.isDirty, onDirtyChange);
  const save = useMutation({
    mutationFn: (values: ImageOutput) => {
      const body = { media_id: target.mediaId, alt: values.alt, caption: values.caption, layout: values.layout };
      return image
        ? caseStudyApi.updateAdminCaseStudyImage(caseStudyId, image.id, body)
        : caseStudyApi.createAdminCaseStudyImage(caseStudyId, body);
    },
    onSuccess: () => {
      toast.success(image ? "Image saved." : "Image added to the gallery.");
      void queryClient.invalidateQueries({ queryKey: adminKeys.caseStudy(caseStudyId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      onDone();
    },
    onError: (error) => serverErrors.handle(error),
  });

  return (
    <FormProvider {...form}>
      <form
        className={styles.resultForm}
        noValidate
        aria-label={image ? `Edit gallery image ${image.alt}` : "New gallery image"}
        onSubmit={form.handleSubmit((values) => {
          serverErrors.clear();
          save.mutate(values);
        })}
      >
        <FormAlert message={serverErrors.formError} />
        <div className={styles.row}>
          {target.thumb ? <img src={target.thumb} alt="" className={kit.thumb} /> : <span className={kit.thumbEmpty} aria-hidden="true" />}
          <p className={kit.muted}>{target.name}</p>
        </div>
        <TextField name="alt" label="Alt text" required hint={ALT_HINT} counterMax={250} />
        {altMissing && <p className={kit.error}>{ADD_ALT_BEFORE_SAVING}</p>}
        <TextField name="caption" label="Caption" counterMax={200} />
        <RadioGroupField name="layout" label="Layout" options={LAYOUT_OPTIONS} />
        <div className={kit.actions}>
          <Button type="submit" loading={save.isPending} disabled={altMissing}>
            Save image
          </Button>
          <button type="button" className={kit.smallButton} onClick={() => discard.confirm(form.formState.isDirty, onDone)}>
            Cancel
          </button>
        </div>
      </form>
      {discard.element}
    </FormProvider>
  );
}

export function GalleryEditor({ caseStudy }: { caseStudy: AdminCaseStudy }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = adminKeys.caseStudy(caseStudy.id);
  const [picking, setPicking] = useState(false);
  const [newTile, setNewTile] = useState<TileTarget | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const discard = useDiscardConfirm();
  const [pendingDelete, setPendingDelete] = useState<AdminCaseStudyImage | null>(null);

  const read = useCallback(() => queryClient.getQueryData<AdminCaseStudy>(key)?.images, [queryClient, key]);
  const write = useCallback(
    (images: AdminCaseStudyImage[]) => queryClient.setQueryData<AdminCaseStudy>(key, (old) => (old ? { ...old, images } : old)),
    [queryClient, key],
  );
  const send = useCallback((ids: string[]) => caseStudyApi.reorderAdminCaseStudyImages(caseStudy.id, ids), [caseStudy.id]);
  const titleOf = (img: AdminCaseStudyImage) => img.alt || "image";
  const reorder = useReorder<AdminCaseStudyImage>({ read, write, refetchKey: key, getId: (i) => i.id, getTitle: titleOf, send });

  const remove = useMutation({
    mutationFn: (img: AdminCaseStudyImage) => caseStudyApi.deleteAdminCaseStudyImage(caseStudy.id, img.id),
    onSuccess: () => {
      setPendingDelete(null);
      toast.success("Image removed from the gallery.");
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
    onError: (error) => {
      setPendingDelete(null);
      toast.error(errorMessage(error));
    },
  });

  const onPicked = (asset: MediaAsset) => {
    setPicking(false);
    setNewTile({ mediaId: asset.id, thumb: thumbnailUrl(asset), name: assetName(asset) });
  };

  return (
    <section aria-labelledby="gallery-heading" className={kit.page}>
      <h2 id="gallery-heading" className={kit.sectionTitle}>
        Gallery
      </h2>
      {caseStudy.images.length === 0 && !newTile && <EmptyState title="No gallery images yet" body="Add images to show the work." />}
      {caseStudy.images.length > 0 && (
        <ReorderableList
          label="Gallery images in display order"
          items={caseStudy.images}
          getId={(i) => i.id}
          getTitle={titleOf}
          onMove={reorder.move}
          saving={reorder.saving}
          announcement={reorder.announcement}
          renderItem={(img) =>
            editing === img.id ? (
              <ImageForm
                caseStudyId={caseStudy.id}
                image={img}
                target={{ mediaId: img.media_id, thumb: thumbnailUrl(img.image), name: img.alt }}
                onDone={() => setEditing(null)}
                onDirtyChange={setEditDirty}
              />
            ) : (
              <div className={styles.row}>
                {thumbnailUrl(img.image) ? (
                  <img src={thumbnailUrl(img.image)!} alt="" className={kit.thumb} />
                ) : (
                  <span className={kit.thumbEmpty} aria-hidden="true" />
                )}
                <div className={styles.rowText}>
                  <p className={styles.rowTitle}>{img.alt}</p>
                  <p className={kit.muted}>
                    {imageLayoutLabels[img.layout]}
                    {img.caption ? ` · ${img.caption}` : ""}
                  </p>
                </div>
                <div className={kit.actions}>
                  <button type="button" className={kit.smallButton} onClick={() => discard.confirm(editing !== null && editDirty, () => setEditing(img.id))}
                    aria-label={`Edit ${titleOf(img)}`}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${kit.smallButton} ${kit.dangerButton}`}
                    onClick={() => setPendingDelete(img)}
                    aria-label={`Delete ${titleOf(img)}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          }
        />
      )}
      {newTile ? (
        <ImageForm caseStudyId={caseStudy.id} target={newTile} onDone={() => setNewTile(null)} />
      ) : (
        <div>
          <Button variant="ghost" onClick={() => setPicking(true)}>
            Add image
          </Button>
        </div>
      )}

      {caseStudy.images.length > 0 && (
        <div className={kit.panel}>
          <h3 className={kit.legend}>Layout preview</h3>
          <ul className={styles.previewGrid} aria-label="Gallery layout preview">
            {caseStudy.images.map((img) => {
              const thumb = thumbnailUrl(img.image);
              return (
                <li key={img.id} className={cx(img.layout === "full" ? styles.previewFull : styles.previewHalf)} data-layout={img.layout}>
                  {thumb ? <img src={thumb} alt={img.alt} className={styles.previewTile} /> : <span className={styles.previewTile} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {picking && <MediaPicker onSelect={onPicked} onClose={() => setPicking(false)} />}
      {pendingDelete && (
        <ConfirmDialog
          title="Remove this image from the gallery?"
          message="The image stays in the media library and can be added again."
          confirmLabel="Remove image"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {discard.element}
    </section>
  );
}
