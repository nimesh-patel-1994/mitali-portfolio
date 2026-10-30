/**
 * Case studies list `/admin/case-studies` (UI-043, REQ-063, REQ-067).
 * `ReorderableList` rows: cover thumbnail, title, campaign type, chips (Published/Draft, Featured, Sample), Edit and
 * Delete. The delete confirmation names the case study and says its results and gallery entries go too.
 * Note: the list item schema (`AdminCaseStudyListItem`) has no client name, so the row shows the campaign type.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { caseStudyApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminCaseStudyListItem } from "../api/types";
import { thumbnailUrl } from "../media/media-utils";
import { ConfirmDialog } from "../ui/Dialog";
import { PublishChips } from "../ui/PublishChips";
import { ReorderableList, useListReorder } from "../ui/ReorderableList";
import { AdminPage, EmptyState, errorMessage, ErrorState, LoadingState } from "../ui/states";
import { useToast } from "../ui/Toast";
import kit from "../ui/Kit.module.css";
import styles from "./CaseStudies.module.css";

const getId = (item: AdminCaseStudyListItem) => item.id;
const getTitle = (item: AdminCaseStudyListItem) => item.title;

export function CaseStudiesListPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<AdminCaseStudyListItem | null>(null);
  const list = useQuery({ queryKey: adminKeys.caseStudies, queryFn: caseStudyApi.listAdminCaseStudies });
  const reorder = useListReorder<AdminCaseStudyListItem>({
    queryKey: adminKeys.caseStudies,
    getId,
    getTitle,
    send: caseStudyApi.reorderAdminCaseStudies,
  });

  const remove = useMutation({
    mutationFn: (item: AdminCaseStudyListItem) => caseStudyApi.deleteAdminCaseStudy(item.id),
    onSuccess: (_data, item) => {
      setPendingDelete(null);
      toast.success(`Deleted “${item.title}”.`);
      void queryClient.invalidateQueries({ queryKey: adminKeys.caseStudies });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
    onError: (error) => {
      setPendingDelete(null);
      toast.error(errorMessage(error));
    },
  });

  const createLink = (
    <Link to="/admin/case-studies/new" className={kit.smallButton}>
      New case study
    </Link>
  );

  return (
    <AdminPage title="Case studies" actions={createLink}>
      {list.isPending && <LoadingState />}
      {list.isError && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {list.data && list.data.length === 0 && (
        <EmptyState title="No case studies yet" body="Create the first one to show it on the Work page." action={createLink} />
      )}
      {list.data && list.data.length > 0 && (
        <ReorderableList
          label="Case studies in display order"
          items={list.data}
          getId={getId}
          getTitle={getTitle}
          onMove={reorder.move}
          saving={reorder.saving}
          announcement={reorder.announcement}
          renderItem={(item) => {
            const thumb = thumbnailUrl(item.cover);
            return (
              <div className={styles.row}>
                {thumb ? <img src={thumb} alt="" className={kit.thumb} /> : <span className={kit.thumbEmpty} aria-hidden="true" />}
                <div className={styles.rowText}>
                  <p className={styles.rowTitle}>{item.title}</p>
                  <p className={kit.muted}>{item.campaign_type}</p>
                  <PublishChips published={item.is_published} featured={item.is_featured} sample={item.is_sample} />
                </div>
                <div className={kit.actions}>
                  <Link to={`/admin/case-studies/${item.id}`} className={kit.smallButton} aria-label={`Edit ${item.title}`}>
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
            );
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this case study?"
          message={`“${pendingDelete.title}” will be deleted together with its results and gallery entries. Images stay in the media library. This cannot be undone.`}
          confirmLabel="Delete case study"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </AdminPage>
  );
}
