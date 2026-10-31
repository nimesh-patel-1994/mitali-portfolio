/**
 * Route tree (UI-103, TS-026): one definition shared by the server entry (static handler) and the browser router.
 * Loaders read only from the content source; each route has an error element; route ids are explicit and equal to
 * frontend/'s so hydration data and the parity check line up.
 * PH-2 routes: layout, `/`, `/work/:slug`, `*`. The remaining public pages (/work, /writing, /about, /contact,
 * /faqs) and the admin arrive in PH-3; until then they show the not-found page (TS-023 step 5).
 * Development only: `/__review/type` (P1 type specimen). `import.meta.env.DEV` is false in builds, so the route and
 * its lazy module are removed from the bundle (proved by scripts/check-dist.ts).
 */
import type { RouteObject, ShouldRevalidateFunction } from "react-router";
import { pages, pageTitle } from "@/features/public/content/copy";
import { CaseStudyPage } from "@/features/public/case-study/CaseStudyPage";
import { HomePage } from "@/features/public/home/HomePage";
import { RootErrorBoundary, RouteErrorPage } from "@/features/public/layout/RouteError";
import { NotFoundPage } from "@/features/public/not-found/NotFoundPage";
import { defineMeta, notFoundMeta } from "@/features/public/seo/meta";
import { isValidSlug, throwNotFound, type ContentSource } from "./content-source";
import type { CaseStudyDetail } from "./content-types";
import { RootLayout, ROOT_ROUTE_ID } from "./RootLayout";

export const ROUTE_IDS = {
  root: ROOT_ROUTE_ID,
  home: "home",
  caseStudy: "case-study",
  notFound: "not-found",
} as const;

/** The not-found and error pages start on a deep surface: the header is solid from the start. */
const SOLID_HEADER = { solidHeader: true } as const;

/** Site data never changes during a visit (it changes only with a rebuild). */
const neverRevalidate: ShouldRevalidateFunction = () => false;

function slugParam(value: string | undefined): string {
  if (!isValidSlug(value)) throwNotFound();
  return value;
}

/** Development-only reviewer routes (the branch is dead in builds). */
function devRoutes(): RouteObject[] {
  if (!import.meta.env.DEV) return [];
  return [
    {
      id: "review-type",
      path: "__review/type",
      lazy: async () => ({ Component: (await import("@/dev/TypeSpecimen")).TypeSpecimen }),
    },
  ];
}

export function createRoutes(source: ContentSource): RouteObject[] {
  const errorElement = <RouteErrorPage />;
  return [
    {
      id: ROUTE_IDS.root,
      path: "/",
      element: <RootLayout />,
      errorElement: <RootErrorBoundary />,
      loader: () => source.get("site"),
      shouldRevalidate: neverRevalidate,
      children: [
        {
          id: ROUTE_IDS.home,
          index: true,
          element: <HomePage />,
          errorElement,
          loader: () => source.get("home"),
          handle: defineMeta(() => pages.home),
        },
        {
          id: ROUTE_IDS.caseStudy,
          path: "work/:slug",
          element: <CaseStudyPage />,
          errorElement,
          loader: ({ params }) => source.get(`work/${slugParam(params.slug)}`),
          handle: defineMeta<CaseStudyDetail>((data) => ({
            title: pageTitle(data.title),
            description: data.summary,
            image: data.cover,
            type: "article",
          })),
        },
        ...devRoutes(),
        {
          id: ROUTE_IDS.notFound,
          path: "*",
          element: <NotFoundPage />,
          errorElement,
          handle: { ...defineMeta(() => ({ ...notFoundMeta })), ...SOLID_HEADER },
        },
      ],
    },
  ];
}
