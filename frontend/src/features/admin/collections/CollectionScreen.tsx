/**
 * List + `SidePanel` screen for the small content types (UI-049..UI-054, UI-040, TS-016): services, engagement
 * models, testimonials, values and process steps. The list is a `ReorderableList` (full id list on every move);
 * "New …" and "Edit" open the panel form (docked beside the list on desktop, a full-screen sheet below 810 px).
 * Saving invalidates the list and the dashboard; delete goes through `ConfirmDialog`.
 * States: loading, empty + create, error + Retry, saving, validation (server `fields` mapped), delete confirm.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { FormProvider, useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import type { z } from "@/shared/zod/classic";
import { Button } from "@/shared/ui/Button/Button";
import { ConfirmDialog } from "../ui/Dialog";
import { FormAlert } from "../ui/fields";
import { PublishChips } from "../ui/PublishChips";
import { ReorderableList, useListReorder } from "../ui/ReorderableList";
import { useServerErrors } from "../ui/server-errors";
import { SidePanel, useGuardedPanel } from "../ui/SidePanel";
import { AdminPage, EmptyState, errorMessage, ErrorState, LoadingState } from "../ui/states";
import { useToast } from "../ui/Toast";
import { useReportDirty } from "../ui/UnsavedChangesGuard";
import { adminKeys } from "../api/query";
import kit from "../ui/Kit.module.css";
import styles from "../case-studies/CaseStudies.module.css";

export interface CollectionApi<T, I> {
  list: () => Promise<T[]>;
  get: (id: string) => Promise<T>;
  create: (body: I) => Promise<T>;
  update: (id: string, body: I) => Promise<T>;
  remove: (id: string) => Promise<unknown>;
  reorder: (ids: string[]) => Promise<unknown>;
}

export interface CollectionScreenProps<T extends { id: string; is_published: boolean }, V extends FieldValues, I> {
  title: string;
  /** Singular noun, sentence case: "service", "engagement model". */
  noun: string;
  queryKey: QueryKey;
  api: CollectionApi<T, I>;
  schema: z.ZodType<I, V>;
  toValues: (item?: T) => DefaultValues<V>;
  fieldOrder: readonly string[];
  fields: ReactNode;
  getTitle: (item: T) => string;
  summary?: (item: T) => ReactNode;
  intro?: ReactNode;
  emptyBody?: string;
}

type PanelTarget = { mode: "new" } | { mode: "edit"; item: T0 };
type T0 = { id: string; is_published: boolean };

function PanelForm<T extends T0, V extends FieldValues, I>({
  props,
  item,
  onClose,
  onSaved,
  onDirtyChange,
}: {
  props: CollectionScreenProps<T, V, I>;
  item?: T;
  onClose: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { api, queryKey, schema, toValues, fieldOrder, fields, noun, getTitle } = props;
  const queryClient = useQueryClient();
  const toast = useToast();
  // Fresh copy via the get operation; the list row is shown meanwhile.
  const fresh = useQuery({
    queryKey: [...queryKey, item?.id ?? "new"],
    queryFn: () => api.get(item!.id),
    enabled: item !== undefined,
    initialData: item,
    initialDataUpdatedAt: 0,
  });
  const current = (fresh.data as T | undefined) ?? item;
  const form = useForm<V, unknown, I>({ resolver: zodResolver(schema as never), defaultValues: toValues(current) });
  const serverErrors = useServerErrors(form, fieldOrder);
  useReportDirty(form.formState.isDirty, onDirtyChange);

  const save = useMutation({
    mutationFn: (body: I) => (item ? api.update(item.id, body) : api.create(body)),
    onSuccess: (saved) => {
      toast.success(item ? `Saved “${getTitle(saved)}”.` : `Created “${getTitle(saved)}”.`);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      onSaved();
    },
    onError: (error) => serverErrors.handle(error),
  });

  const heading = item ? `Edit ${noun}` : `New ${noun}`;
  return (
    <SidePanel title={heading} onClose={onClose}>
      {(headingId) => (
        <FormProvider {...form}>
          <form
            className={kit.form}
            noValidate
            aria-labelledby={headingId}
            onSubmit={form.handleSubmit((values) => {
              serverErrors.clear();
              save.mutate(values);
            })}
          >
            <FormAlert message={serverErrors.formError} />
            {fields}
            <div className={kit.formFooter}>
              <Button type="submit" loading={save.isPending}>
                {item ? "Save" : `Create ${noun}`}
              </Button>
              <button type="button" className={kit.smallButton} onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </FormProvider>
      )}
    </SidePanel>
  );
}

export function CollectionScreen<T extends T0, V extends FieldValues, I>(props: CollectionScreenProps<T, V, I>) {
  const { title, noun, queryKey, api, getTitle, summary, intro, emptyBody } = props;
  const queryClient = useQueryClient();
  const toast = useToast();
  const panels = useGuardedPanel<PanelTarget>();
  const { panel, open } = panels;
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const list = useQuery({ queryKey, queryFn: api.list });
  const reorder = useListReorder<T>({ queryKey, getId: (i) => i.id, getTitle, send: api.reorder });

  const remove = useMutation({
    mutationFn: (item: T) => api.remove(item.id),
    onSuccess: (_d, item) => {
      setPendingDelete(null);
      if (panel?.mode === "edit" && panel.item.id === item.id) panels.closeSaved();
      toast.success(`Deleted “${getTitle(item)}”.`);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
    onError: (error) => {
      setPendingDelete(null);
      toast.error(errorMessage(error));
    },
  });

  const createButton = (
    <button type="button" className={kit.smallButton} onClick={() => open({ mode: "new" })}>
      New {noun}
    </button>
  );
  const items = (list.data ?? []) as T[];

  return (
    <AdminPage title={title} actions={createButton}>
      {intro && <p className={kit.hint}>{intro}</p>}
      <div className={kit.split} data-panel-open={panel ? "" : undefined}>
        <div>
          {list.isPending && <LoadingState />}
          {list.isError && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
          {list.data && items.length === 0 && <EmptyState title={`No ${noun}s yet`} body={emptyBody} action={createButton} />}
          {items.length > 0 && (
            <ReorderableList
              label={`${title} in display order`}
              items={items}
              getId={(i) => i.id}
              getTitle={getTitle}
              onMove={reorder.move}
              saving={reorder.saving}
              announcement={reorder.announcement}
              renderItem={(item) => (
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <p className={styles.rowTitle}>{getTitle(item)}</p>
                    {summary && <div className={kit.muted}>{summary(item)}</div>}
                    <PublishChips published={item.is_published} />
                  </div>
                  <div className={kit.actions}>
                    <button type="button" className={kit.smallButton} onClick={() => open({ mode: "edit", item })} aria-label={`Edit ${getTitle(item)}`}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`${kit.smallButton} ${kit.dangerButton}`}
                      onClick={() => setPendingDelete(item)}
                      aria-label={`Delete ${getTitle(item)}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            />
          )}
        </div>
        {panel && (
          <PanelForm
            key={`${panels.panelKey}:${panel.mode === "edit" ? panel.item.id : "new"}`}
            props={props}
            item={panel.mode === "edit" ? (panel.item as T) : undefined}
            onClose={panels.close}
            onSaved={panels.closeSaved}
            onDirtyChange={panels.onDirtyChange}
          />
        )}
      </div>
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete this ${noun}?`}
          message={`“${getTitle(pendingDelete)}” will be deleted. This cannot be undone.`}
          confirmLabel={`Delete ${noun}`}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {panels.element}
    </AdminPage>
  );
}
