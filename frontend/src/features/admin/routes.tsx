/**
 * Admin app (UI-035..UI-058, TS-016). Loaded with `route.lazy` from the public route tree, so all admin code
 * (TanStack Query, React Hook Form, the Markdown editor, every screen) lives in its own chunk that public pages
 * never load (UI-REV-015, SEC-UI-011). The admin shell HTML is `noindex, nofollow` (pre-render).
 *
 * Routing: the lazy `/admin/*` route renders descendant routes. The session guard lives in `AdminLayout`
 * (`getAdminMe` query; 401 → login with `next`); route guards are UX only, the backend enforces access (TS-008).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Route, Routes, useRouteError } from "react-router";
import { createAdminQueryClient } from "./api/query";
import { LoginPage } from "./auth/LoginPage";
import { CaseStudiesListPage } from "./case-studies/CaseStudiesListPage";
import { CaseStudyEditorPage } from "./case-studies/CaseStudyEditorPage";
import { EngagementModelsPage, ProcessStepsPage, ServicesPage, TestimonialsPage, ValuesPage } from "./collections/screens";
import { DashboardPage } from "./dashboard/DashboardPage";
import { EnquiriesListPage } from "./enquiries/EnquiriesListPage";
import { EnquiryDetailPage } from "./enquiries/EnquiryDetailPage";
import { FaqsPage } from "./faqs/FaqsPage";
import { AdminLayout } from "./layout/AdminLayout";
import { ProfilePage } from "./profile/ProfilePage";
import { useSessionEndedRedirect } from "./session/useSession";
import { SettingsPage } from "./settings/SettingsPage";
import { ToastProvider } from "./ui/Toast";
import { AdminPage } from "./ui/states";
import { WritingEditorPage } from "./writing/WritingEditorPage";
import { WritingListPage } from "./writing/WritingListPage";
import kit from "./ui/Kit.module.css";

function SessionBridge() {
  useSessionEndedRedirect();
  return null;
}

function AdminNotFound() {
  return (
    <AdminPage title="Page not found">
      <p>This admin page does not exist.</p>
      <Link to="/admin" className={kit.link}>
        Back to the dashboard
      </Link>
    </AdminPage>
  );
}

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="case-studies" element={<CaseStudiesListPage />} />
        <Route path="case-studies/new" element={<CaseStudyEditorPage />} />
        <Route path="case-studies/:id" element={<CaseStudyEditorPage />} />
        <Route path="writing" element={<WritingListPage />} />
        <Route path="writing/new" element={<WritingEditorPage />} />
        <Route path="writing/:id" element={<WritingEditorPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="engagement-models" element={<EngagementModelsPage />} />
        <Route path="testimonials" element={<TestimonialsPage />} />
        <Route path="faqs" element={<FaqsPage />} />
        <Route path="values" element={<ValuesPage />} />
        <Route path="process-steps" element={<ProcessStepsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="enquiries" element={<EnquiriesListPage />} />
        <Route path="enquiries/:id" element={<EnquiryDetailPage />} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}

/** The admin app with its providers; tests pass a query client configured for speed (no retry delay). */
export function AdminApp({ queryClient: provided }: { queryClient?: QueryClient }) {
  const [queryClient] = useState(() => provided ?? createAdminQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionBridge />
        <AdminRoutes />
      </ToastProvider>
    </QueryClientProvider>
  );
}

/** Lazy route component: one query client per admin app instance. */
export function Component() {
  return <AdminApp />;
}

/** Route error boundary for the lazy admin route (ui-scope 4: `errorElement` on every route). */
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main id="main" data-surface="white" className={kit.page}>
      <h1 className={kit.pageTitle}>Something went wrong</h1>
      <p>The admin could not be shown. Reload the page to try again.</p>
      <p className={kit.muted}>{error instanceof Error ? error.name : "Unexpected error"}</p>
      <a href="/admin" className={kit.link}>
        Reload the admin
      </a>
    </main>
  );
}
