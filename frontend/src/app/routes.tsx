/**
 * Route tree (UI-002, TS-006): one definition shared by the pre-renderer (static handler) and the browser router.
 * Loaders read only from the content source (TS-005); each route has an error element; admin routes are attached
 * with `lazy` so the admin chunk is never part of the public bundle (UI-REV-015).
 * Route ids are explicit so server hydration data and client routes always line up.
 */
import type { RouteObject, ShouldRevalidateFunction } from "react-router";
import { pages } from "@/features/public/content/copy";
import { RootLayout, ROOT_ROUTE_ID } from "@/features/public/layout/RootLayout";
import { RootErrorBoundary, RouteErrorPage } from "@/features/public/layout/RouteError";
import { NotFoundPage } from "@/features/public/not-found/NotFoundPage";
import { AboutPage } from "@/features/public/about/AboutPage";
import { CaseStudyPage } from "@/features/public/case-study/CaseStudyPage";
import { ContactPage } from "@/features/public/contact/ContactPage";
import { FaqsPage } from "@/features/public/faqs/FaqsPage";
import { HomePage } from "@/features/public/home/HomePage";
import { WorkPage } from "@/features/public/work/WorkPage";
import { WritingPage } from "@/features/public/writing/WritingPage";
import { WritingSamplePage } from "@/features/public/writing-sample/WritingSamplePage";
import { defineMeta, notFoundMeta } from "@/features/public/seo/meta";
import { pageTitle } from "@/features/public/content/copy";
import { isValidSlug, throwNotFound, type ContentSource } from "./content-source";
import type { CaseStudyDetail, WritingSampleDetail } from "./content-types";

export const ROUTE_IDS = {
  root: ROOT_ROUTE_ID,
  home: "home",
  work: "work",
  caseStudy: "case-study",
  writing: "writing",
  writingSample: "writing-sample",
  about: "about",
  contact: "contact",
  faqs: "faqs",
  notFound: "not-found",
  admin: "admin",
} as const;

/** Pages that open with a dark hero: the fixed header starts transparent over them (UI-019). */
const DARK_HERO = { darkHero: true } as const;

/** Site data never changes during a visit (it changes only with a rebuild). */
const neverRevalidate: ShouldRevalidateFunction = () => false;

/** The writing filter changes only the search string: no data refetch (UI-029). */
const revalidateOnPathChange: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) =>
  currentUrl.pathname !== nextUrl.pathname ? defaultShouldRevalidate : false;

function slugParam(value: string | undefined): string {
  if (!isValidSlug(value)) throwNotFound();
  return value;
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
          handle: { ...defineMeta(() => pages.home), ...DARK_HERO },
        },
        {
          id: ROUTE_IDS.work,
          path: "work",
          element: <WorkPage />,
          errorElement,
          loader: () => source.get("work"),
          handle: defineMeta(() => pages.work),
        },
        {
          id: ROUTE_IDS.caseStudy,
          path: "work/:slug",
          element: <CaseStudyPage />,
          errorElement,
          loader: ({ params }) => source.get(`work/${slugParam(params.slug)}`),
          handle: {
            ...defineMeta<CaseStudyDetail>((data) => ({
              title: pageTitle(data.title),
              description: data.summary,
              image: data.cover,
              type: "article",
            })),
            ...DARK_HERO,
          },
        },
        {
          id: ROUTE_IDS.writing,
          path: "writing",
          element: <WritingPage />,
          errorElement,
          loader: () => source.get("writing"),
          shouldRevalidate: revalidateOnPathChange,
          handle: defineMeta(() => pages.writing),
        },
        {
          id: ROUTE_IDS.writingSample,
          path: "writing/:slug",
          element: <WritingSamplePage />,
          errorElement,
          loader: ({ params }) => source.get(`writing/${slugParam(params.slug)}`),
          handle: {
            ...defineMeta<WritingSampleDetail>((data) => ({
              title: pageTitle(data.title),
              description: data.excerpt,
              image: data.thumbnail,
              type: "article",
            })),
            ...DARK_HERO,
          },
        },
        {
          id: ROUTE_IDS.about,
          path: "about",
          element: <AboutPage />,
          errorElement,
          loader: () => source.get("about"),
          handle: {
            ...defineMeta((_data, site) => ({ ...pages.about, image: site?.profile.portrait ?? null })),
            ...DARK_HERO,
          },
        },
        {
          id: ROUTE_IDS.contact,
          path: "contact",
          element: <ContactPage />,
          errorElement,
          loader: () => source.get("contact"),
          handle: { ...defineMeta(() => pages.contact), ...DARK_HERO },
        },
        {
          id: ROUTE_IDS.faqs,
          path: "faqs",
          element: <FaqsPage />,
          errorElement,
          loader: () => source.get("faqs"),
          handle: defineMeta(() => pages.faqs),
        },
        {
          id: ROUTE_IDS.notFound,
          path: "*",
          element: <NotFoundPage />,
          errorElement,
          handle: { ...defineMeta(() => ({ ...notFoundMeta })), ...DARK_HERO },
        },
      ],
    },
    {
      id: ROUTE_IDS.admin,
      path: "/admin/*",
      lazy: () => import("@/features/admin/routes"),
    },
  ];
}
