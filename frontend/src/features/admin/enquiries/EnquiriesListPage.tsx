/**
 * Enquiries list `/admin/enquiries` (UI-057, REQ-066, REQ-NFR-005, TS-014). Status filter as segmented links
 * All / New / Replied / Archived synced to `?status=` (and `?page=`); table newest first (stacked cards below
 * 810 px): received date, name, email, company, enquiry type, status chip; each row links to the detail; pagination
 * ("Page 2 of 3"); total count. Enquiry fields are rendered as text only (SEC-UI-008).
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { StatusChip } from "@/shared/ui/Chip/Chip";
import { enquiryStatusLabels, enquiryTypeLabels } from "@/shared/utils/labels";
import { ENQUIRY_PAGE_SIZE, enquiryApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { EnquiryStatus } from "../api/types";
import { formatLocalDateTime } from "../dashboard/DashboardPage";
import { AdminPage, EmptyState, ErrorState, LoadingState } from "../ui/states";
import kit from "../ui/Kit.module.css";

const STATUSES: EnquiryStatus[] = ["new", "replied", "archived"];

export function parseStatus(value: string | null): EnquiryStatus | null {
  return value !== null && (STATUSES as string[]).includes(value) ? (value as EnquiryStatus) : null;
}

export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export const statusTone = { new: "warning", replied: "success", archived: "neutral" } as const;

function filterHref(status: EnquiryStatus | null, page = 1): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/enquiries?${query}` : "/admin/enquiries";
}

export function EnquiriesListPage() {
  const [params] = useSearchParams();
  const status = parseStatus(params.get("status"));
  const page = parsePage(params.get("page"));
  const query = useQuery({
    queryKey: adminKeys.enquiryList(status, page),
    queryFn: () => enquiryApi.listAdminEnquiries(status, page),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / (data.page_size || ENQUIRY_PAGE_SIZE))) : 1;
  const filters: Array<{ value: EnquiryStatus | null; label: string }> = [
    { value: null, label: "All" },
    ...STATUSES.map((s) => ({ value: s, label: enquiryStatusLabels[s] })),
  ];

  return (
    <AdminPage title="Enquiries">
      <nav aria-label="Filter enquiries by status">
        <ul className={kit.segmented}>
          {filters.map((f) => (
            <li key={f.label}>
              <Link to={filterHref(f.value)} className={kit.segment} aria-current={f.value === status ? "page" : undefined}>
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {query.isPending && <LoadingState />}
      {query.isError && !data && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {data && data.total === 0 && status === null && <EmptyState title="No enquiries yet" body="Messages sent through the Contact page appear here." />}
      {data && data.total === 0 && status !== null && (
        <EmptyState
          title={`No ${enquiryStatusLabels[status].toLowerCase()} enquiries`}
          action={
            <Link to="/admin/enquiries" className={kit.link}>
              Show all
            </Link>
          }
        />
      )}
      {data && data.total > 0 && (
        <>
          <p className={kit.muted} role="status">
            {data.total} {data.total === 1 ? "enquiry" : "enquiries"}
            {status ? ` (${enquiryStatusLabels[status].toLowerCase()})` : ""}
          </p>
          <div className={kit.tableWrap}>
            <table className={kit.table}>
              <caption className="visually-hidden">Enquiries, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Received</th>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Company</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Received">
                      <time dateTime={item.created_at}>{formatLocalDateTime(item.created_at)}</time>
                    </td>
                    <td data-label="Name">
                      <Link to={`/admin/enquiries/${item.id}`} className={kit.link}>
                        {item.name}
                      </Link>
                    </td>
                    <td data-label="Email">{item.email}</td>
                    <td data-label="Company">{item.company ?? "—"}</td>
                    <td data-label="Type">{enquiryTypeLabels[item.enquiry_type]}</td>
                    <td data-label="Status">
                      <StatusChip tone={statusTone[item.status]}>{enquiryStatusLabels[item.status]}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Pagination" className={kit.pagination}>
              {page > 1 ? (
                <Link to={filterHref(status, page - 1)} className={kit.smallButton}>
                  Previous page
                </Link>
              ) : (
                <span />
              )}
              <p>
                Page {page} of {pages}
              </p>
              {page < pages && (
                <Link to={filterHref(status, page + 1)} className={kit.smallButton}>
                  Next page
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </AdminPage>
  );
}
