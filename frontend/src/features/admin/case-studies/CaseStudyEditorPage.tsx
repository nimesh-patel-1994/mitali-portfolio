/**
 * Case-study editor `/admin/case-studies/new` and `/:id` (UI-044..UI-046). Tabs Details / Results / Gallery
 * (`role="tablist"`); Results and Gallery are disabled with a hint until the case study exists.
 * All three tab panels stay mounted (inactive ones are `hidden`), so unsaved Details edits survive a tab switch and
 * every tab's `aria-controls` points at an existing panel. One leave-page guard covers the forms in all tabs.
 * States: loading, not found (404), error + Retry, plus the form states in the tabs.
 */
import { useQuery } from "@tanstack/react-query";
import { useId, useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router";
import { caseStudyApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import { AdminPage, ErrorState, isNotFound, LoadingState, NotFoundState } from "../ui/states";
import { UnsavedChangesProvider, useUnsavedChangesScope } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";
import { CaseStudyDetailsForm } from "./CaseStudyDetailsForm";
import { GalleryEditor } from "./GalleryEditor";
import { ResultsEditor } from "./ResultsEditor";
import styles from "./CaseStudies.module.css";

type Tab = "details" | "results" | "gallery";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "results", label: "Results" },
  { id: "gallery", label: "Gallery" },
];

export const TABS_DISABLED_HINT = "Save the case study first to add results and gallery images.";

export function CaseStudyEditorPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const [tab, setTab] = useState<Tab>("details");
  const base = useId();
  const unsaved = useUnsavedChangesScope();
  const query = useQuery({
    queryKey: adminKeys.caseStudy(id ?? "new"),
    queryFn: () => caseStudyApi.getAdminCaseStudy(id!),
    enabled: !isNew,
  });

  const back = (
    <Link to="/admin/case-studies" className={kit.link}>
      Back to case studies
    </Link>
  );

  if (!isNew && query.isPending) {
    return (
      <AdminPage title="Edit case study" actions={back}>
        <LoadingState />
      </AdminPage>
    );
  }
  if (!isNew && query.isError) {
    return (
      <AdminPage title="Edit case study" actions={back}>
        {isNotFound(query.error) ? (
          <NotFoundState backTo="/admin/case-studies" backLabel="Back to case studies" />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </AdminPage>
    );
  }

  const caseStudy = isNew ? undefined : query.data;
  const enabled = (t: Tab) => t === "details" || caseStudy !== undefined;
  const select = (t: Tab) => {
    if (enabled(t)) setTab(t);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const available = TABS.filter((t) => enabled(t.id));
    const index = available.findIndex((t) => t.id === tab);
    const next = available[(index + (event.key === "ArrowRight" ? 1 : available.length - 1)) % available.length];
    if (next) {
      setTab(next.id);
      document.getElementById(`${base}-${next.id}-tab`)?.focus();
    }
  };

  return (
    <AdminPage title={isNew ? "New case study" : "Edit case study"} heading={caseStudy?.title ?? "New case study"} actions={back}>
      <div role="tablist" aria-label="Case study sections" className={kit.tablist}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${base}-${t.id}-tab`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${base}-${t.id}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            disabled={!enabled(t.id)}
            aria-describedby={!enabled(t.id) ? `${base}-hint` : undefined}
            className={kit.tab}
            onClick={() => select(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isNew && (
        <p id={`${base}-hint`} className={kit.hint}>
          {TABS_DISABLED_HINT}
        </p>
      )}
      <UnsavedChangesProvider value={unsaved.context}>
        {TABS.map((t) => (
          <div
            key={t.id}
            id={`${base}-${t.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${base}-${t.id}-tab`}
            hidden={tab !== t.id}
            className={styles.tabPanel}
          >
            {t.id === "details" && <CaseStudyDetailsForm key={caseStudy?.id ?? "new"} caseStudy={caseStudy} />}
            {t.id === "results" && caseStudy && <ResultsEditor caseStudy={caseStudy} />}
            {t.id === "gallery" && caseStudy && <GalleryEditor caseStudy={caseStudy} />}
          </div>
        ))}
      </UnsavedChangesProvider>
      {unsaved.element}
    </AdminPage>
  );
}
