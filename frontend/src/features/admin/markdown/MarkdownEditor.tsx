/**
 * Markdown editor with live preview (UI-041, TS-012, TS-016 note 5).
 * - Labelled `<textarea>` with a short syntax help and a character counter / limit.
 * - Preview via `previewAdminMarkdown`, debounced 400 ms. The query key is the editor's id plus a revision counter
 *   (never the text itself), so each debounced text is its own small query: only the latest revision's response is
 *   shown (stale responses are ignored), the previous preview stays while the next one loads, and superseded
 *   previews are dropped from the cache at once (`gcTime: 0`).
 * - Rendered through `SanitizedHtml` (branded HTML from the typed mapper).
 * - Desktop (≥ 1200 px): editor and preview side by side; below: "Write" / "Preview" tabs.
 * - States: empty ("Nothing to preview yet"), loading, error ("Preview unavailable. Your text is not affected." +
 *   Retry), success.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState, type KeyboardEvent, type Ref } from "react";
import { SanitizedHtml } from "@/shared/ui/SanitizedHtml/SanitizedHtml";
import { markdownApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import { counterText, RequiredMark } from "../ui/fields";
import kit from "../ui/Kit.module.css";
import { mapMarkdownPreview } from "./preview-mapper";
import styles from "./MarkdownEditor.module.css";

export const PREVIEW_DEBOUNCE_MS = 400;
export const MARKDOWN_MAX = 100_000;
export const PREVIEW_ERROR = "Preview unavailable. Your text is not affected.";

export function limitMessage(max: number): string {
  return `Keep this to ${max.toLocaleString("en")} characters or fewer.`;
}

/** Debounces `value` and numbers each settled value (revision), for keys that must not contain the text. */
export function useDebouncedRevision(value: string, delayMs: number): { text: string; revision: number } {
  const [state, setState] = useState({ text: value, revision: 0 });
  useEffect(() => {
    const timer = setTimeout(
      () => setState((current) => (current.text === value ? current : { text: value, revision: current.revision + 1 })),
      delayMs,
    );
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return state;
}

export interface MarkdownEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  error?: string;
  required?: boolean;
  maxLength?: number;
  rows?: number;
}

type Tab = "write" | "preview";

export function MarkdownEditor({ label, value, onChange, onBlur, inputRef, error, required, maxLength = MARKDOWN_MAX, rows = 12 }: MarkdownEditorProps) {
  const base = useId();
  const ids = {
    input: `${base}-input`,
    help: `${base}-help`,
    counter: `${base}-counter`,
    error: `${base}-error`,
    writeTab: `${base}-tab-write`,
    previewTab: `${base}-tab-preview`,
    writePanel: `${base}-panel-write`,
    previewPanel: `${base}-panel-preview`,
  };
  const [tab, setTab] = useState<Tab>("write");
  const { text: debounced, revision } = useDebouncedRevision(value, PREVIEW_DEBOUNCE_MS);
  const over = value.length > maxLength;
  const shownError = error ?? (over ? limitMessage(maxLength) : undefined);
  const canPreview = debounced.trim() !== "" && debounced.length <= maxLength;

  const preview = useQuery({
    queryKey: adminKeys.markdownPreview(base, revision),
    queryFn: async () => mapMarkdownPreview(await markdownApi.previewAdminMarkdown(debounced)),
    enabled: canPreview,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: Tab = tab === "write" ? "preview" : "write";
    setTab(next);
    document.getElementById(next === "write" ? ids.writeTab : ids.previewTab)?.focus();
  };

  const describedBy = [ids.help, ids.counter, shownError ? ids.error : null].filter(Boolean).join(" ");
  const isEmpty = value.trim() === "";

  return (
    <div className={styles.editor}>
      <div role="tablist" aria-label={`${label}: write or preview`} className={`${kit.tablist} ${styles.tabs}`}>
        {(["write", "preview"] as const).map((name) => (
          <button
            key={name}
            id={name === "write" ? ids.writeTab : ids.previewTab}
            type="button"
            role="tab"
            aria-selected={tab === name}
            aria-controls={name === "write" ? ids.writePanel : ids.previewPanel}
            tabIndex={tab === name ? 0 : -1}
            className={kit.tab}
            onClick={() => setTab(name)}
            onKeyDown={onTabKey}
          >
            {name === "write" ? "Write" : "Preview"}
          </button>
        ))}
      </div>
      <div className={styles.panes}>
        <div id={ids.writePanel} role="tabpanel" aria-labelledby={ids.writeTab} className={styles.pane} data-active={tab === "write" || undefined}>
          <label htmlFor={ids.input} className={kit.label}>
            {label}
            {required && <RequiredMark />}
          </label>
          <textarea
            id={ids.input}
            ref={inputRef}
            rows={rows}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            className={`${kit.input} ${kit.textarea} ${styles.textarea}`}
            aria-required={required || undefined}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={describedBy}
          />
          <p id={ids.help} className={kit.hint}>
            Markdown: # Heading, **bold**, *italic*, - list, 1. numbered list, [link](https://…), &gt; quote, tables.
            Images are not allowed in the text; raw HTML is shown as text.
          </p>
          <p id={ids.counter} className={kit.counter} data-over={over || undefined}>
            {counterText(value.length, maxLength)}
          </p>
          {shownError && (
            <p id={ids.error} className={kit.error}>
              {shownError}
            </p>
          )}
        </div>
        <div
          id={ids.previewPanel}
          role="tabpanel"
          aria-labelledby={ids.previewTab}
          aria-busy={preview.isFetching || undefined}
          className={`${styles.pane} ${styles.preview}`}
          data-active={tab === "preview" || undefined}
        >
          <p className={styles.previewLabel}>
            Preview
            {preview.isFetching && (
              <span className={kit.loading}>
                <span className={kit.spinner} aria-hidden="true" />
                <span className="visually-hidden">Updating preview…</span>
              </span>
            )}
          </p>
          {isEmpty ? (
            <p className={kit.muted}>Nothing to preview yet</p>
          ) : preview.isError ? (
            <div role="alert" className={kit.state}>
              <p>{PREVIEW_ERROR}</p>
              <button type="button" className={kit.smallButton} onClick={() => void preview.refetch()}>
                Retry preview
              </button>
            </div>
          ) : preview.data ? (
            <SanitizedHtml html={preview.data.html} className={styles.prose} />
          ) : (
            <p className={kit.muted}>Preparing preview…</p>
          )}
        </div>
      </div>
    </div>
  );
}
