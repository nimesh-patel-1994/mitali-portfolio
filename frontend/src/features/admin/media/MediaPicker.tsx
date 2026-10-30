/**
 * Media picker dialog (UI-042, TS-011): tabs Upload and Library.
 * - Upload: file input (always keyboard-usable) plus a drop zone; client pre-checks type and size with the server's
 *   wording, then `uploadAdminMedia`. While processing: indeterminate progress, Cancel disabled. Server errors 413 /
 *   415 / 422 `invalid_image` mapped to messages. Success selects the new asset.
 * - Library: newest first, `page_size` 24, "Load more"; each tile is a button (filename + dimensions); "Delete"
 *   asks for confirmation; 409 `media_in_use` → "This image is used by content. Remove it there first."
 * Images are shown only through `<img>` with root-relative `/media/` URLs (SEC-UI-009).
 */
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { MEDIA_PAGE_SIZE, mediaApi } from "../api/admin-api";
import { isApiError } from "../api/errors";
import { adminKeys } from "../api/query";
import type { MediaAsset } from "../api/types";
import { ConfirmDialog, Dialog } from "../ui/Dialog";
import { errorMessage, ErrorState, LoadingState } from "../ui/states";
import { useToast } from "../ui/Toast";
import kit from "../ui/Kit.module.css";
import { ACCEPT, assetName, checkUploadFile, MEDIA_MESSAGES, thumbnailUrl } from "./media-utils";
import styles from "./MediaPicker.module.css";

type Tab = "upload" | "library";

function uploadErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 413 || error.code === "file_too_large") return MEDIA_MESSAGES.tooLarge;
    if (error.status === 415 || error.code === "unsupported_media_type") return MEDIA_MESSAGES.wrongType;
    if (error.code === "invalid_image") return MEDIA_MESSAGES.invalidImage;
  }
  return errorMessage(error);
}

function UploadPanel({ onUploaded, onBusyChange }: { onUploaded: (asset: MediaAsset) => void; onBusyChange: (busy: boolean) => void }) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) => mediaApi.uploadAdminMedia(file),
    onMutate: () => onBusyChange(true),
    onSettled: () => onBusyChange(false),
    onSuccess: (asset) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.media });
      onUploaded(asset);
    },
    onError: (error) => setMessage(uploadErrorMessage(error)),
  });

  const start = (file: File | undefined) => {
    if (!file || upload.isPending) return;
    const problem = checkUploadFile(file);
    setMessage(problem);
    if (problem === null) upload.mutate(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    start(event.dataTransfer.files[0]);
  };

  return (
    <div className={styles.upload}>
      <div
        className={styles.dropZone}
        data-over={dragOver || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <label htmlFor={inputId} className={kit.label}>
          Choose an image file
        </label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          disabled={upload.isPending}
          aria-describedby={`${hintId}${message ? ` ${errorId}` : ""}`}
          aria-invalid={message ? true : undefined}
          onChange={(event) => {
            start(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <p id={hintId} className={kit.hint}>
          Or drop a file here. JPEG, PNG, WebP or SVG, up to 10 MB.
        </p>
      </div>
      {upload.isPending && (
        <div role="status" className={styles.progress}>
          <progress aria-label={MEDIA_MESSAGES.processing} />
          <span>{MEDIA_MESSAGES.processing}</span>
        </div>
      )}
      {message && (
        <p id={errorId} role="alert" className={kit.error}>
          {message}
        </p>
      )}
    </div>
  );
}

function LibraryPanel({ onSelect }: { onSelect: (asset: MediaAsset) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<MediaAsset | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const library = useInfiniteQuery({
    queryKey: adminKeys.media,
    queryFn: ({ pageParam }) => mediaApi.listAdminMedia(pageParam, MEDIA_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
  });

  const remove = useMutation({
    mutationFn: (asset: MediaAsset) => mediaApi.deleteAdminMedia(asset.id),
    onSuccess: (_data, asset) => {
      setPendingDelete(null);
      toast.success(`Deleted ${assetName(asset)}.`);
      void queryClient.invalidateQueries({ queryKey: adminKeys.media });
    },
    onError: (error) => {
      setPendingDelete(null);
      setDeleteError(isApiError(error) && error.code === "media_in_use" ? MEDIA_MESSAGES.inUse : errorMessage(error));
    },
  });

  if (library.isPending) return <LoadingState label="Loading images…" />;
  if (library.isError) return <ErrorState error={library.error} onRetry={() => void library.refetch()} />;

  const assets = library.data.pages.flatMap((page) => page.items);
  if (assets.length === 0) return <p className={kit.muted}>{MEDIA_MESSAGES.empty}</p>;

  return (
    <div className={styles.library}>
      {deleteError && (
        <p role="alert" className={kit.error}>
          {deleteError}
        </p>
      )}
      <ul className={styles.grid} aria-label="Image library">
        {assets.map((asset) => {
          const name = assetName(asset);
          const thumb = thumbnailUrl(asset);
          return (
            <li key={asset.id} className={styles.tile}>
              <button type="button" className={styles.choose} onClick={() => onSelect(asset)} aria-label={`Choose ${name}, ${asset.width} × ${asset.height}`}>
                {thumb ? <img src={thumb} alt="" width={asset.width} height={asset.height} loading="lazy" className={styles.image} /> : <span className={styles.image} />}
                <span className={styles.name}>{name}</span>
                <span className={kit.muted}>
                  {asset.width} × {asset.height}
                </span>
              </button>
              <button
                type="button"
                className={`${kit.smallButton} ${kit.dangerButton}`}
                onClick={() => {
                  setDeleteError(null);
                  setPendingDelete(asset);
                }}
                aria-label={`Delete ${name}`}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
      {library.hasNextPage && (
        <button type="button" className={kit.smallButton} onClick={() => void library.fetchNextPage()} disabled={library.isFetchingNextPage}>
          {library.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this image?"
          message={`${assetName(pendingDelete)} will be removed from the library. This cannot be undone.`}
          confirmLabel="Delete image"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export interface MediaPickerProps {
  onSelect: (asset: MediaAsset) => void;
  onClose: () => void;
}

export function MediaPicker({ onSelect, onClose }: MediaPickerProps) {
  const [tab, setTab] = useState<Tab>("upload");
  const [busy, setBusy] = useState(false);
  const base = useId();
  const tabs = useRef<Record<Tab, HTMLButtonElement | null>>({ upload: null, library: null });

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: Tab = tab === "upload" ? "library" : "upload";
    setTab(next);
    tabs.current[next]?.focus();
  };

  return (
    <Dialog
      title="Choose image"
      size="large"
      onClose={busy ? () => undefined : onClose}
      footer={
        <button type="button" className={kit.smallButton} onClick={onClose} disabled={busy}>
          Cancel
        </button>
      }
    >
      <div role="tablist" aria-label="Image source" className={kit.tablist}>
        {(["upload", "library"] as const).map((name) => (
          <button
            key={name}
            ref={(el) => {
              tabs.current[name] = el;
            }}
            id={`${base}-${name}-tab`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            // Only the selected tab's panel is rendered; never point at a missing element.
            aria-controls={tab === name ? `${base}-${name}-panel` : undefined}
            tabIndex={tab === name ? 0 : -1}
            className={kit.tab}
            onClick={() => setTab(name)}
            onKeyDown={onTabKey}
            disabled={busy && tab !== name}
          >
            {name === "upload" ? "Upload" : "Library"}
          </button>
        ))}
      </div>
      <div id={`${base}-${tab}-panel`} role="tabpanel" aria-labelledby={`${base}-${tab}-tab`}>
        {tab === "upload" ? <UploadPanel onUploaded={onSelect} onBusyChange={setBusy} /> : <LibraryPanel onSelect={onSelect} />}
      </div>
    </Dialog>
  );
}
