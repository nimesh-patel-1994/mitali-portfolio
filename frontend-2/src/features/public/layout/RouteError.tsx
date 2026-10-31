/**
 * Route error elements (UI-115; behaviour of frontend/ UI-034).
 * - `RouteErrorPage` (every child route): loader 404 → not-found page, anything else → friendly error page; rendered
 *   inside the normal header/footer because the layout route stays mounted.
 * - `RootErrorBoundary` (layout route): the site data itself failed; renders the same frame without site data.
 */
import { isRouteErrorResponse, useRouteError } from "react-router";
import { PublicFrame } from "@/app/RootLayout";
import { ErrorContent, NotFoundPage } from "@/features/public/not-found/NotFoundPage";

export function isNotFoundError(error: unknown): boolean {
  return isRouteErrorResponse(error) && error.status === 404;
}

export function RouteErrorPage() {
  const error = useRouteError();
  return isNotFoundError(error) ? <NotFoundPage /> : <ErrorContent />;
}

export function RootErrorBoundary() {
  const error = useRouteError();
  const notFound = isNotFoundError(error);
  return (
    <PublicFrame site={undefined} status={notFound ? 404 : 500}>
      {notFound ? <NotFoundPage /> : <ErrorContent />}
    </PublicFrame>
  );
}
