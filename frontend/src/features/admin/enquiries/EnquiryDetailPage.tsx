/**
 * Enquiry detail `/admin/enquiries/:id` (UI-058, REQ-066, REQ-NFR-005, SEC-UI-008). h1 with the sender name;
 * definition list (email as a `mailto:` "Reply by email" link, company, type, budget, received at); the message as
 * plain text with line breaks preserved (never HTML); status radio group New / Replied / Archived that saves on
 * change (PATCH) with a toast — on failure the control reverts; "Delete" with confirmation, then back to the list.
 * The radios are never disabled while saving (that would drop keyboard focus): a change made while a save is pending
 * is queued and sent once the pending save succeeds (the latest choice wins).
 * Status changes invalidate the enquiry lists and the dashboard (new count).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { StatusChip } from "@/shared/ui/Chip/Chip";
import { budgetRangeLabels, enquiryStatusLabels, enquiryTypeLabels } from "@/shared/utils/labels";
import { enquiryApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { Enquiry, EnquiryStatus } from "../api/types";
import { formatLocalDateTime } from "../dashboard/DashboardPage";
import { ConfirmDialog } from "../ui/Dialog";
import { AdminPage, errorMessage, ErrorState, isNotFound, LoadingState, NotFoundState } from "../ui/states";
import { useToast } from "../ui/Toast";
import kit from "../ui/Kit.module.css";
import { statusTone } from "./EnquiriesListPage";
import styles from "./Enquiries.module.css";

const STATUSES: EnquiryStatus[] = ["new", "replied", "archived"];

/** `mailto:` built from the stored address with an encoded subject (SEC-UI-008). */
export function replyHref(enquiry: Pick<Enquiry, "email">): string {
  return `mailto:${encodeURIComponent(enquiry.email).replace(/%40/g, "@")}?subject=${encodeURIComponent("Re: your enquiry")}`;
}

function StatusControl({ enquiry }: { enquiry: Enquiry }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const name = useId();
  const [error, setError] = useState<string | null>(null);
  // Latest choice made while a save was pending; sent after that save succeeds.
  const [queued, setQueued] = useState<EnquiryStatus | null>(null);
  const queuedRef = useRef<EnquiryStatus | null>(null);
  const setQueue = (status: EnquiryStatus | null) => {
    queuedRef.current = status;
    setQueued(status);
  };
  const update = useMutation({
    mutationFn: (status: EnquiryStatus) => enquiryApi.updateAdminEnquiryStatus(enquiry.id, status),
    onMutate: () => setError(null),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.enquiry(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.enquiries, "list"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      const next = queuedRef.current;
      setQueue(null);
      if (next && next !== saved.status) {
        update.mutate(next);
        return;
      }
      toast.success(`Marked as ${enquiryStatusLabels[saved.status].toLowerCase()}.`);
    },
    onError: (err) => {
      setQueue(null);
      setError(`The status could not be changed. ${errorMessage(err)}`);
    },
  });
  const onChange = (status: EnquiryStatus) => {
    if (update.isPending) setQueue(status);
    else update.mutate(status);
  };
  // While saving, show the requested (or queued) value; otherwise the saved one (reverts on failure).
  const shown = queued ?? (update.isPending && update.variables ? update.variables : enquiry.status);

  return (
    <fieldset
      className={kit.field}
      aria-describedby={error ? `${name}-error` : undefined}
      aria-busy={update.isPending || undefined}
    >
      <legend className={kit.label}>Status</legend>
      <div className={kit.radios}>
        {STATUSES.map((status) => (
          <label key={status} className={kit.radio}>
            <input
              type="radio"
              name={name}
              value={status}
              checked={shown === status}
              onChange={() => onChange(status)}
            />
            <span>{enquiryStatusLabels[status]}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} role="alert" className={kit.error}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function EnquiryDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const query = useQuery({ queryKey: adminKeys.enquiry(id), queryFn: () => enquiryApi.getAdminEnquiry(id) });
  const remove = useMutation({
    mutationFn: () => enquiryApi.deleteAdminEnquiry(id),
    onSuccess: () => {
      setConfirmDelete(false);
      queryClient.removeQueries({ queryKey: adminKeys.enquiry(id) });
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.enquiries, "list"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      toast.success("Enquiry deleted.");
      navigate("/admin/enquiries");
    },
    onError: (error) => {
      setConfirmDelete(false);
      toast.error(errorMessage(error));
    },
  });

  const back = (
    <Link to="/admin/enquiries" className={kit.link}>
      Back to enquiries
    </Link>
  );

  if (query.isPending) {
    return (
      <AdminPage title="Enquiry" actions={back}>
        <LoadingState />
      </AdminPage>
    );
  }
  if (query.isError) {
    return (
      <AdminPage title="Enquiry" actions={back}>
        {isNotFound(query.error) ? (
          <NotFoundState backTo="/admin/enquiries" backLabel="Back to enquiries" />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </AdminPage>
    );
  }

  const enquiry = query.data;
  return (
    <AdminPage title="Enquiry" heading={enquiry.name} actions={back}>
      <p>
        <StatusChip tone={statusTone[enquiry.status]}>{enquiryStatusLabels[enquiry.status]}</StatusChip>
      </p>
      <dl className={styles.details}>
        <div>
          <dt>Email</dt>
          <dd>
            {enquiry.email}{" "}
            <a href={replyHref(enquiry)} className={kit.link}>
              Reply by email
            </a>
          </dd>
        </div>
        <div>
          <dt>Company</dt>
          <dd>{enquiry.company ?? "—"}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{enquiryTypeLabels[enquiry.enquiry_type]}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{enquiry.budget_range ? budgetRangeLabels[enquiry.budget_range] : "Not given"}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>
            <time dateTime={enquiry.created_at}>{formatLocalDateTime(enquiry.created_at)}</time>
          </dd>
        </div>
      </dl>
      <section aria-labelledby="message-heading" className={kit.panel}>
        <h2 id="message-heading" className={kit.legend}>
          Message
        </h2>
        <p className={styles.message}>{enquiry.message}</p>
      </section>
      <StatusControl enquiry={enquiry} />
      <div>
        <button type="button" className={`${kit.smallButton} ${kit.dangerButton}`} onClick={() => setConfirmDelete(true)}>
          Delete enquiry
        </button>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this enquiry?"
          message={`The enquiry from ${enquiry.name} will be deleted permanently.`}
          confirmLabel="Delete enquiry"
          busy={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </AdminPage>
  );
}
