/**
 * Writing samples list `/admin/writing` (UI-047, REQ-064, REQ-067): as the case-study list, with title, format label
 * and chips. Note: `AdminWritingSampleListItem` carries no `published_on` or `is_featured`, so the row shows the last
 * update date and the Published/Draft and Sample chips (Featured is shown in the editor).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { writingFormatLabels } from "@/shared/utils/labels";
import { writingApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminWritingSampleListItem } from "../api/types";
import { formatLocalDateTime } from "../dashboard/DashboardPage";
import { ConfirmDialog } from "../ui/Dialog";
import { PublishChips } from "../ui/PublishChips";
import { ReorderableList, useListReorder } from "../ui/ReorderableList";
import { AdminPage, EmptyState, errorMessage, ErrorState, LoadingState } from "../ui/states";
import { useToast } from "../ui/Toast";
import kit from "../ui/Kit.module.css";
import styles from "../case-studies/CaseStudies.module.css";

const getId = (item: AdminWritingSampleListItem) => item.id;
const getTitle = (item: AdminWritingSampleListItem) => item.title;

export function WritingListPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<AdminWritingSampleListItem | null>(null);
  const list = useQuery({ queryKey: adminKeys.writingSamples, queryFn: writingApi.listAdminWritingSamples });
  const reorder = useListReorder<AdminWritingSampleListItem>({
    queryKey: adminKeys.writingSamples,
    getId,
    getTitle,
    send: writingApi.reorderAdminWritingSamples,
  });
  const remove = useMutation({
    mutationFn: (item: AdminWritingSampleListItem) => writingApi.deleteAdminWritingSample(item.id),
    onSuccess: (_d, item) => {
      setPendingDelete(null);
      toast.success(`Deleted “${item.title}”.`);
      void queryClient.invalidateQueries({ queryKey: adminKeys.writingSamples });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
    onError: (error) => {
      setPendingDelete(null);
      toast.error(errorMessage(error));
    },
  });

  const createLink = (
    <Link to="/admin/writing/new" className={kit.smallButton}>
      New writing sample
    </Link>
  );

  return (
    <AdminPage title="Writing samples" actions={createLink}>
      {list.isPending && <LoadingState />}
      {list.isError && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.data && list.data.length === 0 && (
        <EmptyState title="No writing samples yet" body="Add a sample to show it on the Writing page." action={createLink} />
      )}
      {list.data && list.data.length > 0 && (
        <ReorderableList
          label="Writing samples in display order"
          items={list.data}
          getId={getId}
          getTitle={getTitle}
          onMove={reorder.move}
          saving={reorder.saving}
          announcement={reorder.announcement}
          renderItem={(item) => (
            <div className={styles.row}>
              <div className={styles.rowText}>
                <p className={styles.rowTitle}>{item.title}</p>
                <p className={kit.muted}>
                  {writingFormatLabels[item.format]} · Updated{" "}
                  <time dateTime={item.updated_at}>{formatLocalDateTime(item.updated_at)}</time>
                </p>
                <PublishChips published={item.is_published} sample={item.is_sample} />
              </div>
              <div className={kit.actions}>
                <Link to={`/admin/writing/${item.id}`} className={kit.smallButton} aria-label={`Edit ${item.title}`}>
                  Edit
                </Link>
                <button
                  type="button"
                  className={`${kit.smallButton} ${kit.dangerButton}`}
                  onClick={() => setPendingDelete(item)}
                  aria-label={`Delete ${item.title}`}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this writing sample?"
          message={`“${pendingDelete.title}” will be deleted. Its thumbnail stays in the media library. This cannot be undone.`}
          confirmLabel="Delete writing sample"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </AdminPage>
  );
}
