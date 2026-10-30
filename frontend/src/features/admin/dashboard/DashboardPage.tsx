/**
 * Admin dashboard (UI-038, REQ-052, REQ-066, TS-015).
 * - Rebuild panel: `needs_rebuild` → warning with the command and "Copy command" (Clipboard API; on failure the
 *   command text is selected and "Press Ctrl+C to copy" is shown); `last_build = null` → never built + command;
 *   otherwise "Public site is up to date — last built <built_at>".
 * - "New enquiries: N" card linking to `/admin/enquiries?status=new`; content counts table with links.
 * - Times in the local time zone via `Intl`. Refetches on window focus (shared query with the sidebar badge).
 */
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/shared/ui/Button/Button";
import { useDashboard } from "../layout/AdminLayout";
import { AdminPage, ErrorState } from "../ui/states";
import kit from "../ui/Kit.module.css";
import styles from "./DashboardPage.module.css";

const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function formatLocalDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

export const CONTENT_TYPES = [
  { key: "case_studies", label: "Case studies", to: "/admin/case-studies" },
  { key: "writing_samples", label: "Writing samples", to: "/admin/writing" },
  { key: "services", label: "Services", to: "/admin/services" },
  { key: "engagement_models", label: "Engagement models", to: "/admin/engagement-models" },
  { key: "testimonials", label: "Testimonials", to: "/admin/testimonials" },
  { key: "faq_categories", label: "FAQ categories", to: "/admin/faqs" },
  { key: "faqs", label: "FAQs", to: "/admin/faqs" },
  { key: "values", label: "Values", to: "/admin/values" },
  { key: "process_steps", label: "Process steps", to: "/admin/process-steps" },
] as const;

type CopyState = "idle" | "copied" | "manual";

function RebuildCommand({ command }: { command: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const codeRef = useRef<HTMLElement>(null);

  const selectCommand = () => {
    const node = codeRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      selectCommand();
      setState("manual");
    }
  };

  return (
    <div className={styles.command}>
      <pre className={styles.pre}>
        <code ref={codeRef}>{command}</code>
      </pre>
      <div className={kit.actions}>
        <Button variant="ghost" onClick={() => void copy()}>
          Copy command
        </Button>
        <p role="status" className={kit.muted}>
          {state === "copied" && "Command copied."}
          {state === "manual" && "Press Ctrl+C to copy."}
        </p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className={styles.grid} aria-busy="true">
      <p role="status" className="visually-hidden">
        Loading the dashboard…
      </p>
      <span className={kit.skeleton} />
      <span className={kit.skeleton} />
      <span className={kit.skeleton} />
    </div>
  );
}

export function DashboardPage() {
  const query = useDashboard();
  const data = query.data;

  return (
    <AdminPage title="Dashboard">
      {query.isPending && <Skeleton />}
      {query.isError && !data && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {data && (
        <div className={styles.grid}>
          <section className={kit.panel} aria-labelledby="rebuild-heading" data-tone={data.needs_rebuild ? "warning" : "success"}>
            <h2 id="rebuild-heading" className={kit.sectionTitle}>
              Public site
            </h2>
            {data.last_build === null ? (
              <>
                <p className={styles.warning}>The site has not been built yet.</p>
                <p>Run this command in a terminal at the project folder to build it:</p>
                <RebuildCommand command={data.rebuild_command} />
              </>
            ) : data.needs_rebuild ? (
              <>
                <p className={styles.warning}>
                  Site needs rebuilding. Content changed on{" "}
                  <time dateTime={data.content_changed_at}>{formatLocalDateTime(data.content_changed_at)}</time>.
                </p>
                <p>Run this command in a terminal at the project folder to publish your changes:</p>
                <RebuildCommand command={data.rebuild_command} />
              </>
            ) : (
              <p className={styles.success}>
                Public site is up to date — last built{" "}
                <time dateTime={data.last_build.built_at}>{formatLocalDateTime(data.last_build.built_at)}</time>.
              </p>
            )}
          </section>

          <section className={kit.panel} aria-labelledby="enquiries-heading">
            <h2 id="enquiries-heading" className={kit.sectionTitle}>
              Enquiries
            </h2>
            <p className={styles.count}>New enquiries: {data.new_enquiries}</p>
            <Link to="/admin/enquiries?status=new" className={kit.link}>
              View new enquiries
            </Link>
          </section>

          <section className={kit.panel} aria-labelledby="content-heading">
            <h2 id="content-heading" className={kit.sectionTitle}>
              Content
            </h2>
            <table className={kit.table}>
              <caption className="visually-hidden">Published and total items per content type</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Published</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {CONTENT_TYPES.map((type) => {
                  const count = data.content_counts[type.key];
                  return (
                    <tr key={type.key}>
                      <th scope="row">
                        <Link to={type.to} className={kit.link}>
                          {type.label}
                        </Link>
                      </th>
                      <td data-label="Published">{count?.published ?? 0}</td>
                      <td data-label="Total">{count?.total ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </AdminPage>
  );
}
