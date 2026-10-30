/**
 * `ReorderableList` (UI-039, TS-010, TS-016 note 4, UI-REV-016) and the `useReorder` hook.
 * - Each row has a pointer drag handle (no extra dependency) and "Move <title> up/down" buttons; the first row's
 *   "up" and the last row's "down" are disabled. Rows are keyed by item id.
 * - Every move sends the full id list (via the screen's `reorderAdmin*` operation), applies an optimistic update to
 *   the query cache, announces "Moved <title> to position 3 of 6" in a polite live region and keeps focus on the
 *   moved row's button.
 * - Before the optimistic write, an in-flight fetch of the list is cancelled (`cancelQueries`) so a late response
 *   cannot overwrite the new order.
 * - Moves made while a save is running are queued. Error → rollback + error toast; 422 `order_mismatch` → refetch +
 *   "The list changed elsewhere and has been reloaded."
 */
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon, GripIcon } from "@/shared/ui/Icon/Icon";
import { cx } from "@/shared/utils/cx";
import { isApiError } from "../api/errors";
import { adminKeys } from "../api/query";
import { useToast } from "./Toast";
import kit from "./Kit.module.css";
import styles from "./ReorderableList.module.css";

export const ORDER_MISMATCH_MESSAGE = "The list changed elsewhere and has been reloaded.";
export const REORDER_FAILED_MESSAGE = "The new order could not be saved. The previous order has been restored.";

export function movedMessage(title: string, position: number, total: number): string {
  return `Moved ${title} to position ${position} of ${total}`;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export interface UseReorderOptions<T> {
  /** Reads the current list from the cache. */
  read: () => T[] | undefined;
  /** Writes a list into the cache (optimistic update and rollback). */
  write: (items: T[]) => void;
  /** Query to refetch after an `order_mismatch`. */
  refetchKey: QueryKey;
  getId: (item: T) => string;
  getTitle: (item: T) => string;
  send: (ids: string[]) => Promise<unknown>;
}

export function useReorder<T>({ read, write, refetchKey, getId, getTitle, send }: UseReorderOptions<T>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [announcement, setAnnouncement] = useState("");
  const [pending, setPending] = useState(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);

  const move = useCallback(
    (id: string, to: number) => {
      // Cancel an in-flight fetch of the list first: otherwise its response (or the revert of its cancellation)
      // could overwrite the optimistic order.
      void (async () => {
        await queryClient.cancelQueries({ queryKey: refetchKey, exact: true });
        const before = read();
        if (!before) return;
        const from = before.findIndex((item) => getId(item) === id);
        if (from < 0 || to < 0 || to >= before.length || from === to) return;
        const next = moveItem(before, from, to);
        write(next);
        setAnnouncement(movedMessage(getTitle(before[from]!), to + 1, next.length));
        setPending((n) => n + 1);
        const myGeneration = generation.current;
        const ids = next.map(getId);

        queue.current = queue.current.then(async () => {
          try {
            if (myGeneration !== generation.current) return;
            await send(ids);
            void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
          } catch (error) {
            generation.current += 1;
            if (isApiError(error) && error.code === "order_mismatch") {
              toast.error(ORDER_MISMATCH_MESSAGE);
            } else {
              write(before);
              toast.error(REORDER_FAILED_MESSAGE);
            }
            await queryClient.invalidateQueries({ queryKey: refetchKey });
          } finally {
            setPending((n) => n - 1);
          }
        });
      })();
    },
    [read, write, getId, getTitle, send, queryClient, refetchKey, toast],
  );

  return { move, saving: pending > 0, announcement };
}

export interface ReorderableListProps<T> {
  items: readonly T[];
  getId: (item: T) => string;
  getTitle: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onMove: (id: string, toIndex: number) => void;
  saving?: boolean;
  announcement?: string;
  /** Accessible name of the list, e.g. "Case studies in display order". */
  label: string;
}

type Direction = "up" | "down";

export function ReorderableList<T>({ items, getId, getTitle, renderItem, onMove, saving = false, announcement = "", label }: ReorderableListProps<T>) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const rows = useRef(new Map<string, HTMLLIElement>());
  const focusAfterMove = useRef<{ id: string; direction: Direction } | null>(null);
  const drag = useRef<{ id: string; from: number; pointerId: number } | null>(null);
  const [dragState, setDragState] = useState<{ id: string; over: number } | null>(null);

  // Keep focus on the moved row's button (or its sibling when that button became disabled).
  useEffect(() => {
    const target = focusAfterMove.current;
    if (!target) return;
    focusAfterMove.current = null;
    const index = items.findIndex((item) => getId(item) === target.id);
    if (index < 0) return;
    const disabled = (target.direction === "up" && index === 0) || (target.direction === "down" && index === items.length - 1);
    const direction: Direction = disabled ? (target.direction === "up" ? "down" : "up") : target.direction;
    buttons.current.get(`${target.id}:${direction}`)?.focus();
  }, [items, getId]);

  const moveBy = (id: string, index: number, direction: Direction) => {
    focusAfterMove.current = { id, direction };
    onMove(id, direction === "up" ? index - 1 : index + 1);
  };

  const indexAtPointer = (clientY: number): number => {
    let target = items.length - 1;
    for (let i = 0; i < items.length; i += 1) {
      const row = rows.current.get(getId(items[i]!));
      if (!row) continue;
      const rect = row.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        target = i;
        break;
      }
    }
    return target;
  };

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>, id: string, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { id, from: index, pointerId: event.pointerId };
    setDragState({ id, over: index });
  };

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const over = indexAtPointer(event.clientY);
    setDragState((current) => (current && current.over !== over ? { ...current, over } : current));
  };

  const endDrag = (event: PointerEvent<HTMLSpanElement>, commit: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    const over = indexAtPointer(event.clientY);
    setDragState(null);
    if (commit && over !== current.from) onMove(current.id, over);
  };

  return (
    <div className={styles.wrap} aria-busy={saving || undefined}>
      <ol className={styles.list} aria-label={label}>
        {items.map((item, index) => {
          const id = getId(item);
          const title = getTitle(item);
          return (
            <li
              key={id}
              ref={(el) => {
                if (el) rows.current.set(id, el);
                else rows.current.delete(id);
              }}
              className={cx(styles.row, dragState?.id === id && styles.dragging, dragState && dragState.id !== id && dragState.over === index && styles.dropTarget)}
            >
              <span
                className={styles.handle}
                aria-hidden="true"
                title="Drag to reorder"
                onPointerDown={(e) => onPointerDown(e, id, index)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => endDrag(e, true)}
                onPointerCancel={(e) => endDrag(e, false)}
              >
                <GripIcon />
              </span>
              <div className={styles.content}>{renderItem(item, index)}</div>
              <div className={styles.moves}>
                <button
                  ref={(el) => {
                    if (el) buttons.current.set(`${id}:up`, el);
                    else buttons.current.delete(`${id}:up`);
                  }}
                  type="button"
                  className={kit.smallButton}
                  disabled={index === 0}
                  onClick={() => moveBy(id, index, "up")}
                  aria-label={`Move ${title} up`}
                >
                  <ChevronUpIcon />
                </button>
                <button
                  ref={(el) => {
                    if (el) buttons.current.set(`${id}:down`, el);
                    else buttons.current.delete(`${id}:down`);
                  }}
                  type="button"
                  className={kit.smallButton}
                  disabled={index === items.length - 1}
                  onClick={() => moveBy(id, index, "down")}
                  aria-label={`Move ${title} down`}
                >
                  <ChevronDownIcon />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p className={styles.saving} aria-hidden={!saving}>
        {saving && (
          <>
            <span className={kit.spinner} aria-hidden="true" /> Saving order…
          </>
        )}
      </p>
      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
    </div>
  );
}

/** `useReorder` for a plain list query (`T[]` under `queryKey`). */
export function useListReorder<T>(options: {
  queryKey: QueryKey;
  getId: (item: T) => string;
  getTitle: (item: T) => string;
  send: (ids: string[]) => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const { queryKey, getId, getTitle, send } = options;
  const read = useCallback(() => queryClient.getQueryData<T[]>(queryKey), [queryClient, queryKey]);
  const write = useCallback((items: T[]) => queryClient.setQueryData<T[]>(queryKey, items), [queryClient, queryKey]);
  return useReorder<T>({ read, write, refetchKey: queryKey, getId, getTitle, send });
}
