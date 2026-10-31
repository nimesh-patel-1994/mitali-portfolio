# UI Scope of Work — mitali-portfolio

> What the frontend builder must deliver. Stack comes from the `SystemDesign.md` header: `frontend: react`, one app at
> `frontend/` (React 19 + Vite + TypeScript strict, React Router data routers, TanStack Query for admin, React Hook Form +
> Zod; profile `stack-react`). The app has two parts, tagged per item:
> - `App: public` — pre-rendered at build time and hydrated in the browser (SD-003, TS-005, TS-006).
> - `App: admin` — client-rendered under `/admin`, lazy chunk, `noindex` (TS-016).
> - `App: shared` — tokens, build, components used by both.
>
> Owned by the `ui-scope` skill. Status tags: `ID [STATUS YYYY-MM-DD HH:MM]` (see `status-tracker`).
> Every item lists the `REQ`, `TS` and `DES` IDs it implements and the `api-contract.yaml` operationIds it uses.
> Public pages never call the content API at runtime: they read it at build time through the content source (TS-005)
> and, in the browser, from `/data/<key>.json`. The only runtime public call is `createEnquiry`.
> Layout observations come from `.dev-pipeline/reference/reference-notes.md` sections 2-5 (structure only). No reference
> text, images, logos, fonts or code are used; all copy is original (DES-003, DES-030).
> **Second app (CHG-012):** the design variant `frontend-2/` has its own section 7 ("App: frontend-2") with items UI-100.., the
> screen-parity matrix, review items UI-REV-026.. and tests UI-T-127... Sections 1-6 describe `frontend/` only.

## 1. Scope items

### 1.1 Foundation (App: shared)

- UI-001 [IMPLEMENTED 2026-10-30 18:36] Design tokens, fonts, global styles and section-surface aliases
  - App: shared
  - Implements: REQ-NFR-001, REQ-NFR-002, REQ-NFR-007, TS-001, TS-006, DES-010, DES-011, DES-012, DES-013, DES-020,
    DES-021, DES-040, DES-042
  - Uses API: none
  - Files: `src/styles/tokens.css`, `src/styles/media.css`, `src/styles/fonts.css`, `src/styles/global.css`,
    `src/shared/ui/Section/`, `public/fonts/*.woff2`
  - Behaviour:
    - `tokens.css` defines every token named in design-brief sections 2, 3, 5 and 6 exactly once on `:root`
      (`--color-*`, `--font-*`, `--text-*` with line height/weight/tracking companions, `--space-1…11`, `--section-pad`,
      `--radius-*`, `--container-*`, `--measure`, `--ease-out`, `--tape-rotate`). Derived component tokens traceable to
      DES-040 are allowed here only: `--header-h: 80px`, `--header-h-compact: 64px`, `--focus-width: 2px`,
      `--focus-offset: 2px`, `--hairline: 1px`, `--dur-fast: 150ms`, `--dur-base: 200ms`, `--dur-fade: 250ms`,
      `--dur-reveal: 300ms`, `--glow-loop: 20s`.
    - Surface aliases: `Section` (`surface="deepest" | "dark" | "cream" | "white"`) renders `<section data-surface>`;
      `global.css` maps each surface to `--surface`, `--on-surface`, `--on-surface-muted`, `--accent-on-surface`,
      `--border`, `--focus-color`, `--danger-on-surface`, `--warning-on-surface`. Dark: accent `--color-primary`, muted
      `--color-text-muted-on-dark`, focus `--color-primary`. Cream/white: accent `--color-primary-text-on-light`, muted
      `--color-text-muted`, focus `--color-dark` (DES-013: green is never text or icon on cream/white).
    - Breakpoints as custom media in `media.css`: `--bp-tablet (min-width: 810px)`, `--bp-desktop (min-width: 1200px)`
      (mobile is the default, < 810 px). Mobile-first CSS; layouts verified from 360 px.
    - Fonts: Antonio 500/700 and Public Sans 400/600/700 WOFF2 self-hosted from the official releases, `@font-face` with
      `font-display: swap`; the two above-the-fold files (Antonio 700, Public Sans 400) preloaded in the HTML template.
      OFL licence files committed next to the fonts.
    - Global: `box-sizing`, body uses `--font-body` / `--text-body` on `--color-bg-deepest`, `:focus-visible` outline
      `var(--focus-width) solid var(--focus-color)` with offset, `scroll-padding-top: var(--header-h)` (focus and anchor
      targets never hidden under the fixed header), `.visually-hidden` utility, container classes (`--container-max`,
      `--container-wide`, gutters `--space-5` mobile / `--space-7` tablet), body copy capped at `--measure`.
  - States: n/a (static styles).
  - Done when: every design-brief token exists in `tokens.css`; no component stylesheet contains a literal colour, font
    family, or spacing value (UI-REV-001 check passes); the style check script (UI-T-002) passes; fonts load from
    `/fonts/` with no external request.

- UI-002 [IMPLEMENTED 2026-10-30 18:36] Public route tree, root layout, hydration and content source
  - App: public
  - Implements: REQ-001, REQ-022, REQ-NFR-004, TS-005, TS-006, DES-040
  - Uses API (build time / `npm run dev` only, via the *api* content source): `getPublicSite`,
    `listPublicCaseStudies`, `getPublicCaseStudy`, `listPublicWritingSamples`, `getPublicWritingSample`,
    `listPublicServices`, `listPublicEngagementModels`, `listPublicTestimonials`, `listPublicFaqGroups`,
    `listPublicFaqPreview`, `listPublicValues`, `listPublicProcessSteps`. Browser (production): `/data/<key>.json` only.
  - Files: `src/app/routes.tsx`, `src/app/content-source.ts` (+ `api`/`static` implementations), `src/entry-client.tsx`,
    `src/entry-server.tsx`, `src/features/public/layout/RootLayout.tsx`, `src/shared/hooks/useHydrated.ts`
  - Behaviour:
    - One route tree (TS-006 table) shared by server and client; root layout loader reads key `site`; each page loader
      reads its key; admin routes attached with `route.lazy` so the admin chunk is never in the public bundle.
    - `entry-client.tsx`: `__ROUTER_DATA__` present → `createBrowserRouter(routes, { hydrationData })` + `hydrateRoot`;
      absent → `createRoot` (admin shell, dev).
    - Root layout: skip link "Skip to content" (first focusable element) → `<main id="main" tabIndex={-1}>`, `Header`,
      `<Outlet/>`, `Footer`. On client navigation focus moves to `<main>` and the document title updates.
    - Loader 404 (`throw new Response(null, { status: 404 })`) renders `NotFoundPage` (UI-034); other errors render the
      route error page (friendly message, "Try again" reload link, link Home), inside the normal header/footer.
    - Navigation pending state (`useNavigation().state === "loading"`): thin top progress bar in `--color-primary`
      under `aria-busy="true"` on `<main>`; appears after 150 ms to avoid flicker.
    - Rendering is deterministic: no `Date.now()`, `Math.random()`, `window`/`matchMedia` reads during render; dates are
      formatted with `Intl.DateTimeFormat("en", { timeZone: "UTC" })`.
  - States: loading (navigation bar), error (route error page), not found (UI-034), success.
  - Done when: server render and hydration produce no mismatch warnings for every public route (UI-T-007); public build
    contains no admin modules (UI-REV-015).

- UI-003 [IMPLEMENTED 2026-10-30 18:36] Motion system and reduced motion
  - App: public (admin uses only the 150-200 ms state transitions)
  - Implements: REQ-NFR-003, REQ-010, TS-006, DES-040
  - Uses API: none
  - Files: `src/shared/ui/Reveal/`, `src/styles/motion.css`, `src/features/public/home/HeroGlow.module.css`
  - Behaviour:
    - All `animation` and `transition` declarations live inside `@media (prefers-reduced-motion: no-preference)`.
    - Hero glow: blurred radial gradient pseudo-element, slow drift over `--glow-loop`, `aria-hidden`, GPU-friendly
      (`transform`/`opacity` only). Reduced motion → static glow.
    - `Reveal` wrapper: content fades/translates up 16 px (`--space-4`) over `--dur-reveal` with `--ease-out` once, when it
      enters the viewport (one shared `IntersectionObserver`). The hidden start state is applied only after hydration
      and only when motion is allowed, so pre-rendered and no-JS content is always visible.
    - Accordion height 200 ms with plus → cross icon rotation; carousel cross-fade 250 ms; button hover colour inversion
      150 ms; card image scale 1.03 + title underline on hover. Under reduced motion the state changes instantly
      (underline remains, no scale).
    - No page transitions, no parallax, nothing that flashes more than three times per second.
  - States: motion allowed, reduced motion.
  - Done when: UI-T-014, UI-T-015 and E2E UI-T-112 pass.

- UI-004 [IMPLEMENTED 2026-10-30 18:36] SEO head tags and pre-render integration
  - App: public (+ admin shell)
  - Implements: REQ-001, REQ-022, REQ-050, REQ-051, REQ-052, REQ-NFR-004, TS-005, DES-001
  - Uses API (build time): `getPublicSite` (first, for `generated_at` = content snapshot), `listPublicCaseStudies`,
    `listPublicWritingSamples`, then page data through the content source.
  - Files: `scripts/prerender.ts`, `src/entry-server.tsx`, `src/features/public/seo/` (`buildHead()`, `Meta` types),
    `src/features/public/content/copy.ts` (static page titles/descriptions), `index.html` template placeholders
  - Behaviour (per TS-005 steps 1-10):
    - Each route's `handle.meta(loaderData, site)` returns title, description, canonical path, OG image, OG type;
      `buildHead()` renders `<title>` (`<Page> — Mitali` pattern; Home uses the DES-001 site title), meta description,
      `<link rel="canonical">` (`VITE_SITE_URL` + path, no trailing slash), `og:title`, `og:description`, `og:image`
      (absolute URL of cover / thumbnail / portrait, else default), `og:type` (`article` for details, else `website`),
      `og:url`, `twitter:card` (`summary_large_image`). Values are escaped.
    - Pre-render writes `dist/<route>/index.html`, `dist/data/<key>.json`, `404.html` (`noindex`), `admin/index.html`
      (`<meta name="robots" content="noindex, nofollow">`, empty root), `sitemap.xml` (6 static + published details,
      nothing under `/admin`), `robots.txt` (`Disallow: /admin`, `Sitemap:` line), then `build-info.json` last.
    - Hydration data serialized as `<script type="application/json" id="__ROUTER_DATA__">` with `<`, `>`, `&`,
      U+2028/U+2029 escaped (no inline executable script; CSP-safe).
    - Failure of any route (other than the intentional 404) → non-zero exit, no `build-info.json`, clear console message
      naming the route.
    - `<html lang="en">` on every page.
  - States: build success, build failure.
  - Done when: UI-T-004, UI-T-006, UI-T-008, UI-T-009, UI-T-010 and E2E UI-T-105, UI-T-121 pass.

### 1.2 Shared public components (App: public unless stated)

- UI-005 [IMPLEMENTED 2026-10-30 18:36] `Wordmark`
  - App: shared (header, footer, admin sidebar, login)
  - Implements: REQ-005, REQ-002, REQ-004, TS-006, DES-002, DES-020
  - Uses API: none
  - Behaviour: renders the text "MITALI" in `--font-display` 700 uppercase; colour from `--accent-on-surface` on dark
    (green) and `--color-dark` on cream (DES-002); sizes `header` (≥ 24 px tall, clear space = cap height), `footer`
    (`--text-footer-mark`), `admin`. As a link it has the accessible name "Mitali, home". When a logo is later supplied it
    is imported from `assets/brand/` inside this component only (never edited); no page layout changes.
  - States: n/a.
  - Done when: UI-T-016 passes; no other component renders brand text or a logo.

- UI-006 [IMPLEMENTED 2026-10-30 18:36] `Button`, `ButtonLink` and `BookCallLink`
  - App: shared
  - Implements: REQ-002, REQ-010, REQ-013, TS-006, DES-013, DES-020, DES-021, DES-040
  - Uses API: none (`settings.booking_url` from site data)
  - Behaviour: variants `primary` (green fill, `--color-on-primary` text), `secondary` (cream fill, dark text), `ghost`
    (transparent, 1 px `--border`); height `--space-7` (48 px), `--text-label`, `--radius-0`; hover colour inversion
    (green ↔ cream). `Button` supports `loading` (disabled, `aria-busy`, label kept for screen readers) and `disabled`.
    `ButtonLink` renders `<a>`; external URLs get `target="_blank" rel="noopener noreferrer"` and a visually hidden
    "(opens in a new tab)". `BookCallLink`: if `booking_url` is a valid absolute `http(s)` URL → external link; null, empty,
    `#` or anything else (including `javascript:`) → internal link to `/contact`. Label "Book a call" from `copy.ts`.
  - States: default, hover, focus-visible, active, disabled, loading.
  - Done when: UI-T-017, UI-T-018 pass.

- UI-007 [IMPLEMENTED 2026-10-30 18:36] `SectionHeading` with tape
  - Implements: REQ-001, TS-006, DES-020, DES-021, DES-040
  - Uses API: none
  - Behaviour: props `level` (h1-h3), `size` (`h1`, `h2`), optional `eyebrow` label and `action` slot (e.g. "View all work"
    link top-right; stacks under the heading on mobile). Decorative tape block (`--color-primary`, about 0.9em × 1.6em,
    `--tape-rotate`) drawn as a `::before` behind the first letters, `aria-hidden` by construction; text colour from
    `--on-surface` (dark text over the tape on cream; on dark the heading uses `--accent-on-surface`).
  - States: n/a.
  - Done when: UI-T-019 passes; heading levels follow page outline (one `h1` per page).

- UI-008 [IMPLEMENTED 2026-10-30 18:36] `TapeDivider` (seam tapes)
  - Implements: TS-006, DES-040
  - Uses API: none
  - Behaviour: larger rotated green blocks overlapping the seam between a dark and a cream section, `side="left|right"`
    alternating per page, `aria-hidden="true"`, `pointer-events: none`, never overlapping text or controls; clipped by
    the page so no horizontal scroll at 360 px; smaller on mobile.
  - States: n/a.
  - Done when: UI-T-020 passes; no horizontal scroll at 360 px (UI-T-103).

- UI-009 [IMPLEMENTED 2026-10-30 18:36] `Chip` and `FilterChip`
  - App: shared (admin uses `StatusChip` variant)
  - Implements: REQ-020, REQ-030, REQ-066, TS-006, TS-016, DES-013, DES-040
  - Uses API: none
  - Behaviour: `Chip` = outlined label (`--radius-1`, `--text-label`, `--border`, `--on-surface` text). `FilterChip` =
    link chip for the writing filter: active one has `aria-current="true"`, `--color-primary` fill with
    `--color-on-primary` text on dark, or dark fill with cream text on cream. `StatusChip` (admin): published/draft,
    sample, featured, enquiry status, each with text (never colour alone), using `--color-success`, `--color-warning`,
    neutral tokens.
  - States: default, hover, focus-visible, active/current.
  - Done when: UI-T-021 passes.

- UI-010 [IMPLEMENTED 2026-10-30 18:36] `CaseStudyCard`, `WritingSampleCard` and `CardGrid`
  - Implements: REQ-011, REQ-020, REQ-021, REQ-023, REQ-030, TS-006, DES-040
  - Uses API: data shapes `CaseStudySummary`, `WritingSampleSummary`
  - Behaviour: 16:9 `ResponsiveImage` (`--radius-1`), uppercase `h3` title left, outlined chip right (campaign type /
    format label), 3-4 line summary/excerpt in `--on-surface-muted` (line clamp). The whole card is one link (title link
    with stretched hit area, no nested interactive elements) to `/work/<slug>` or `/writing/<slug>`. Writing cards show a
    "Sample" chip when `is_sample`. `CardGrid`: 1 column mobile, 2 columns tablet/desktop, gutter `--space-5`/`--space-6`.
    Hover per UI-003.
  - States: with image, image missing (token-coloured fallback block, UI-013).
  - Done when: UI-T-022 passes.

- UI-011 [IMPLEMENTED 2026-10-31 00:12] `Accordion`
  - App: public (services, FAQ preview, FAQs page)
  - Implements: REQ-006, REQ-012, REQ-041, REQ-NFR-002, REQ-NFR-003, TS-006, DES-040
  - Uses API: none
  - Behaviour: each item is a heading (`h3` by default, configurable) wrapping a `<button aria-expanded aria-controls>`
    with the question/name and a plus icon (`aria-hidden`) that rotates to a cross; the panel is a `role="region"`
    `aria-labelledby` the button. All items start collapsed; panels carry `hidden` in the pre-rendered HTML (content
    present for indexing). Items open independently (multiple may be open). Enter/Space toggle (native button). IDs from
    `useId` so server and client match. Hairline dividers in `--border`. Optional two-column layout (desktop/tablet ≥ 810
    px) that keeps DOM order column-by-column for reading order.
  - States: collapsed, expanded, focus-visible.
  - Done when: UI-T-023, UI-T-024 pass; keyboard-only E2E UI-T-109 passes.

- UI-012 [IMPLEMENTED 2026-10-30 18:36] `Carousel` (testimonials)
  - Implements: REQ-015, REQ-NFR-002, REQ-NFR-003, TS-006, DES-021, DES-040
  - Uses API: data shape from `listPublicTestimonials`
  - Behaviour: `<section aria-roledescription="carousel" aria-label="Client testimonials">`; slides are
    `role="group" aria-roledescription="slide" aria-label="2 of 5"`; all quotes are in the pre-rendered HTML, inactive ones
    `hidden`. Square prev/next buttons (44 × 44 min, `aria-label` "Previous testimonial"/"Next testimonial") at the edges
    on desktop, below the quote on mobile; indicator buttons ("Show testimonial 3 of 5", `aria-current="true"` on the
    active one). Wraps around both ways. No autoplay ever. A polite live region announces the new quote and author after a
    user action (not on first render). Swipe left/right with pointer events (threshold 40 px; vertical scroll not
    blocked). Cross-fade 250 ms (UI-003). Quote in `--text-statement`, author in display caps, role/company muted.
    One testimonial → no controls; zero → the section is not rendered.
  - States: empty (hidden), single, multiple, focus-visible.
  - Done when: UI-T-025 to UI-T-028 pass.

- UI-013 [IMPLEMENTED 2026-10-30 18:36] `ResponsiveImage`
  - App: shared
  - Implements: REQ-NFR-004, REQ-014, REQ-020, REQ-021, TS-006, DES-040
  - Uses API: `ImageRef` (`url`, `alt`, `width`, `height`, `mime`, `srcset[]`)
  - Behaviour: renders `<img src srcset sizes width height alt>`; `sizes` passed by the caller per layout (e.g. card
    `(min-width: 810px) 50vw, 100vw`); `loading="lazy" decoding="async"` by default; `priority` → `loading="eager"`
    `fetchpriority="high"` (used for the LCP image: case-study cover, Home hero has no image). SVG refs render with empty
    `srcset`. `alt=""` only when the caller marks the image decorative. Missing ref or load error → token-coloured block
    with the same aspect ratio (no broken-image icon, no layout shift). Aspect ratio from `width`/`height` attributes
    (no inline styles, CSP).
  - States: loading (reserved box), loaded, missing/error fallback.
  - Done when: UI-T-029 passes.

- UI-014 [IMPLEMENTED 2026-10-30 18:36] `SanitizedHtml`
  - App: shared (public detail pages, admin Markdown preview)
  - Implements: REQ-031, REQ-021, TS-006, TS-012, DES-021
  - Uses API: `body_html`, `problem_html`, `solution_html` from public data; `previewAdminMarkdown` response in admin
  - Behaviour: the single reviewed use of `dangerouslySetInnerHTML` in the codebase. Accepts only a branded type
    `SanitizedHtmlString` produced by the typed API response mappers (never from user input or string concatenation).
    Wraps output in a `.prose` container styled with tokens: `h2`-`h4` display font, lists, blockquote, code, tables
    scrollable inside their own container, links underlined (`--accent-on-surface` on dark, `--color-dark` on cream).
  - States: n/a.
  - Done when: UI-T-030 passes; a lint/grep check finds `dangerouslySetInnerHTML` in this file only.

- UI-015 [IMPLEMENTED 2026-10-30 18:36] `SampleDataNote`
  - Implements: REQ-023, REQ-067, TS-006, DES-013
  - Uses API: `is_sample` flags on case study, results, writing sample
  - Behaviour: small inline note with an info icon (`aria-hidden`) and text "Sample data" (results row) or "Sample case
    study" / "Sample" (details block, writing detail) in `--text-small`, colour `--warning-on-surface` (#8C5A00 on cream,
    #FFB74D on dark). Rendered only when the flag is true.
  - States: shown, hidden.
  - Done when: UI-T-031 passes.

- UI-016 [IMPLEMENTED 2026-10-30 18:36] `CtaBand`
  - Implements: REQ-040, REQ-041, TS-006, DES-020, DES-021, DES-040
  - Uses API: none (`settings.booking_url`)
  - Behaviour: dark-olive band, two-line huge uppercase statement (`--text-h2` up to `--text-hero` on desktop) in
    `--accent-on-surface`, hairline divider, two actions: `BookCallLink` (primary) and `ButtonLink` to `/contact`
    (secondary). Statement text from `copy.ts` (original). Heading level `h2`.
  - States: n/a.
  - Done when: UI-T-032 passes.

- UI-017 [IMPLEMENTED 2026-10-30 18:36] `FaqPreview`
  - Implements: REQ-006, TS-004, TS-006, DES-040
  - Uses API: `listPublicFaqPreview` (via page aggregates `home`, `work`, `about`, `contact`)
  - Behaviour: cream section with `SectionHeading` ("Questions" style heading from `copy.ts`) and an `Accordion` of the
    preview FAQs in the given order (category position, then FAQ position), all collapsed, two columns on ≥ 810 px; a
    "See all FAQs" link to `/faqs`. Answers are plain text: blank lines become paragraphs. Used on Home, Work, About and
    Contact. Zero preview FAQs → section not rendered.
  - States: empty (hidden), success.
  - Done when: UI-T-033 passes.

- UI-018 [IMPLEMENTED 2026-10-30 18:36] `StoryBlock` (personal story)
  - Implements: REQ-014, REQ-040, TS-006, TS-013, DES-013, DES-040
  - Uses API: `getPublicSite` (`profile.portrait`, `profile.bio`, `profile.name`)
  - Behaviour: cream section; portrait (`ResponsiveImage`, monochrome via a CSS `grayscale` filter, decorative green
    tape on one corner, `aria-hidden`) on the left, bio paragraphs on the
    right with a name sign-off line; stacked (portrait first) below 810 px. Used on Home and About.
  - States: portrait missing (fallback block), bio empty (section hidden).
  - Done when: UI-T-034 passes.

### 1.3 Public layout (App: public)

- UI-019 [IMPLEMENTED 2026-10-30 18:36] `Header` (fixed, compact on scroll)
  - Implements: REQ-002, REQ-003, REQ-001, REQ-NFR-002, TS-006, DES-002, DES-040
  - Uses API: none (`settings.booking_url` from `site`)
  - Behaviour (our design, DES-040): `<header>` fixed to the top, `--header-h` tall and transparent over the dark hero;
    after the visitor scrolls past its own height (zero-height sentinel at the top observed by `IntersectionObserver`,
    no scroll listeners) it switches to `data-compact` (`--header-h-compact`, `--color-bg-deepest` background, hairline
    bottom border). Pages without a dark hero start compact. Contents: `Wordmark` link Home; `<nav aria-label="Main">`
    with `NavLink`s Work, Writing, About, Contact (current link `aria-current="page"` plus underline/green marker; Work
    is current on `/work/*`, Writing on `/writing/*`); `BookCallLink` as primary button. Below 810 px links and button
    are replaced by a "Menu" button (UI-020). Header text on its dark background uses dark-surface aliases.
  - States: transparent, compact, focus-visible.
  - Done when: UI-T-035, UI-T-036 and E2E UI-T-107 pass.

- UI-020 [IMPLEMENTED 2026-10-30 18:36] Mobile menu (full-screen overlay)
  - Implements: REQ-003, REQ-NFR-002, REQ-NFR-003, TS-006, DES-040
  - Uses API: none
  - Behaviour (our design): below 810 px the header shows a "Menu" button (`aria-expanded`, `aria-controls`). It opens a
    full-screen dark (`--color-bg-deepest`) dialog (`role="dialog" aria-modal="true" aria-label="Menu"`) containing a
    close button, large display-font links (Home, Work, Writing, About, Contact, FAQs) and the "Book a call" button.
    Focus moves to the first link; Tab is trapped; Escape or close returns focus to the Menu button; selecting a link
    closes the menu and navigates; any route change closes it; background is inert (`inert` on siblings) and body
    scrolling locked while open. If the viewport grows past 810 px while open, it closes. Fade in 200 ms (none under
    reduced motion).
  - States: closed, open.
  - Done when: UI-T-037, UI-T-038 and E2E UI-T-106 pass.

- UI-021 [IMPLEMENTED 2026-10-30 18:36] (definition updated 2026-10-30 05:08, CHG-005) `Footer`
  - Implements: REQ-004, REQ-005, REQ-001, REQ-065, TS-005, TS-006, TS-013, DES-002, DES-021, DES-040
  - Uses API: `getPublicSite` (`settings.social_links`, `settings.contact_email`, `settings.footer_signoff`,
    `settings.footer_rights_line`, `generated_at`)
  - CHG-005: the rights line in the bottom bar is `settings.footer_rights_line` (plain text), no longer `copy.ts`
    `footer.rights`; remove that static string once the field is wired.
  - Behaviour: dark-olive `<footer>` in `--container-wide`. Giant `Wordmark` (`--text-footer-mark`) with a small rotated
    green sub-label tile ("Content & strategy", original copy); three link groups each with a small green label: quick
    links (Work, Writing, About, Contact, FAQs), social links (from settings; `target="_blank"`
    `rel="noopener noreferrer"`), email (`mailto:`); the build year (year of `site.generated_at`) top-right. Bottom bar:
    "© <year> Mitali", the footer sign-off from settings, and a rights line. Mobile: wordmark on top, groups stacked,
    bottom bar three stacked lines. Empty social links → that group is omitted.
  - States: with / without social links.
  - Done when: UI-T-039, UI-T-040, UI-T-123 pass.

### 1.4 Public pages (App: public)

Section surfaces per page (alternation per DES-012; tapes from UI-008 at dark/cream seams):

| Page | Sections in order (surface) |
|------|-----------------------------|
| Home | Hero (deepest) > Featured work (cream) > Services (dark) > Engagement models (cream) > Story (cream, divider between) > Testimonials (dark) > FAQ preview (cream) > Footer (dark) |
| Work | Heading + grid (cream) > FAQ preview (dark) > Footer |
| Case study | Cover (deepest, full width) > Details, problem, solution (cream) > Results (dark) > Gallery (cream) > More work (dark) > Footer |
| Writing | Heading + filter + grid (cream) > Footer |
| Writing sample | Header block (dark) > Body (cream) > Footer |
| About | Hero (deepest) > Origin (cream) > Vision (dark) > Values (cream) > Process staircase (dark) > Story (cream) > FAQ preview (cream) > CTA band (dark) > Footer |
| FAQs | Heading + grouped accordions (cream) > CTA band (dark) > Footer |
| Contact | Heading + form (dark) > FAQ preview (cream) > Footer |
| 404 | Message (deepest) > Footer |

- UI-022 [IMPLEMENTED 2026-10-30 18:36] Home page and hero
  - Implements: REQ-001, REQ-010, REQ-006, REQ-014, TS-006, DES-003, DES-020, DES-021, DES-040
  - Uses API: page aggregate `home` (`listPublicCaseStudies?featured=true`, `listPublicServices`,
    `listPublicEngagementModels`, `listPublicTestimonials`, `listPublicFaqPreview`) + `site`
  - Behaviour: composes UI-023 to UI-026, `StoryBlock` and `FaqPreview` in the order of the table above. Hero: the page's
    only `h1` (uppercase statement, `--text-hero`, `--color-primary`), short intro (`--text-lead`), highlighted tagline
    line, `BookCallLink` (primary) and "View work" `ButtonLink` to `/work` (secondary), glow (UI-003). On desktop the
    statement sits left and intro/buttons in a lower right column; on mobile everything stacks. Both actions are visible
    without scrolling at 1440×900 and 390×844 (hero height `min(100svh, …)` minus nothing hidden under the header).
    Hero copy from `copy.ts`.
  - States: success; each data section hides itself when empty.
  - Done when: UI-T-041 and E2E UI-T-103 pass.

- UI-023 [IMPLEMENTED 2026-10-30 18:36] Home: featured work
  - Implements: REQ-011, TS-004, TS-005, TS-006, DES-040
  - Uses API: `listPublicCaseStudies` (`featured=true`), aggregate takes the first 4 by position
  - Behaviour: `SectionHeading` with "View all work" action link to `/work`; `CardGrid` of up to 4 `CaseStudyCard`s.
  - States: empty (section hidden), success.
  - Done when: UI-T-042 passes.

- UI-024 [IMPLEMENTED 2026-10-30 18:36] Home: services list
  - Implements: REQ-012, TS-006, DES-040
  - Uses API: `listPublicServices`
  - Behaviour: dark-olive section; `Accordion` whose rows show the service name (`--text-h3`, green on dark) and plus icon;
    expanded panel shows the description and a deliverables list (`<ul>`). Three-column grid of rows on desktop, two on
    tablet, one on mobile; DOM order stays service order.
  - States: empty (section hidden), success, expanded.
  - Done when: UI-T-043 passes.

- UI-025 [IMPLEMENTED 2026-10-30 18:36] Home: engagement models
  - Implements: REQ-013, TS-006, DES-013, DES-040
  - Uses API: `listPublicEngagementModels`
  - Behaviour: cream section with dark-olive cards (3 columns desktop, 1 column below 810 px, 2 + 1 on tablet). Each card:
    green `h3` name, description, feature checklist (`<ul>` with check icons `aria-hidden`), action at the bottom using
    `cta_label`; `cta_target = booking` → `BookCallLink` behaviour with that label, `contact` → `/contact`. No prices.
  - States: empty (section hidden), success.
  - Done when: UI-T-044 passes.

- UI-026 [IMPLEMENTED 2026-10-30 18:36] Home: testimonials section
  - Implements: REQ-015, TS-004, TS-006, DES-040
  - Uses API: `listPublicTestimonials`
  - Behaviour: dark-olive section with visually hidden `h2` "What clients say" (or a visible heading from `copy.ts`) and
    the `Carousel`. When `case_study_slug` is present the slide shows a "Read the case study" link.
  - States: empty (hidden), single, multiple.
  - Done when: UI-T-045 passes.

- UI-027 [IMPLEMENTED 2026-10-30 18:36] Work page
  - Implements: REQ-020, REQ-001, REQ-006, TS-006, DES-040
  - Uses API: aggregate `work` (`listPublicCaseStudies`, `listPublicFaqPreview`)
  - Behaviour: `h1` with tape, short intro, `CardGrid` of every published case study in display order, `FaqPreview`.
  - States: empty ("New case studies are on the way" message + link to Contact), success.
  - Done when: UI-T-046 passes.

- UI-028 [IMPLEMENTED 2026-10-30 18:36] Case-study page `/work/:slug`
  - Implements: REQ-021, REQ-022, REQ-023, REQ-050, TS-004, TS-006, DES-021, DES-040
  - Uses API: `getPublicCaseStudy` (key `work/<slug>`; includes results, images, `more_work`)
  - Behaviour:
    - Full-width cover (`ResponsiveImage priority`, the LCP image).
    - Details block: `h1` title with tape left, campaign-type chip right; description list (`<dl>`) rows Client, Year,
      Industry, Timeline, Campaign type, Channels (comma-separated), label left / value right, hairline dividers;
      "Sample case study" note (UI-015) when `is_sample`; summary paragraph.
    - Problem and Solution: `h2` left, `SanitizedHtml` right half on desktop, stacked on mobile.
    - Results row: `h2` "Results"; each result shows value (large display), metric label, before value and change when
      present, period; as a list (`<ul>`), 3 columns desktop, 1-2 below; `SampleDataNote` "Sample data" when any result
      has `is_sample`. No results → row hidden.
    - Gallery: ordered tiles inside `--container-wide`; `full` spans the width, consecutive `half` tiles sit side by side
      on ≥ 810 px and stack below; no gaps; captions as `<figcaption>` when present; alt from the API.
    - More work: up to 2 `CaseStudyCard`s from `more_work` + "View all work" link to `/work`; strip hidden when empty
      (link kept in the heading of the previous section).
    - Unknown/unpublished slug → loader throws 404 → UI-034.
  - States: success, not found, sections hidden when empty.
  - Done when: UI-T-047 to UI-T-049 pass.

- UI-029 [IMPLEMENTED 2026-10-30 18:36] Writing page with URL filter `/writing?format=`
  - Implements: REQ-030, REQ-023, REQ-NFR-002, TS-005, TS-006, DES-040
  - Uses API: aggregate `writing` (`listPublicWritingSamples`, unfiltered)
  - Behaviour: `h1` with tape; filter bar `<nav aria-label="Filter by format">` with `FilterChip` links: All (`/writing`),
    Blog (`blog`), Web copy (`web_copy`), Email (`email`), Social (`social`), Landing page (`landing_page`), Newsletter
    (`newsletter`) → `?format=<value>`; horizontally scrollable inside its own container on mobile (page itself never
    scrolls sideways). Server render and first client render list all samples with "All" current (no hydration
    mismatch); after hydration (`useHydrated`) the `format` search param filters the list and sets the current chip.
    Chip clicks are client navigations that change only the search (`shouldRevalidate` false; no data refetch); back/
    forward restore the filter. A polite live region announces "Showing 2 email samples". Unknown `format` → treated as
    All. No matches → empty state "No samples in this format yet" with a "Show all" link. Without JS all samples are
    listed and chip links reload the full list.
  - States: success (all), filtered, empty filter result, empty list ("Writing samples coming soon").
  - Done when: UI-T-050 to UI-T-054 and E2E UI-T-108 pass.

- UI-030 [IMPLEMENTED 2026-10-30 18:36] (definition updated 2026-10-30 05:08, CHG-005) Writing-sample page `/writing/:slug`
  - Implements: REQ-031, REQ-022, REQ-023, REQ-050, TS-006, TS-012, DES-021, DES-040
  - Uses API: `getPublicWritingSample` (key `writing/<slug>`)
  - Behaviour: dark header block: format chip, `h1` title, meta list (client when present, date formatted
    `Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" })` in a `<time datetime>`, "N min read"), tags as
    chips, "Sample" note when `is_sample`; thumbnail as `ResponsiveImage priority` when present. Body: `SanitizedHtml`
    in a cream section at `--measure`. Footer of the article: "Back to writing" link and `BookCallLink`.
  - Article-body headings (CHG-005, design call delegated by the user; see the DES-021 note): the page `h1` is the
    sample title, so author Markdown `#` renders as `h2`, `##` as `h3`, `###` and deeper as `h4` (the builder's
    existing mapping is kept). Styles, scoped to the article body: `h2` = `--text-h3` (display, uppercase), `h3` =
    `--text-statement` (body font, bold), `h4` = `--text-label` (display, uppercase); body line length `--measure`.
    Tokens only, no literal sizes.
  - States: success, not found.
  - Done when: UI-T-055 passes.

- UI-031 [IMPLEMENTED 2026-10-30 18:36] About page with staircase process
  - Implements: REQ-040, REQ-014, REQ-006, REQ-NFR-002, TS-006, DES-020, DES-021, DES-040
  - Uses API: aggregate `about` (`listPublicValues`, `listPublicProcessSteps`, `listPublicFaqPreview`) + `site`
    (`profile.origin_statement`, `profile.vision_blocks`)
  - Behaviour: statement hero (`h1`, `--text-hero`, intro, two actions as on Home, no glow required); origin statement
    (small tape label left, `--text-statement` paragraph offset right); vision block with the two `vision_blocks` side by
    side (green `h3` + paragraph) on ≥ 810 px; values (label left, 4 large uppercase `h3`s each with a muted paragraph);
    process steps as an ordered list `<ol>` in display order: on desktop each `li` is offset down and right to form a
    descending staircase using `:nth-child` classes in CSS grid (DOM and reading order unchanged), on tablet a 2 × 2
    grid, on mobile stacked; `StoryBlock`; `FaqPreview`; `CtaBand`.
  - States: success; values/steps sections hidden when empty.
  - Done when: UI-T-056, UI-T-057 pass.

- UI-032 [IMPLEMENTED 2026-10-31 00:12] FAQs page
  - Implements: REQ-041, REQ-001, TS-006, DES-040
  - Uses API: aggregate `faqs` (`listPublicFaqGroups`)
  - Behaviour: `h1` with tape; one group per category in category order: `h2` category name + `Accordion` (items `h3`)
    with two columns on ≥ 810 px and one below; then `CtaBand`.
  - States: empty ("No questions published yet" + CTA band), success.
  - Done when: UI-T-058, UI-T-059 pass.

- UI-033 [IMPLEMENTED 2026-10-30 18:36] (definition updated 2026-10-30 05:08, CHG-005) Contact page and enquiry form
  - Implements: REQ-042, REQ-043, REQ-006, REQ-NFR-002, REQ-NFR-005, TS-007, TS-013, DES-013, DES-040
  - Uses API: `createEnquiry` (runtime, the only public runtime call); aggregate `contact` (`listPublicFaqPreview`) +
    `site` (`settings.contact_email`, `settings.contact_promise`)
  - Behaviour:
    - Dark-olive two-column block: left `h1` (giant), promise line (`settings.contact_promise`, plain text; replaces the
      static `copy.ts` `contactPage.promise`, CHG-005), contact email (`mailto:`, mail icon `aria-hidden`);
      right the form (below the heading on mobile). Then `FaqPreview`.
    - Fields (labels above, required marked with a visible asterisk in `--accent-on-surface` plus "(required)" text for
      screen readers): Name, Email (`type="email" autocomplete="email"`), Enquiry type (required `<select>` that starts
      on a placeholder option "Choose one…" with `value=""`, followed by Content strategy, Copywriting, SEO content,
      Brand messaging, Campaign planning, Other; 7 options in total; the placeholder is not a valid choice, so
      submitting it gives the field error "Choose what your enquiry is about." and nothing is sent; it is never sent as
      `enquiry_type`; CHG-005, REQ-042), Budget range (optional `<select>`:
      Under 1,000 / 1,000–3,000 / 3,000–7,500 / 7,500–15,000 / Over 15,000 / Not sure; no currency until open question 2
      of the tech spec is resolved), Company (optional), Message (`<textarea>`, character counter at 5000). Inputs on dark
      use `--color-input-bg-dark` with a `--color-border-on-dark` border. Privacy note (`copy.ts`) under the submit button.
      Full-width primary submit "Send enquiry".
    - Honeypot `website` field: off-screen, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`, no visible label.
    - Validation: one Zod schema mirroring `EnquiryCreate` (trimmed; name 1..120, email ≤ 254 valid, enum values with
      the empty placeholder value rejected as "required", company ≤ 120, message 1..5000). Validate on submit, then on change for touched fields. Errors: text under each
      field (`aria-describedby`, `aria-invalid`, `--danger-on-surface`), focus moves to the first invalid field.
    - The form is `method="post"` with `noValidate`; in the pre-rendered HTML the submit button is disabled until
      hydration, and a `<noscript>` line offers the email address instead (so no form data ever lands in a URL).
  - States:
    - idle;
    - client validation error (field errors, focus first invalid, nothing sent);
    - submitting (button `loading`, "Sending…", fields read-only, no double submit);
    - success (201 → form replaced by a confirmation panel with heading, focus moved to it; also shown for honeypot hits);
    - server validation error (422 `fields` mapped onto the fields, focus first);
    - rate limited (429 → banner "You've sent several messages in a short time. Please try again later." with
      `role="alert"`, input kept);
    - server/network error (5xx or fetch failure → banner with the contact email as fallback, input kept, resubmit allowed).
  - Done when: UI-T-060 to UI-T-068, UI-T-124 and E2E UI-T-110, UI-T-111, UI-T-126 pass.

- UI-034 [IMPLEMENTED 2026-10-30 18:36] Not-found page (404) and route error page
  - Implements: REQ-001, REQ-022, TS-005, TS-006, DES-003, DES-040
  - Uses API: none
  - Behaviour: rendered for `*` and for loader 404s; dark section with `h1` (original copy, e.g. "This page took a day
    off"), one-line explanation, primary link "Back to home" and secondary link to `/work`; head has `noindex` and title
    "Page not found — Mitali". Pre-rendered as `404.html` (served with status 404 by the preview server, TS-003). The
    generic route error page shares the layout with "Something went wrong" copy and a reload link.
  - States: not found, unexpected error.
  - Done when: UI-T-069 and E2E UI-T-104 pass.

### 1.5 Admin foundation (App: admin)

- UI-035 [IMPLEMENTED 2026-10-30 18:36] Admin API client, session and query plumbing
  - Implements: REQ-060, REQ-NFR-005, TS-008, TS-016, DES-042
  - Uses API: all admin operations via the generated `openapi-fetch` client; `getAdminMe` for CSRF recovery
  - Files: `src/api/schema.d.ts` (generated, never hand-edited), `src/api/client.ts`, `src/features/admin/session/`
  - Behaviour: `credentials: "same-origin"`; middleware adds `X-CSRF-Token` (token held in a module-level memory store set
    by `adminLogin`/`getAdminMe`) to every non-GET; on 401 clears the TanStack Query cache and the token and navigates to
    `/admin/login?next=<current path>` with a "Your session has ended. Please log in again." notice; on 403 `csrf_failed`
    calls `getAdminMe` once and retries the request once, then surfaces the error. Error envelope parsed into a typed
    `ApiError { status, code, message, fields? }`. Query defaults: `staleTime` 30 s, retry only on network/5xx (max 2),
    never on 4xx. Nothing written to `localStorage`, `sessionStorage` or non-HttpOnly cookies by the app.
  - States: authenticated, session expired, CSRF recovery, network error.
  - Done when: UI-T-070, UI-T-071 pass.

- UI-036 [IMPLEMENTED 2026-10-30 18:36] Admin login `/admin/login`
  - Implements: REQ-060, REQ-061, REQ-062, REQ-NFR-002, TS-008, TS-016, DES-002, DES-013, DES-042
  - Uses API: `adminLogin`, `getAdminMe` (already logged in → redirect)
  - Behaviour: centred card on neutral surface with the admin `Wordmark` and `h1` "Admin login"; Email
    (`autocomplete="username"`) and Password (`autocomplete="current-password"`, show/hide toggle, paste allowed) fields;
    submit "Log in". Hint text: "Forgot your password? Reset it with the reset-password command (see README)." No sign-up.
    After success navigate to `next` when it is a same-origin path starting with `/admin` (rejects `//…`, absolute URLs,
    backslashes, non-admin paths) else `/admin`.
  - States: idle; validation error (both fields required, email format); submitting (button loading); invalid credentials
    (401 → `role="alert"` "Email or password is incorrect.", password cleared, focus to password); too many attempts (429
    → "Too many attempts. Try again in 15 minutes."); origin rejected/other 4xx-5xx (generic "Login failed. Please try
    again."); network error; already logged in (redirect); session-ended notice (from UI-035).
  - Done when: UI-T-071 to UI-T-074 and E2E UI-T-113, UI-T-114 pass.

- UI-037 [IMPLEMENTED 2026-10-30 18:36] Admin layout, guard, sidebar and logout
  - Implements: REQ-060, REQ-066, REQ-NFR-002, TS-016, DES-002, DES-042
  - Uses API: `getAdminMe` (layout loader guard), `getAdminDashboard` (new-enquiry badge, shared query), `adminLogout`
  - Behaviour: layout loader calls `getAdminMe`; 401 → redirect to login with `next`. Dark-olive sidebar (`--color-dark`)
    with green `Wordmark`, `<nav aria-label="Admin">` links: Dashboard, Case studies, Writing, Services, Engagement
    models, Testimonials, FAQs, Values, Process steps, Profile, Settings, Enquiries (badge with the count of new
    enquiries, text "3 new"); active link has `aria-current="page"` and a green marker; "View site" (new tab) and
    "Log out" at the bottom. Content area light (`--color-white`/neutral-50). Below 810 px the sidebar becomes a top bar
    with a menu button opening a drawer (dialog pattern as UI-020). Each screen sets `document.title`
    ("<Screen> — Admin — Mitali") and moves focus to its `h1` on navigation. Toast region (`role="status"`) for
    success messages; errors use `role="alert"`. Logout: `adminLogout`, then always clears cache and navigates to login.
  - States: checking session (full-page spinner), authenticated, session expired (redirect), logout failure (still
    navigates to login).
  - Done when: UI-T-075, UI-T-076 pass.

- UI-038 [IMPLEMENTED 2026-10-30 18:36] Admin dashboard with "needs rebuild" notice
  - Implements: REQ-052, REQ-066, TS-015, TS-016, DES-013, DES-042
  - Uses API: `getAdminDashboard`
  - Behaviour: `h1` "Dashboard". Rebuild panel: `needs_rebuild = true` → warning notice ("Site needs rebuilding. Content
    changed on <content_changed_at>.") with the `rebuild_command` in a `<code>` block and a "Copy command" button
    (Clipboard API; on failure the text is selected and "Press Ctrl+C to copy" shown); `last_build = null` → "The site
    has not been built yet" plus the command; otherwise success "Public site is up to date — last built <built_at>".
    Card "New enquiries: N" linking to `/admin/enquiries?status=new`. Content counts table (type, published, total) with
    links to each list. Times formatted with `Intl` in the local time zone. Refetches on window focus.
  - States: loading (skeleton), error (message + Retry), success with each rebuild variant.
  - Done when: UI-T-077, UI-T-078 and E2E UI-T-115 pass.

- UI-039 [IMPLEMENTED 2026-10-30 18:36] `ReorderableList` (drag + move up/down)
  - Implements: REQ-063, REQ-064, REQ-NFR-002, TS-010, TS-016, DES-042
  - Uses API: every `reorderAdmin*` operation (`reorderAdminCaseStudies`, `reorderAdminCaseStudyResults`,
    `reorderAdminCaseStudyImages`, `reorderAdminWritingSamples`, `reorderAdminServices`, `reorderAdminEngagementModels`,
    `reorderAdminTestimonials`, `reorderAdminFaqCategories`, `reorderAdminFaqs`, `reorderAdminValues`,
    `reorderAdminProcessSteps`) passed in by the screen
  - Behaviour: list items with a drag handle (pointer events, no extra dependency) and "Move up" / "Move down" icon
    buttons with accessible names ("Move <title> up"); first/last disable the matching button. Every move sends the
    full id list (FAQs: `{ category_id, ids }`), applies an optimistic update, announces "Moved <title> to position 3 of
    6" in a polite live region, keeps focus on the moved item's button. Error → rollback + error toast; 422
    `order_mismatch` → refetch list + "The list changed elsewhere and has been reloaded." Keys are item ids.
  - States: idle, saving (subtle inline spinner, further moves queued), error/rollback.
  - Done when: UI-T-079, UI-T-080 pass.

- UI-040 [IMPLEMENTED 2026-10-30 18:36] Admin form and list kit
  - Implements: REQ-063, REQ-064, REQ-065, REQ-NFR-002, TS-010, TS-016, DES-042
  - Uses API: none directly (used by every admin screen)
  - Behaviour: `FormField` (label, hint, error, `aria-describedby`, `aria-invalid`), `TextInput`, `TextArea` with counter,
    `Select`, `Checkbox`/`Switch` (Published, Featured, Sample data, Show in preview), `DateInput`, `StringListInput`
    (add/remove/reorder short strings with limits; used for channels, goals, tags, deliverables, features, skills, tools,
    bio paragraphs), `SlugInput` (suggests a slug from the title until edited; pattern hint), `ConfirmDialog`
    (`alertdialog`, focus trap, Escape cancels, destructive button in `--color-danger`), `SidePanel` (list + panel editing
    for small types; full-screen sheet below 810 px), `DataTable` (stacked cards below 810 px), `EmptyState`,
    `ErrorState` (message + Retry), `NotFoundState` ("This item no longer exists" + back link), `Toast`.
    `useServerErrors(form)` maps `ApiError.fields` (dotted paths, e.g. `results.0.value`) and 409 `slug_taken` onto
    fields and focuses the first error; unknown codes show a form-level alert. Unsaved-changes guard (`useBlocker` +
    `beforeunload`) on dirty forms. Zod schemas mirror the contract input schemas (lengths, patterns, enums).
  - States: per component (default, invalid, disabled, saving).
  - Done when: UI-T-081, UI-T-082 pass.

- UI-041 [IMPLEMENTED 2026-10-30 18:36] Markdown editor with live preview
  - Implements: REQ-064, REQ-063, REQ-031, TS-012, TS-016, DES-042
  - Uses API: `previewAdminMarkdown`
  - Behaviour: labelled `<textarea>` (monospace not required; Public Sans) with a short syntax help (headings, lists,
    links, bold/italic, quotes, tables; no images, raw HTML is shown as text). Desktop: editor and preview side by side;
    below 1200 px: "Write" / "Preview" tabs (`role="tablist"`). Preview requests are debounced 400 ms, the latest response
    wins (stale responses ignored), rendered via `SanitizedHtml`. Counter and limit 100 000 characters.
  - States: preview empty ("Nothing to preview yet"), loading (subtle indicator, previous preview kept), error
    ("Preview unavailable. Your text is not affected." + Retry), success.
  - Done when: UI-T-083 passes.

- UI-042 [IMPLEMENTED 2026-10-30 18:36] Media field, picker and upload
  - Implements: REQ-063, REQ-064, REQ-065, REQ-NFR-002, TS-011, TS-016, DES-042
  - Uses API: `uploadAdminMedia`, `listAdminMedia`, `deleteAdminMedia`
  - Behaviour: `MediaField` (used for cover, thumbnail, portrait, gallery add) shows the current image thumbnail,
    "Choose image" / "Remove" buttons and a required alt-text input whenever an image is set ("Describe the image for
    people who cannot see it"). "Choose image" opens a dialog with tabs Upload and Library:
    - Upload: file input (`accept="image/jpeg,image/png,image/webp,image/svg+xml"`) plus drop zone (the input is always
      usable by keyboard). Client pre-checks type and size ≤ 10 MB with the same wording as the server; then
      `uploadAdminMedia` (optional alt). While processing: indeterminate progress "Processing image…", cancel disabled.
      Server errors: 413 "Images must be 10 MB or smaller.", 415 "Upload a JPEG, PNG, WebP or SVG image.", 422
      `invalid_image` "This file could not be read as an image." Success selects the new asset.
    - Library: paginated grid (newest first, `page_size` 24, "Load more"), each tile a button with the filename and
      dimensions; select returns the asset; "Delete" on a tile asks for confirmation; 409 `media_in_use` → "This image is
      used by content. Remove it there first."
  - States: library loading, empty ("No images yet — upload one"), error + Retry, uploading, upload error, selected.
  - Done when: UI-T-084 to UI-T-086 and E2E UI-T-116 pass.

### 1.6 Admin content screens (App: admin)

- UI-043 [IMPLEMENTED 2026-10-30 18:36] Case studies list `/admin/case-studies`
  - Implements: REQ-063, REQ-067, TS-010, TS-016, DES-042
  - Uses API: `listAdminCaseStudies`, `reorderAdminCaseStudies`, `deleteAdminCaseStudy`
  - Behaviour: `h1`, "New case study" button; `ReorderableList` rows with cover thumbnail, title, client, status chips
    (Published/Draft, Featured, Sample), Edit link, Delete. Delete confirmation names the case study and states that its
    results and gallery entries are removed too; success toast and list refresh.
  - States: loading, empty ("No case studies yet" + create action), error + Retry, success, deleting.
  - Done when: UI-T-087 passes.

- UI-044 [IMPLEMENTED 2026-10-30 18:36] Case-study editor: create and details tab `/admin/case-studies/new`, `/:id`
  - Implements: REQ-063, REQ-067, REQ-021, TS-010, TS-011, TS-012, TS-016, DES-042
  - Uses API: `createAdminCaseStudy`, `getAdminCaseStudy`, `updateAdminCaseStudy`, `deleteAdminCaseStudy`,
    `updateAdminCaseStudyResult` (clear sample flags)
  - Behaviour: tabs Details / Results / Gallery (`role="tablist"`; Results and Gallery disabled with a hint until the case
    study is created). Details form = `CaseStudyInput`: title, `SlugInput`, client name, client industry, campaign type,
    channels and goals (`StringListInput`), summary (counter 600), problem and solution (`MarkdownEditor`), year, timeline,
    cover (`MediaField` + required alt), switches Featured / Published / Sample data. "Save" (PUT full replace) and on
    create navigates to `/admin/case-studies/:id`. "Clear sample flags" (shown when the case study or any result is
    flagged): confirmation, then case-study PUT with `is_sample=false` and one result PUT per flagged result; partial
    failure reports which items failed. Public URL shown as text with the note "Visible on the site after the next rebuild."
  - States: loading, not found (404), error + Retry, validation errors (incl. 409 slug on the slug field), saving,
    saved (toast), dirty (leave guard).
  - Done when: UI-T-086, UI-T-088, UI-T-089 and E2E UI-T-115, UI-T-118 pass.

- UI-045 [IMPLEMENTED 2026-10-30 18:36] Case-study results editor (Results tab)
  - Implements: REQ-063, REQ-021, REQ-067, TS-010, TS-016, DES-042
  - Uses API: `getAdminCaseStudy` (embedded results), `createAdminCaseStudyResult`, `updateAdminCaseStudyResult`,
    `deleteAdminCaseStudyResult`, `reorderAdminCaseStudyResults`
  - Behaviour: `ReorderableList` of results; each opens an inline form: metric label (≤ 80), value (≤ 30), before value,
    change, period (optional), Sample data switch. "Add result" appends an empty form. Delete with confirmation.
  - States: loading, empty ("No results yet"), error, saving per row, validation errors per row.
  - Done when: UI-T-090 passes.

- UI-046 [IMPLEMENTED 2026-10-30 18:36] Case-study gallery editor (Gallery tab)
  - Implements: REQ-063, REQ-021, TS-010, TS-011, TS-016, DES-042
  - Uses API: `getAdminCaseStudy` (embedded images), `createAdminCaseStudyImage`, `updateAdminCaseStudyImage`,
    `deleteAdminCaseStudyImage`, `reorderAdminCaseStudyImages`, plus UI-042 operations
  - Behaviour: "Add image" opens the media picker; the new tile requires alt text (≤ 250) before "Save" is enabled and
    shows the error "Add alt text before saving" otherwise; caption optional (≤ 200); layout toggle Full / Half
    (radio group). A layout preview grid mirrors the public gallery (full spans two columns, halves side by side).
    `ReorderableList` for order; delete with confirmation (media stays in the library).
  - States: loading, empty ("No gallery images yet"), error, unsaved tile, saving, validation error.
  - Done when: UI-T-091 and E2E UI-T-116 pass.

- UI-047 [IMPLEMENTED 2026-10-30 18:36] Writing samples list `/admin/writing`
  - Implements: REQ-064, REQ-067, TS-010, TS-016, DES-042
  - Uses API: `listAdminWritingSamples`, `reorderAdminWritingSamples`, `deleteAdminWritingSample`
  - Behaviour: as UI-043 with columns title, format label, published date, chips Published/Draft, Featured, Sample.
  - States: loading, empty + create action, error + Retry, success.
  - Done when: UI-T-092 passes.

- UI-048 [IMPLEMENTED 2026-10-30 18:36] Writing-sample editor `/admin/writing/new`, `/:id`
  - Implements: REQ-064, REQ-067, REQ-031, TS-010, TS-011, TS-012, TS-016, DES-042
  - Uses API: `createAdminWritingSample`, `getAdminWritingSample`, `updateAdminWritingSample`, `deleteAdminWritingSample`
  - Behaviour: form = `WritingSampleInput`: title, `SlugInput`, format (`Select`, 6 options), client name and industry
    (optional), excerpt (counter 600), body (`MarkdownEditor`), published on (`DateInput`), tags (`StringListInput`),
    thumbnail (`MediaField` + alt), switches Featured / Published / Sample data. Read-only word count and reading time
    from the last saved response.
  - States: loading, not found, error, validation (incl. 409 slug), saving, saved, dirty guard.
  - Done when: UI-T-093 passes.

- UI-049 [IMPLEMENTED 2026-10-30 18:36] Services `/admin/services`
  - Implements: REQ-064, TS-010, TS-016, DES-042
  - Uses API: `listAdminServices`, `createAdminService`, `getAdminService`, `updateAdminService`, `deleteAdminService`,
    `reorderAdminServices`
  - Behaviour: list + `SidePanel`; fields name (≤ 80), description (≤ 600), deliverables (`StringListInput`), Published.
  - States: loading, empty + create, error, saving, validation, delete confirm.
  - Done when: UI-T-094 passes.

- UI-050 [IMPLEMENTED 2026-10-30 18:36] Engagement models `/admin/engagement-models`
  - Implements: REQ-064, REQ-013, TS-010, TS-016, DES-042
  - Uses API: `listAdminEngagementModels`, `createAdminEngagementModel`, `getAdminEngagementModel`,
    `updateAdminEngagementModel`, `deleteAdminEngagementModel`, `reorderAdminEngagementModels`
  - Behaviour: list + panel; fields name, description, features (`StringListInput`), button label (≤ 40, default
    "Book a call"), button target (`booking` "Booking link" / `contact` "Contact page"), Published.
  - States: as UI-049.
  - Done when: UI-T-095 passes.

- UI-051 [IMPLEMENTED 2026-10-30 18:36] Testimonials `/admin/testimonials`
  - Implements: REQ-064, REQ-015, TS-010, TS-016, DES-042
  - Uses API: `listAdminTestimonials`, `createAdminTestimonial`, `getAdminTestimonial`, `updateAdminTestimonial`,
    `deleteAdminTestimonial`, `reorderAdminTestimonials`, `listAdminCaseStudies` (link options)
  - Behaviour: list (quote excerpt, author, company, chip) + panel; fields quote (≤ 600), author name, author role,
    company, linked case study (`Select` with "None"), Published.
  - States: as UI-049; case-study options loading/error inside the select.
  - Done when: UI-T-096 passes.

- UI-052 [IMPLEMENTED 2026-10-30 18:36] FAQ categories and FAQs `/admin/faqs`
  - Implements: REQ-064, REQ-006, REQ-041, TS-010, TS-016, DES-042
  - Uses API: `listAdminFaqCategories`, `createAdminFaqCategory`, `getAdminFaqCategory`, `updateAdminFaqCategory`,
    `deleteAdminFaqCategory`, `reorderAdminFaqCategories`, `listAdminFaqs` (`category_id`), `createAdminFaq`,
    `getAdminFaq`, `updateAdminFaq`, `deleteAdminFaq`, `reorderAdminFaqs`
  - Behaviour: categories as a `ReorderableList` of sections, each with its FAQs as a nested `ReorderableList`
    (reorder within the category). Category panel: name (unique, ≤ 80), Published. FAQ panel: category (`Select`;
    changing it moves the FAQ to the end of the target category), question (≤ 200), answer (plain text ≤ 2000; blank line
    = new paragraph), Show in preview, Published. Count of preview FAQs shown ("6 FAQs shown in previews").
    Deleting a category that still has FAQs → 409 `category_not_empty` shown as "Move or delete the FAQs in this
    category first." and the category stays.
  - States: loading, empty (no categories → create category first; category without FAQs → "No FAQs in this category"),
    error, saving, validation (duplicate name mapped to the name field), delete refused.
  - Done when: UI-T-097 and E2E UI-T-117 pass.

- UI-053 [IMPLEMENTED 2026-10-30 18:36] Values `/admin/values`
  - Implements: REQ-064, REQ-040, TS-010, TS-016, DES-042
  - Uses API: `listAdminValues`, `createAdminValue`, `getAdminValue`, `updateAdminValue`, `deleteAdminValue`,
    `reorderAdminValues`
  - Behaviour: generic title/body list + panel (title ≤ 80, body ≤ 600, Published).
  - States: as UI-049.
  - Done when: UI-T-098 passes.

- UI-054 [IMPLEMENTED 2026-10-30 18:36] Process steps `/admin/process-steps`
  - Implements: REQ-064, REQ-040, TS-010, TS-016, DES-042
  - Uses API: `listAdminProcessSteps`, `createAdminProcessStep`, `getAdminProcessStep`, `updateAdminProcessStep`,
    `deleteAdminProcessStep`, `reorderAdminProcessSteps`
  - Behaviour: same generic component as UI-053; hint "The site shows these as a staircase in this order."
  - States: as UI-049.
  - Done when: UI-T-098 passes.

- UI-055 [IMPLEMENTED 2026-10-30 18:36] Profile `/admin/profile`
  - Implements: REQ-065, REQ-014, REQ-040, TS-011, TS-013, TS-016, DES-042
  - Uses API: `getAdminProfile`, `updateAdminProfile`
  - Behaviour: fields name, headline (≤ 160), bio paragraphs (`StringListInput` of textareas, 1..6, each ≤ 1200; cannot
    remove the last, cannot add a seventh), skills and tools (≤ 30 items, ≤ 60 chars), years of experience (0..60 or
    empty), origin statement (≤ 600), exactly two vision blocks (heading ≤ 80, body ≤ 600; fixed, not add/remove),
    portrait (`MediaField` + alt).
  - States: loading, error + Retry, validation, saving, saved, dirty guard.
  - Done when: UI-T-099 passes.

- UI-056 [IMPLEMENTED 2026-10-30 18:36] (definition updated 2026-10-30 05:08, CHG-005) Site settings `/admin/settings`
  - Implements: REQ-065, REQ-002, REQ-004, REQ-042, TS-013, TS-016, DES-042
  - Uses API: `getAdminSettings`, `updateAdminSettings`
  - Behaviour: fields contact email, booking URL (hint "Leave empty or use # to send visitors to the Contact page";
    accepts empty, `#`, absolute http(s) URL ≤ 500), social links (≤ 8 rows of label ≤ 40 + http(s) URL; add/remove),
    footer sign-off (≤ 120), contact promise line (required, ≤ 200, plain text; hint "Shown under the heading on the
    Contact page"), footer rights line (required, ≤ 200, plain text; hint "Shown in the footer's bottom line"),
    notification email (optional; note "Stored only. Email notifications are not built yet.").
    Both new text fields show a character counter, are trimmed, and reject empty or whitespace-only input (CHG-005).
    Invalid email/URL or invalid text field → field errors and nothing sent; server 422 `fields.contact_promise` /
    `fields.footer_rights_line` mapped onto those fields.
  - States: loading, error + Retry, validation, saving, saved, dirty guard.
  - Done when: UI-T-100, UI-T-125 and E2E UI-T-122, UI-T-126 pass.

- UI-057 [IMPLEMENTED 2026-10-30 18:36] Enquiries list `/admin/enquiries`
  - Implements: REQ-066, REQ-NFR-005, TS-014, TS-016, DES-042
  - Uses API: `listAdminEnquiries` (`status`, `page`, `page_size`)
  - Behaviour: status filter as tabs/segmented links All / New / Replied / Archived synced to `?status=` (and `?page=`);
    `DataTable` newest first: received date, name, email, company, enquiry type label, `StatusChip`; row links to the
    detail; pagination ("Page 2 of 3", previous/next); total count. Enquiry fields are rendered as text only.
  - States: loading, empty ("No enquiries yet"), empty for filter ("No new enquiries" + "Show all"), error + Retry,
    success.
  - Done when: UI-T-101 and E2E UI-T-119 pass.

- UI-058 [IMPLEMENTED 2026-10-30 18:36] Enquiry detail `/admin/enquiries/:id`
  - Implements: REQ-066, REQ-NFR-005, TS-014, TS-016, DES-042
  - Uses API: `getAdminEnquiry`, `updateAdminEnquiryStatus`, `deleteAdminEnquiry`
  - Behaviour: `h1` with the sender name; definition list (email as `mailto:` "Reply by email", company, type, budget
    label, received at); message as plain text preserving line breaks (never HTML); status control (radio group New /
    Replied / Archived, saves on change via PATCH, toast); "Delete" with confirmation then back to the list. Status
    changes invalidate the enquiries list and dashboard queries (new count).
  - States: loading, not found, error, status saving, status error (control reverts), deleted.
  - Done when: UI-T-102 and E2E UI-T-119 pass.

## 2. Screens and navigation
| Screen | Route | Roles allowed | Item | Notes |
|--------|-------|---------------|------|-------|
| Home | `/` | Visitor | UI-022..026 | Pre-rendered; hero `h1` |
| Work | `/work` | Visitor | UI-027 | Pre-rendered |
| Case study | `/work/:slug` | Visitor | UI-028 | One file per published slug; unknown → 404 |
| Writing | `/writing` (`?format=`) | Visitor | UI-029 | Filter applied after hydration |
| Writing sample | `/writing/:slug` | Visitor | UI-030 | One file per published slug |
| About | `/about` | Visitor | UI-031 | Staircase process |
| FAQs | `/faqs` | Visitor | UI-032 | Footer and mobile-menu link |
| Contact | `/contact` | Visitor | UI-033 | Only runtime API call (`createEnquiry`) |
| Not found | `*` / `404.html` | Visitor | UI-034 | `noindex`, status 404 on preview server |
| Login | `/admin/login` | Anyone (redirects if logged in) | UI-036 | `noindex` |
| Dashboard | `/admin` | Admin | UI-038 | Rebuild notice, new enquiries |
| Case studies | `/admin/case-studies`, `/new`, `/:id` | Admin | UI-043..046 | Tabs details/results/gallery |
| Writing samples | `/admin/writing`, `/new`, `/:id` | Admin | UI-047, UI-048 | |
| Services | `/admin/services` | Admin | UI-049 | List + side panel |
| Engagement models | `/admin/engagement-models` | Admin | UI-050 | List + side panel |
| Testimonials | `/admin/testimonials` | Admin | UI-051 | List + side panel |
| FAQs | `/admin/faqs` | Admin | UI-052 | Categories with nested FAQs |
| Values | `/admin/values` | Admin | UI-053 | List + side panel |
| Process steps | `/admin/process-steps` | Admin | UI-054 | List + side panel |
| Profile | `/admin/profile` | Admin | UI-055 | Singleton form |
| Settings | `/admin/settings` | Admin | UI-056 | Singleton form |
| Enquiries | `/admin/enquiries` (`?status=&page=`), `/:id` | Admin | UI-057, UI-058 | |

Public navigation: header (Work, Writing, About, Contact, Book a call), mobile menu (adds Home and FAQs), footer quick
links (Work, Writing, About, Contact, FAQs). Admin navigation: sidebar (UI-037). Media management has no route; it lives
in the media picker (UI-042). Route guards are UX only; the backend enforces authorisation (TS-008).

## 3. Design system and UX rules

### 3.1 Tokens and theming
- Single source: `src/styles/tokens.css` exactly as design-brief section 6 (UI-001). Components read section-surface
  aliases (`--surface`, `--on-surface`, `--on-surface-muted`, `--accent-on-surface`, `--border`, `--focus-color`), so the
  same component works on dark and cream sections.
- Colour rules (DES-013): green `#70FF00` only as fill or as text/icon on dark surfaces; on cream/white use
  `--color-primary-text-on-light`; text on green is always `--color-on-primary`; muted text uses the surface-specific muted
  token. Admin (DES-042): green only for fills (primary buttons, active nav marker); links in
  `--color-primary-text-on-light`.
- Typography (DES-020/021): display font for headings, buttons, nav, labels, chips, wordmark; body font elsewhere and
  throughout the admin except headings. Type sizes only from `--text-*` tokens.
- Flat: no shadows; radii `--radius-0` for buttons/inputs, `--radius-1` for cards/images/chips, `--radius-full` for dots.
- Component library: our own small set in `src/shared/ui` (no third-party UI kit), consistent with the profile and the
  minimal-dependency decision of SD-003.

### 3.2 Responsive rules (REQ-NFR-001, DES-040)
| Breakpoint | Width | Public layout | Admin layout |
|-----------|-------|---------------|--------------|
| Mobile | < 810 px (verified from 360 px) | One column; Menu button + full-screen menu; hero stacks; card/FAQ/service grids 1 column; gallery halves stack; staircase stacked; footer stacked | Top bar + drawer; tables as stacked cards; side panel as full-screen sheet; Markdown Write/Preview tabs |
| Tablet | 810-1199 px | Inline nav; 2-column cards and FAQs; services 2 columns; engagement 2 + 1; staircase as 2 × 2 grid; gutters `--space-7` | Sidebar visible (collapsible); tables; panel overlays; Markdown tabs |
| Desktop | ≥ 1200 px | Full layouts; 3-column services/engagement; staircase diagonal; containers `--container-max` / `--container-wide` | Sidebar + content; side panel docked; Markdown side by side |
- No horizontal page scroll at any width from 360 px to 1920 px; wide content (filter chips, tables in prose) scrolls
  inside its own container.
- Touch targets ≥ 44 × 44 px for all interactive controls (buttons are 48 px).
- Images: `sizes` matches the rendered column width at each breakpoint (REQ-NFR-004).
- Breakpoints are used only through the custom media in `media.css` (no ad-hoc pixel media queries).

### 3.3 Accessibility rules (REQ-NFR-002)
Target: **WCAG 2.1 AA** (required). Additionally adopted from 2.2 AA because they are cheap here: 2.4.11 Focus Not Obscured
(`scroll-padding-top` for the fixed header), 2.5.8 Target Size (44 px used), 3.3.8 Accessible Authentication (paste and
password managers allowed on login).
1. Landmarks: `header`, `nav` (labelled), `main#main`, `footer`; skip link first in the tab order.
2. Exactly one `h1` per page; heading levels never skip.
3. All contrast pairs from design-brief section 2; never green text/icons on cream or white; non-text UI (input borders,
   focus ring, chips) ≥ 3:1.
4. Visible focus on every interactive element (`:focus-visible`, 2 px outline, surface-aware colour); never removed.
5. Keyboard: menu (dialog, focus trap, Escape), accordions (native buttons, `aria-expanded`/`aria-controls`), carousel
   (buttons, polite live region, no autoplay), filter chips (links, `aria-current`), reorder (Move up/down buttons),
   dialogs (focus trap, return focus to the trigger).
6. Forms: visible labels, required fields marked in text, errors as text linked with `aria-describedby`,
   `aria-invalid`, focus to the first invalid field on submit, status/alert regions for form-level results.
7. Images: meaningful `alt` from the API (admin requires alt); decorative shapes `aria-hidden` and CSS-only.
8. Motion: everything off under `prefers-reduced-motion: reduce` (UI-003); no content depends on animation.
9. Route changes announce the new page (document title + focus to `main`/`h1`).
10. State never conveyed by colour alone (chips and badges carry text).
11. Language `en` on `<html>`; dates as `<time datetime>`.

### 3.4 UX copy
Static public copy (hero statements, section headings, CTA bands, empty states, privacy note, page meta) is original and
lives in `src/features/public/content/copy.ts` (tech-spec open question 4). Enum labels (formats, enquiry types, budget
ranges, statuses) live in `src/shared/utils/labels.ts` and are shared by public and admin. Tone per DES-003.

## 4. Coding standards
- Folder structure per TS-001: `src/app` (routes, providers, content source), `src/features/public/<page>`,
  `src/features/admin/<area>`, `src/shared/{ui,hooks,utils}`, `src/api` (generated), `src/styles`, `e2e/`.
  One component per folder with `Component.tsx`, `Component.module.css`, `Component.test.tsx`.
- TypeScript strict, no `any`, function components and hooks only; Rules of Hooks enforced by ESLint
  (`eslint-plugin-react-hooks`, `jsx-a11y`).
- Data: public pages read only loader data (no TanStack Query in the public bundle); admin uses TanStack Query (query keys
  `["admin", <type>, …]`, invalidation after every mutation, including `["admin","dashboard"]` after content changes).
  No server state copied into `useState`; avoid effects for derived values.
- API: only through the generated `openapi-fetch` client (`src/api/client.ts`) regenerated from
  `docs/api-contract.yaml` with `openapi-typescript`; no `fetch` in components; the static content source is the only
  other network code (fetching `/data/<key>.json`).
- Forms: React Hook Form + one Zod schema per form, types inferred from the schema; limits copied from the contract.
- Styling: CSS Modules + tokens only; no inline `style` props or attributes (CSP `style-src 'self'`, TS-003); class
  toggles and `data-*` attributes for state.
- Routing: React Router data routers; admin routes `lazy`; `errorElement` on every route.
- Naming: components `PascalCase`, hooks `useXxx`, files match the export, CSS classes camelCase in modules, test IDs not
  used (tests query by role/label).
- Validation commands (profile): `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test -- --run --coverage`,
  `npm run build:site` (needs the backend), `npm audit --audit-level=high`, `npx playwright test` (Lighthouse journey needs `LIGHTHOUSE_BIN`, see `frontend/e2e/README.txt`; CHG-008).

## 5. Code review guidelines
- UI-REV-001 [NEW 2026-10-29 16:06] No hard-coded colours, fonts or spacing outside the design tokens: component CSS
  uses only `var(--…)` tokens (no hex/rgb/hsl, no font-family names, no px/rem spacing literals other than `0`); new
  token-like values are added only to `tokens.css` and are traceable to a DES item. The style-check script (UI-T-002)
  passes.
- UI-REV-002 [NEW 2026-10-29 16:06] Green `--color-primary` is never used as text or icon colour on cream or white
  surfaces; components read surface aliases rather than raw colour tokens where the surface can vary (DES-013).
- UI-REV-003 [NEW 2026-10-29 16:06] No `fetch` in components; all API access goes through the generated client; the
  generated `src/api` files are untouched; public pages use no API at runtime except `createEnquiry`.
- UI-REV-004 [NEW 2026-10-29 16:06] `dangerouslySetInnerHTML` appears only in `SanitizedHtml`, which accepts only the
  branded API HTML type; enquiry and other user text is rendered as text.
- UI-REV-005 [NEW 2026-10-29 16:06] No inline `style` props/attributes and no inline scripts (CSP); hydration data only as
  `type="application/json"` with escaping.
- UI-REV-006 [NEW 2026-10-29 16:06] Every screen implements the states listed for its UI item (loading, empty, error,
  success, session-expired/not-found where listed).
- UI-REV-007 [NEW 2026-10-29 16:06] Hydration safety: no `Date.now()`, `new Date()` without input, `Math.random()`,
  `window`, `localStorage` or `matchMedia` reads during render of public routes; IDs from `useId`.
- UI-REV-008 [NEW 2026-10-29 16:06] Accessibility rules of section 3.3 are met: one `h1`, labelled controls, ARIA
  patterns as specified (menu dialog, accordion, carousel, tabs, alertdialog), visible focus, focus management after
  navigation, submit and dialog close.
- UI-REV-009 [NEW 2026-10-29 16:06] All animations/transitions are inside `@media (prefers-reduced-motion:
  no-preference)`; reveal start states are applied only after hydration.
- UI-REV-010 [NEW 2026-10-29 16:06] Images use `ResponsiveImage` with `width`/`height`, `alt`, `sizes`; only the LCP image
  is eager/high priority.
- UI-REV-011 [NEW 2026-10-29 16:06] External links (`booking_url`, social links, "View site") use `target="_blank"
  rel="noopener noreferrer"`; `booking_url` is used only when it is an absolute http(s) URL.
- UI-REV-012 [NEW 2026-10-29 16:06] No text, image, logo, font or code from the reference site; static copy lives in
  `copy.ts`; brand mark only through `Wordmark` (logos from `assets/brand/`, unmodified).
- UI-REV-013 [NEW 2026-10-29 16:06] Form schemas mirror the contract input schemas (required fields, lengths, enums,
  patterns); server `fields` are mapped to form fields; the first error is focused.
- UI-REV-014 [NEW 2026-10-29 16:06] Nothing is stored in `localStorage`/`sessionStorage`; the CSRF token is held in memory
  only; the login `next` parameter is validated as a same-origin `/admin` path.
- UI-REV-015 [NEW 2026-10-29 16:06] The admin code is in lazy route chunks; the public build output for `/` loads no admin
  module, TanStack Query, React Hook Form or Markdown editor code (check the Vite manifest).
- UI-REV-016 [NEW 2026-10-29 16:06] Lists use stable ids as keys (never indexes for reorderable lists); reorder sends the
  full id list and rolls back on failure.
- UI-REV-017 [NEW 2026-10-29 16:06] Media queries use only the custom media from `media.css`; layouts have no horizontal
  overflow at 360 px.
- UI-REV-018 [NEW 2026-10-29 16:06] Destructive admin actions (delete content, media, enquiries; clear sample flags) go
  through `ConfirmDialog`.
- UI-REV-019 [NEW 2026-10-29 16:06] No enquiry data, credentials or tokens in `console.*` calls, error messages sent
  anywhere, or URLs (contact form is POST-only and disabled until hydration).
- UI-REV-020 [NEW 2026-10-29 16:06] Every `UI-T-*` scenario for the changed item exists as a test and passes; public route
  render tests cover head tags.
- Security items: see `security.md` sections 2 and 4 (`SEC-*`, `SEC-UI-*`). Security review items:
  - UI-REV-021 [NEW 2026-10-29 16:06] Output: all data rendered as JSX text; `SanitizedHtml` is the only HTML insertion
    point; no `innerHTML`/`eval`-style APIs (ESLint rules on); media shown only via `<img>` with root-relative `/media/`
    URLs (SEC-UI-001, SEC-UI-009).
  - UI-REV-022 [NEW 2026-10-29 16:06] Pre-render and CSP: `__ROUTER_DATA__` escaped JSON block,
    `StaticRouterProvider hydrate={false}`, escaped head tags and sitemap, no inline scripts/handlers/styles in `dist`,
    `assetsInlineLimit: 0` (SEC-UI-002, SEC-UI-003, SEC-010).
  - UI-REV-023 [NEW 2026-10-29 16:06] URLs: booking and social links only for `http:`/`https:` with
    `rel="noopener noreferrer"`; login `next` limited to decoded same-origin `/admin` paths (SEC-UI-004, SEC-UI-005).
  - UI-REV-024 [NEW 2026-10-29 16:06] Session and personal data: no browser storage of tokens or enquiry data, cache
    cleared on 401/logout, honeypot as specified, contact form POST-only and disabled before hydration, enquiry text
    rendered as text (SEC-UI-006, SEC-UI-007, SEC-UI-008).
  - UI-REV-025 [NEW 2026-10-29 16:06] Supply chain and exposure: no third-party requests, only `VITE_SITE_URL` exposed,
    `npm audit --audit-level=high` clean, admin code lazy and `noindex`, Vite dev server on `localhost` with
    `fs.strict` (SEC-006, SEC-UI-010, SEC-UI-011, SEC-UI-012, SEC-001).

## 6. Unit and component test scenarios
Vitest + React Testing Library + MSW (handlers typed from the contract); jsdom; queries by role and label. Fixtures
mirror the seed shapes (6 case studies, 12 writing samples, 5 services, 3 engagement models, 5 testimonials, 16 FAQs in 4
categories with 6 in preview, 4 values, 4 steps).

| ID | Target | Scenario | Expected | Covers |
|----|--------|----------|----------|--------|
| UI-T-001 [NEW 2026-10-29 16:06] | `tokens.css` | Parse file and compare with the design-brief token list | Every DES token name defined once with the documented value | UI-001 |
| UI-T-002 [NEW 2026-10-29 16:06] | Style check script | Scan `src/**/*.module.css` and `global.css` | No hex/rgb/hsl, font-family literals, spacing px/rem literals (except `0`) or raw `@media (min-width…)`; script exits 0 | UI-001, UI-REV-001 |
| UI-T-003 [NEW 2026-10-29 16:06] | `Section` + `global.css` | Render each surface; parse alias rules | `data-surface` set; cream maps `--accent-on-surface` to `--color-primary-text-on-light`, dark to `--color-primary` | UI-001 |
| UI-T-004 [NEW 2026-10-29 16:06] | `entry-server.render("/")` | Render from fixtures | Status 200, one `h1`, head has title, description, canonical, og tags; hydration data present | UI-002, UI-004 |
| UI-T-005 [NEW 2026-10-29 16:06] | `entry-server.render("/work/unknown")` | Loader throws 404 | Status 404, not-found content, `noindex` meta | UI-002, UI-034 |
| UI-T-006 [NEW 2026-10-29 16:06] | `buildHead` for case study | Fixture case study | Unique title, summary as description, canonical without trailing slash, absolute `og:image`, `og:type=article` | UI-004 |
| UI-T-007 [NEW 2026-10-29 16:06] | Hydration | Server-render `/`, `/writing?format=email`, `/contact`, then `hydrateRoot` with the same data | No hydration mismatch errors logged | UI-002, UI-029 |
| UI-T-008 [NEW 2026-10-29 16:06] | `prerender.ts` | MSW node API with 6 published + 1 unpublished case study, 12 samples | Writes route HTML and `data/*.json`, `404.html`, `admin/index.html` with noindex, sitemap with 6 static + 18 details and no `/admin` or unpublished slug, robots disallows `/admin`, `build-info.json` written last with `content_snapshot_at = generated_at` | UI-004 |
| UI-T-009 [NEW 2026-10-29 16:06] | `prerender.ts` | API unreachable / one route throws | Exit code ≠ 0, no `build-info.json` | UI-004 |
| UI-T-010 [NEW 2026-10-29 16:06] | Hydration data serializer | Data containing `</script>`, `&`, U+2028 | Escaped; JSON round-trips | UI-004 |
| UI-T-011 [NEW 2026-10-29 16:06] | Static content source | `/data/work.json` 200 / 404 / network error | Data returned / 404 Response thrown / error propagated to route boundary | UI-002 |
| UI-T-012 [NEW 2026-10-29 16:06] | Route error page | Loader throws 500 | Friendly message, Home link, header and footer present | UI-002, UI-034 |
| UI-T-013 [NEW 2026-10-29 16:06] | Navigation indicator | Navigation pending > 150 ms | Progress bar shown, `main` has `aria-busy="true"`; hidden after load | UI-002 |
| UI-T-014 [NEW 2026-10-29 16:06] | `Reveal` | `matchMedia(reduce)` true; IntersectionObserver missing; before hydration | Content visible in all three cases; reveal class only when motion allowed after hydration | UI-003 |
| UI-T-015 [NEW 2026-10-29 16:06] | CSS motion check | Scan stylesheets | Every `animation`/`transition` is inside `prefers-reduced-motion: no-preference` | UI-003, UI-REV-009 |
| UI-T-016 [NEW 2026-10-29 16:06] | `Wordmark` | Render as link on dark and cream | Text "MITALI", accessible name "Mitali, home", surface-specific class | UI-005 |
| UI-T-017 [NEW 2026-10-29 16:06] | `Button`/`ButtonLink` | Variants, loading, external href | Correct classes; loading → disabled + `aria-busy`; external → `target`/`rel` + "(opens in a new tab)" | UI-006 |
| UI-T-018 [NEW 2026-10-29 16:06] | `BookCallLink` | `booking_url` = https URL, null, "", "#", "javascript:alert(1)", "ftp://x" | Only the https URL opens externally in a new tab; others link to `/contact` | UI-006 |
| UI-T-019 [NEW 2026-10-29 16:06] | `SectionHeading` | level 1/2, with action | Correct heading element; tape not in accessibility tree; action link rendered | UI-007 |
| UI-T-020 [NEW 2026-10-29 16:06] | `TapeDivider` | side left/right | `aria-hidden="true"`, side class | UI-008 |
| UI-T-021 [NEW 2026-10-29 16:06] | `Chip`/`FilterChip`/`StatusChip` | Active filter; statuses | Active has `aria-current`; status chips show text labels | UI-009 |
| UI-T-022 [NEW 2026-10-29 16:06] | Cards | Case-study and writing fixtures (one sample) | Single link to the detail URL, chip label, summary, image alt; writing card shows "Sample" only when flagged | UI-010, UI-015 |
| UI-T-023 [NEW 2026-10-29 16:06] | `Accordion` | Click, Enter, Space | Initially collapsed (`aria-expanded=false`, panel hidden); toggles; `aria-controls` = region id; region labelled by button | UI-011 |
| UI-T-024 [NEW 2026-10-29 16:06] | `Accordion` | Open two items; server vs client render | Both stay open; ids identical between server and client render | UI-011 |
| UI-T-025 [NEW 2026-10-29 16:06] | `Carousel` | Next on last, previous on first (5 slides) | Wraps to first / last | UI-012 |
| UI-T-026 [NEW 2026-10-29 16:06] | `Carousel` | Keyboard Enter/Space on Next | Slide changes; live region contains the new quote and author | UI-012 |
| UI-T-027 [NEW 2026-10-29 16:06] | `Carousel` | Click indicator 3; advance fake timers 60 s | Slide 3 active with `aria-current`; no automatic change | UI-012 |
| UI-T-028 [NEW 2026-10-29 16:06] | `Carousel` | Pointer swipe left 60 px; 1 slide; 0 slides | Next slide; no controls; nothing rendered | UI-012 |
| UI-T-029 [NEW 2026-10-29 16:06] | `ResponsiveImage` | Raster ref, SVG ref, priority, missing ref, load error | `srcset`/`sizes`/`width`/`height`/`alt`; lazy by default; priority eager + `fetchpriority=high`; fallback block for missing/error | UI-013 |
| UI-T-030 [NEW 2026-10-29 16:06] | `SanitizedHtml` | Branded HTML with `h2`, list, link; type test with plain string; repo grep | Markup rendered in `.prose`; plain string fails type-check (`expectTypeOf`); `dangerouslySetInnerHTML` found only in this file | UI-014, UI-REV-004 |
| UI-T-031 [NEW 2026-10-29 16:06] | `SampleDataNote` | flag true / false | "Sample data" text shown / nothing rendered | UI-015 |
| UI-T-032 [NEW 2026-10-29 16:06] | `CtaBand` | Booking URL set / empty | `h2` statement; Book a call external / to `/contact`; Contact link | UI-016 |
| UI-T-033 [NEW 2026-10-29 16:06] | `FaqPreview` | 6 preview FAQs; 0 FAQs | 6 collapsed items in order + link to `/faqs`; nothing rendered | UI-017 |
| UI-T-034 [NEW 2026-10-29 16:06] | `StoryBlock` | Portrait + 3 paragraphs; no portrait | Portrait with alt and 3 paragraphs; fallback block with paragraphs | UI-018 |
| UI-T-035 [NEW 2026-10-29 16:06] | `Header` | Routes `/work`, `/work/slug`, `/writing` | Links Work, Writing, About, Contact; correct one has `aria-current="page"`; Book a call present | UI-019 |
| UI-T-036 [NEW 2026-10-29 16:06] | `Header` | Mock IntersectionObserver: sentinel leaves / re-enters | `data-compact` added / removed | UI-019 |
| UI-T-037 [NEW 2026-10-29 16:06] | Mobile menu | Narrow viewport; open, Tab cycling, Escape | Dialog opens, focus inside and trapped, Escape closes and focus returns to Menu button, `aria-expanded` updates | UI-020 |
| UI-T-038 [NEW 2026-10-29 16:06] | Mobile menu | Activate "Writing"; route change; resize ≥ 810 | Navigates and closes; closes on route change and on resize; background inert while open | UI-020 |
| UI-T-039 [NEW 2026-10-29 16:06] | `Footer` | Settings with 2 social links, `generated_at` 2026 | 5 quick links; social links with `target`/`rel`; `mailto:` email; year 2026; sign-off | UI-021 |
| UI-T-040 [NEW 2026-10-29 16:06] | `Footer` | No social links | Social group omitted, no empty list | UI-021 |
| UI-T-041 [NEW 2026-10-29 16:06] | Home | Render with fixtures | Exactly one `h1` (hero); Book a call and View work actions; sections in the specified order | UI-022 |
| UI-T-042 [NEW 2026-10-29 16:06] | `home` aggregate + featured section | API returns 5 featured; returns 0 | 4 cards in position order + View all link; section hidden | UI-023 |
| UI-T-043 [NEW 2026-10-29 16:06] | Services section | 5 services; expand one | 5 rows; expanded shows description and deliverables list | UI-024 |
| UI-T-044 [NEW 2026-10-29 16:06] | Engagement section | 3 models (`booking`, `contact` targets) | 3 cards in order with feature lists; actions link per target with `cta_label` | UI-025 |
| UI-T-045 [NEW 2026-10-29 16:06] | Testimonials section | Testimonial with and without `case_study_slug` | Carousel rendered; case-study link only where slug exists | UI-026 |
| UI-T-046 [NEW 2026-10-29 16:06] | Work page | 6 case studies; 0 | 6 cards in order + FAQ preview; empty message with Contact link | UI-027 |
| UI-T-047 [NEW 2026-10-29 16:06] | Case-study details | Fixture | `h1` title, chip, `dl` rows Client, Year, Industry, Timeline, Campaign type, Channels | UI-028 |
| UI-T-048 [NEW 2026-10-29 16:06] | Case-study results | 3 results (one with change, one sample); case study `is_sample`; 0 results | Each label/value, change when present; "Sample data" note; "Sample case study" note; row hidden | UI-028, UI-015 |
| UI-T-049 [NEW 2026-10-29 16:06] | Gallery + more work | Layouts full, half, half; `more_work` 2 / 0 | Tile classes in order with alt/captions; 2 cards + View all link; strip hidden | UI-028 |
| UI-T-050 [NEW 2026-10-29 16:06] | Writing page (server) | Render `/writing?format=email` on the server | All 12 samples listed, "All" current | UI-029 |
| UI-T-051 [NEW 2026-10-29 16:06] | Writing page (client) | Hydrate with `?format=email` | Only email samples; Email chip `aria-current`; live region count | UI-029 |
| UI-T-052 [NEW 2026-10-29 16:06] | Writing filter | Click "Social" chip | URL `?format=social`; list filtered; no loader refetch | UI-029 |
| UI-T-053 [NEW 2026-10-29 16:06] | Writing filter | Format with no samples | Empty state with "Show all" link to `/writing` | UI-029 |
| UI-T-054 [NEW 2026-10-29 16:06] | Writing filter | `?format=poetry` | All samples, "All" current, no error | UI-029 |
| UI-T-055 [NEW 2026-10-29 16:06] | Writing-sample page | Fixture with body HTML, tags, sample flag | `h1`, format, client, date in `<time>` (UTC, no off-by-one), "N min read", tags, "Sample" note, body via `SanitizedHtml` | UI-030 |
| UI-T-056 [NEW 2026-10-29 16:06] | About page | 4 values, 4 steps | Values in order; steps in an `<ol>` in DOM order 1-4 with staircase classes | UI-031 |
| UI-T-057 [NEW 2026-10-29 16:06] | About page | Fixture profile | One `h1`; origin statement; 2 vision blocks; StoryBlock, FaqPreview, CtaBand present | UI-031 |
| UI-T-058 [NEW 2026-10-29 16:06] | FAQs page | 4 categories, 16 FAQs | 4 `h2` groups in order with FAQs in order; accordions collapsed | UI-032 |
| UI-T-059 [NEW 2026-10-29 16:06] | FAQs page | 0 groups | Empty message + CTA band | UI-032 |
| UI-T-060 [NEW 2026-10-29 16:06] (definition updated 2026-10-30 05:08, CHG-005) | Contact form | Submit empty (enquiry type left on "Choose one…") | Errors on Name, Email, Enquiry type ("Choose what your enquiry is about.") and Message; focus on Name; no request sent | UI-033 |
| UI-T-061 [NEW 2026-10-29 16:06] | Contact form | Malformed email; 5001-char message; whitespace-only name | Field errors; nothing sent | UI-033 |
| UI-T-062 [NEW 2026-10-29 16:06] | Contact form | Valid input → 201 | Request body matches `EnquiryCreate` (trimmed, `website` empty); confirmation replaces form and receives focus | UI-033 |
| UI-T-063 [NEW 2026-10-29 16:06] | Contact form | 422 with `fields.email` | Error shown on Email, focus there, input kept | UI-033 |
| UI-T-064 [NEW 2026-10-29 16:06] | Contact form | 429 `rate_limited` | Alert "try again later", all input kept | UI-033 |
| UI-T-065 [NEW 2026-10-29 16:06] | Contact form | 500, then network error, then retry 201 | Error banner with contact email, input kept; retry succeeds | UI-033 |
| UI-T-066 [NEW 2026-10-29 16:06] | Contact form | Double-click submit with delayed response | One request; button loading and disabled | UI-033 |
| UI-T-067 [NEW 2026-10-29 16:06] | Contact form | Server render; honeypot attributes | Submit disabled before hydration, `<noscript>` email line, `method="post"`; honeypot `tabindex=-1`, `aria-hidden`, `autocomplete=off` | UI-033 |
| UI-T-068 [NEW 2026-10-29 16:06] (definition updated 2026-10-30 05:08, CHG-005) | Contact form | Selects | Enquiry type has 7 options: the "Choose one…" placeholder (`value=""`, selected initially) followed by the 6 enquiry types, and is marked required; budget optional with 6 options and no currency symbol; labels linked to fields | UI-033 |
| UI-T-069 [NEW 2026-10-29 16:06] | Not-found page | Render `*` | `h1`, Back to home link, `noindex`, title "Page not found — Mitali" | UI-034 |
| UI-T-070 [NEW 2026-10-29 16:06] | Admin client middleware | GET, PUT; 401; 403 `csrf_failed` twice | CSRF header only on non-GET; 401 clears cache and redirects with `next`; 403 → `getAdminMe` + one retry, second failure surfaced | UI-035 |
| UI-T-071 [NEW 2026-10-29 16:06] | Session storage | Spy on `localStorage`/`sessionStorage` during login, navigation, logout | No writes | UI-035, UI-036 |
| UI-T-072 [NEW 2026-10-29 16:06] | Login | Empty submit; valid login with `next=/admin/enquiries` | Field errors; on 200 navigates to `/admin/enquiries` | UI-036 |
| UI-T-073 [NEW 2026-10-29 16:06] | Login | 401; 429 | Generic "Email or password is incorrect." with password cleared and focused; "Too many attempts…" message | UI-036 |
| UI-T-074 [NEW 2026-10-29 16:06] | Login redirect | `next` = `//evil.example`, `https://evil.example`, `/\evil`, `/work` | Navigates to `/admin` in every case | UI-036, UI-REV-014 |
| UI-T-075 [NEW 2026-10-29 16:06] | Admin layout | `getAdminMe` 401; 200 with 3 new enquiries | Redirect to login with `next`; sidebar links, active `aria-current`, badge "3 new" | UI-037 |
| UI-T-076 [NEW 2026-10-29 16:06] | Logout | `adminLogout` 204; 500 | Both: cache cleared and navigation to login | UI-037 |
| UI-T-077 [NEW 2026-10-29 16:06] | Dashboard | `needs_rebuild` true; false; `last_build` null; clipboard rejects | Notice with command and Copy button (success message); up-to-date text with build time; never-built notice; fallback "Press Ctrl+C" with text selected | UI-038 |
| UI-T-078 [NEW 2026-10-29 16:06] | Dashboard | Loading; 500; success | Skeleton; error + Retry refetches; new-enquiry link to `?status=new`; counts table | UI-038 |
| UI-T-079 [NEW 2026-10-29 16:06] | `ReorderableList` | Move item 2 down; first item | Order updated, full id list sent, live region announcement, focus kept; first "Move up" disabled | UI-039 |
| UI-T-080 [NEW 2026-10-29 16:06] | `ReorderableList` | Reorder 500; 422 `order_mismatch` | Rollback + error toast; refetch + "list changed" message | UI-039 |
| UI-T-081 [NEW 2026-10-29 16:06] | Form kit | 422 `fields` (`results.0.value`), 409 `slug_taken`, unknown code; dirty form navigation | Mapped field errors with focus; slug field error; form alert; leave-confirmation prompt | UI-040 |
| UI-T-082 [NEW 2026-10-29 16:06] | `ConfirmDialog` | Open, Tab, Escape, Confirm | Focus trapped; Escape cancels without calling delete; Confirm calls it once; focus returns to trigger | UI-040 |
| UI-T-083 [NEW 2026-10-29 16:06] | Markdown editor | Type quickly; slow first response then fast second; 500; 100 001 chars | One request per 400 ms pause; latest response shown; error message, text kept; limit error | UI-041 |
| UI-T-084 [NEW 2026-10-29 16:06] | Media upload | `.gif`; 11 MB file; server 413/415/422; success | Client messages without request; server messages shown; success selects asset and shows thumbnail | UI-042 |
| UI-T-085 [NEW 2026-10-29 16:06] | Media library | 30 assets (2 pages); delete in-use (409); delete unused | Load more appends; select returns asset; in-use message; unused removed after confirm | UI-042 |
| UI-T-086 [NEW 2026-10-29 16:06] | `MediaField` | Image selected, alt empty, submit | Alt required error; nothing sent | UI-042, UI-044 |
| UI-T-087 [NEW 2026-10-29 16:06] | Case studies list | 6 rows; 0 rows; delete | Rows in order with chips; empty state with create; confirm text mentions results and gallery, then delete called | UI-043 |
| UI-T-088 [NEW 2026-10-29 16:06] | Case-study create | Type title "Spring Launch Plan"; edit slug; invalid slug "Bad Slug"; save | Slug suggested `spring-launch-plan`, stops following after manual edit; pattern error; on 201 navigates to `/:id` with tabs enabled | UI-044 |
| UI-T-089 [NEW 2026-10-29 16:06] | Case-study edit | 409 `slug_taken`; publish toggle; Clear sample flags with 2 flagged results | Slug field error; PUT body has `is_published`; one case-study PUT and 2 result PUTs, success toast | UI-044 |
| UI-T-090 [NEW 2026-10-29 16:06] | Results editor | Add with empty label; valid add; edit; delete; reorder | Field errors; create/update/delete/reorder operations called with the right ids | UI-045 |
| UI-T-091 [NEW 2026-10-29 16:06] | Gallery editor | Add image without alt; with alt; set half; reorder; delete | Save blocked with message; create called with `layout`; preview grid classes; reorder and delete called | UI-046 |
| UI-T-092 [NEW 2026-10-29 16:06] | Writing list | 12 rows; empty; delete | Format labels and chips; empty state; confirm + delete | UI-047 |
| UI-T-093 [NEW 2026-10-29 16:06] | Writing editor | Missing required fields; 6 formats; save; unknown id | Errors; select options; reading time from response shown; not-found state | UI-048 |
| UI-T-094 [NEW 2026-10-29 16:06] | Services | Create in panel with 2 deliverables; edit; delete | Panel form posts list; update; confirm delete; list refreshed | UI-049 |
| UI-T-095 [NEW 2026-10-29 16:06] | Engagement models | Set target "Contact page", label ≤ 40, features | PUT body has `cta_target: contact`; over-length label error | UI-050 |
| UI-T-096 [NEW 2026-10-29 16:06] | Testimonials | Select linked case study / None; 601-char quote | `case_study_id` set / null; length error | UI-051 |
| UI-T-097 [NEW 2026-10-29 16:06] | FAQs | Delete non-empty category (409); move FAQ to another category; toggle preview; reorder in category | Message shown and category stays; PUT with new `category_id`, FAQ appears at end of target; preview count updates; reorder body `{category_id, ids}` | UI-052 |
| UI-T-098 [NEW 2026-10-29 16:06] | Values / process steps | CRUD and reorder via the shared component | Correct operations per type; publish toggle sent | UI-053, UI-054 |
| UI-T-099 [NEW 2026-10-29 16:06] | Profile | Remove last bio paragraph; add 7th; 31 skills; portrait without alt; save | Prevented with messages; alt error; PUT body has exactly 2 vision blocks | UI-055 |
| UI-T-100 [NEW 2026-10-29 16:06] | Settings | Invalid email; `booking_url` "not a url"; "", "#", https URL; 9 social links | Field errors and no request for invalid; valid values accepted; add disabled at 8 | UI-056 |
| UI-T-101 [NEW 2026-10-29 16:06] | Enquiries list | Filter "New" (3 new, 1 archived); page 2; empty filter | URL `?status=new`, 3 rows newest first; pagination; "No new enquiries" + Show all | UI-057 |
| UI-T-102 [NEW 2026-10-29 16:06] | Enquiry detail | Message containing `<img src=x onerror=alert(1)>`; mark Replied; PATCH fails; delete; unknown id | Message shown as literal text; PATCH sent, chip updates, list and dashboard invalidated; control reverts with error; confirm then back to list; not-found state | UI-058 |
| UI-T-123 [NEW 2026-10-30 05:08] | `Footer` (CHG-005) | Settings with `footer_rights_line` "Fixture rights line <b>x</b>" | Bottom bar shows that exact text as literal text (no `b` element); the old static `copy.ts` rights string is not rendered | UI-021 |
| UI-T-124 [NEW 2026-10-30 05:08] | Contact page (CHG-005) | Settings with `contact_promise` "Fixture promise line" | Promise line under the `h1` shows that exact text as plain text; the old static `copy.ts` promise string is not rendered | UI-033 |
| UI-T-125 [NEW 2026-10-30 05:08] | Settings (CHG-005) | Contact promise and footer rights line each: emptied; whitespace only; 201 chars; 200 chars; server 422 `fields.footer_rights_line` | Field errors and no request for empty, blank and 201 chars; 200 chars sent (trimmed); counters show used of 200; server error shown on the footer rights line field with focus there | UI-056 |

### 6.1 E2E journeys (Playwright, for the tester)
Run against the production-like preview: backend with `SERVE_FRONTEND=true` on the seeded `mitali_portfolio_test`
database after `npm run build:site` (TS-019). Viewports 360, 390, 810 and 1440 px where stated; `@axe-core/playwright`
must report no serious or critical violations.

| ID | Journey | Expected | Covers |
|----|---------|----------|--------|
| UI-T-103 [NEW 2026-10-29 16:06] | Open `/`, `/work`, one case study, `/writing`, one sample, `/about`, `/contact`, `/faqs` at 360, 810, 1440 px | Header and footer on each; one `h1`; `document.scrollingElement.scrollWidth ≤ innerWidth`; axe clean; hero actions visible without scrolling at 1440×900 and 390×844 | UI-002, UI-019, UI-021, UI-022, UI-027..033 |
| UI-T-104 [NEW 2026-10-29 16:06] | Request `/does-not-exist` and the URL of a case study unpublished in the test DB | HTTP 404, not-found page with Back to home link | UI-034, UI-002 |
| UI-T-105 [NEW 2026-10-29 16:06] | JavaScript disabled: load `/work/<slug>` and `/writing?format=email` | Title, summary, `<title>`, description, canonical, `og:image` in HTML; all samples listed | UI-004, UI-029 |
| UI-T-106 [NEW 2026-10-29 16:06] | 390 px: open menu, Tab through, Escape; reopen and choose "About" | Focus inside, returns to Menu button; navigates to About and menu closed | UI-020 |
| UI-T-107 [NEW 2026-10-29 16:06] | 1440 px: scroll past the hero; activate Book a call (settings URL set, then cleared and rebuilt) | Header compact; new tab with settings URL; when cleared, link goes to `/contact` | UI-019, UI-006 |
| UI-T-108 [NEW 2026-10-29 16:06] | Writing: click Email, reload, Back | URL `?format=email`, only email cards; filter active after reload; Back restores All | UI-029 |
| UI-T-109 [NEW 2026-10-29 16:06] | Keyboard only: services accordion, FAQs accordion, testimonial carousel | Toggle with Enter/Space, `aria-expanded` correct; carousel wraps, no autoplay after 10 s | UI-011, UI-012, UI-024, UI-032 |
| UI-T-110 [NEW 2026-10-29 16:06] | Contact: submit empty, then valid; then log in to admin | Field errors with focus on Name; confirmation; enquiry listed in `/admin/enquiries?status=new` | UI-033, UI-057 |
| UI-T-111 [NEW 2026-10-29 16:06] | Contact: 6 valid submissions within the window | 6th shows the try-again-later message, input kept | UI-033 |
| UI-T-112 [NEW 2026-10-29 16:06] | `reducedMotion: "reduce"` on Home, open accordion, change slide | Hero glow `animation-name: none`; no transitions; reveal content visible immediately | UI-003 |
| UI-T-113 [NEW 2026-10-29 16:06] | `/admin/case-studies` without session; wrong password; correct login; logout; old URL again | Redirect to login; generic error; lands on case studies (`next`); after logout redirected to login | UI-036, UI-037, UI-035 |
| UI-T-114 [NEW 2026-10-29 16:06] | 5 wrong logins then the correct password | "Too many attempts" message; no dashboard | UI-036 |
| UI-T-115 [NEW 2026-10-29 16:06] | Edit a case-study title and move another case study up; dashboard; run `npm run build:site`; reload dashboard and `/work` | "Site needs rebuilding" with command; after rebuild notice gone, new title and order on the public site | UI-038, UI-039, UI-043, UI-044 |
| UI-T-116 [NEW 2026-10-29 16:06] | Gallery: upload a `.gif` (rejected), upload a PNG, try saving without alt, add alt, set half, reorder | Rejection message; save blocked until alt; tile saved; order persisted | UI-042, UI-046 |
| UI-T-117 [NEW 2026-10-29 16:06] | Unpublish a testimonial and rebuild; try deleting a non-empty FAQ category | Carousel shows one fewer slide; deletion refused with message | UI-051, UI-052 |
| UI-T-118 [NEW 2026-10-29 16:06] | Clear sample flags on a seeded case study, rebuild, open its page | No "Sample data" or "Sample case study" note | UI-044, UI-015, UI-028 |
| UI-T-119 [NEW 2026-10-29 16:06] | Enquiries: filter New, open one, mark Replied, back to dashboard | Filtered list; status chip Replied; dashboard new count decreased by 1 | UI-057, UI-058, UI-038 |
| UI-T-120 [NEW 2026-10-29 16:06] | Lighthouse 13 via the E2E harness (mobile) on 6 static pages + one case study + one writing sample | ≥ 0.9 Performance, Accessibility, Best Practices, SEO | UI-001, UI-002, UI-004, UI-013 |
| UI-T-121 [NEW 2026-10-29 16:06] | Fetch `/sitemap.xml`, `/robots.txt`, `/admin/login` HTML | Sitemap has static + published detail URLs only; robots disallows `/admin`; admin HTML has `noindex, nofollow` | UI-004 |
| UI-T-122 [NEW 2026-10-29 16:06] | Settings: save invalid booking URL (error), then valid social link; profile: edit a bio paragraph; rebuild | Field error and nothing saved; footer shows the link; StoryBlock shows the new paragraph | UI-055, UI-056, UI-021, UI-018 |
| UI-T-126 [NEW 2026-10-30 05:08] | (CHG-005) Fresh migrated + seeded DB: open `/contact` and check the footer; then in Settings clear the contact promise (error), set new promise and rights line texts, save; rebuild; reload `/contact` | Before: the initial texts of tech-spec section 3.2; empty value refused with a field error and nothing saved; after rebuild the Contact page and every footer show the new texts | UI-056, UI-033, UI-021 |

## 7. App: frontend-2 (design variant; CHG-012)
> Header entry: `{ stack: react, role: "design variant frontend-2 (public site + admin)", path: frontend-2 }`; profile `stack-react`.
> Items are tagged `App: frontend-2` (with `public`, `admin` or `shared` after a slash). Everything in sections 1-6 describes
> `frontend/` and stays unchanged. frontend-2 shows the **same screens with the same behaviour, states, API operations and SEO
> outputs** (REQ-080..REQ-097); only the visual and motion design differs (design-brief section 7, DES-050..DES-065, which replace
> DES-020/021/040 for this app; DES-001..003, DES-010 and the DES-013 colour rule still apply). Design tokens: DES-060 (semantic
> layer). Phase PH-2 is ACTIVE: UI-100..UI-115 are full items; UI-120..UI-145 (PH-3) and UI-150..UI-152 (PH-4) are outlines.
> No mock API: development reads the real backend on the dev database; E2E runs on the seeded test database (SD-117).
> The UI may call only operations in `api-contract.yaml` (unchanged; frontend-2 uses 91 of 92, tech-spec section 2).

### 7.1 Scope items, PH-2 (full)

- UI-100 [IN-PROGRESS 2026-10-31 03:01] @PH-2 frontend-2 app scaffold, tooling and generated API client
  - App: frontend-2/shared
  - Implements: REQ-080, REQ-081, REQ-NFR-013, TS-020, TS-033
  - Uses API: none directly; generates `src/api/schema.d.ts` from `docs/api-contract.yaml` (all 92 operations typed; 91 used)
  - Files: `frontend-2/package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `index.html`, `.env.example`,
    `src/api/{schema.d.ts,client.ts,types.ts}`, `src/shared/{utils,zod}/` (copied and owned), `src/test/setup.ts`, root `.gitignore`
    lines (TS-020)
  - Behaviour: same pinned majors and scripts as TS-020; ESLint rules of `frontend/` plus `no-restricted-imports` for any path into
    `frontend/`; `generate:api` is the only reader of a file outside `frontend-2/`; jitless zod wrappers copied (CSP).
  - States: n/a.
  - Done when: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test -- --run` pass in `frontend-2/` with `frontend/` untouched
    and not installed; UI-T-127 passes.

- UI-101 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Semantic token layer, fonts, global styles and surfaces
  - App: frontend-2/shared
  - Implements: REQ-083, REQ-NFR-012, REQ-082, REQ-NFR-002, TS-021, DES-050, DES-051, DES-055, DES-057, DES-059, DES-060, DES-061
  - Uses API: none
  - Files: `src/styles/{palette,semantic,surfaces,media,fonts,global}.css`, `src/shared/ui/Section/`, `scripts/copy-fonts.ts`,
    `scripts/check-styles.ts`, `public/fonts/*.woff2`, `public/fonts/LICENSES/*.txt`, `index.html` (font preload),
    `src/dev/review-switch.ts`
  - Behaviour: DES-060 contract exactly (raw `--p-*` → semantic roles → `[data-surface]` aliases); `Section` renders
    `<section data-surface="base|band|deep|deep-alt">`; fonts per TS-021 step 3 (Latin files only, `swap`, only Inter Tight 300
    preloaded, licence check); global styles per TS-021 step 4 (`scroll-padding-top`, focus ring per surface); dev-only
    `?base=white` switch for the P1 comparison (never in production).
  - States: base cream (default), base white (dev review only).
  - Done when: UI-T-128..UI-T-132 pass; fonts load from `/fonts/` with no external request (UI-T-152).

- UI-102 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Motion system (reveal, parallax band, collage drift, hovers)
  - App: frontend-2/public (admin uses only `--motion-dur-fast/base` state transitions)
  - Implements: REQ-084, REQ-NFR-009, REQ-NFR-003, TS-022, DES-054, DES-058
  - Uses API: none
  - Files: `src/shared/motion/{reveal.ts,index.ts}`, `src/shared/ui/{Reveal,MediaBand,Collage}/`, `src/styles/motion.css`,
    `scripts/check-motion-size.ts`, `src/entry-client.tsx` (calls `initMotion()` after hydration)
  - Behaviour: TS-022 steps 1-6. Reveal: opacity + translateY 50 → 0 px, 1.15 s `--motion-ease-out`, 0.15 s delay, at ~85 % of
    the viewport, once; hidden state only under `html[data-motion="on"]` and no-preference; content visible without JS, before
    hydration, in print and under reduced motion. Parallax band and collage drift with `animation-timeline: view()` inside
    `@supports`, static otherwise. One slide-in-from-left variant (`<Reveal variant="slide">`) used once per page at most.
    No smooth scrolling, no custom cursor, no motion library.
  - States: motion allowed (JS), reduced motion, no JS / before hydration, print, no IntersectionObserver, no scroll-timeline support.
  - Done when: UI-T-133..UI-T-135 and E2E UI-T-150 pass.

- UI-103 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Public route tree, root layout, content source and hydration
  - App: frontend-2/public
  - Implements: REQ-086, REQ-001, REQ-022, REQ-NFR-004, TS-026, DES-061
  - Uses API (dev and build time only, via the *api* content source): `getPublicSite`, `listPublicCaseStudies`,
    `getPublicCaseStudy`, `listPublicServices`, `listPublicEngagementModels`, `listPublicTestimonials`, `listPublicFaqPreview`
    (PH-2 keys `site`, `home`, `work/<slug>`); browser production: `/data/<key>.json` only (from PH-3)
  - Files: `src/app/{routes.tsx,content-source.ts,RootLayout.tsx}`, `src/entry-client.tsx`, `src/entry-server.tsx`,
    `src/features/public/seo/`, `src/features/public/content/copy.ts` (same wording as `frontend/`), `src/shared/hooks/useHydrated.ts`
  - Behaviour: as `frontend/` UI-002 (one route tree for server and client, `__ROUTER_DATA__`, `hydrateRoot`/`createRoot`, focus
    to `<main>` and title update after navigation, navigation progress bar after 150 ms with `aria-busy`, deterministic render).
    PH-2 routes: layout, `/`, `/work/:slug`, `*`; admin routes arrive lazily in PH-3. `handle.meta` → `buildHead` with the same
    titles/descriptions/canonical/OG rules as UI-004.
  - States: loading (progress bar), error (route error page, UI-115), not found (UI-115), success.
  - Done when: UI-T-146 passes (no hydration mismatch for `/` and `/work/<slug>`); UI-T-153 parity for these routes.

- UI-104 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Route view transitions (progressive; keep/drop at P1)
  - App: frontend-2/public
  - Implements: REQ-094, TS-024, DES-063
  - Uses API: none
  - Files: `src/shared/ui/AppLink/`, `src/app/RootLayout.tsx`, `src/styles/motion.css`
  - Behaviour: TS-024: internal links request a view transition; cross-fade 250 ms; header/footer named in CSS; instant under
    reduced motion and without browser support; focus, title and scroll handling unchanged.
  - States: supported + motion, reduced motion, unsupported.
  - Done when: UI-T-139 passes and the P1 review keeps the feature (otherwise the item is DEPRECATED with REQ-094).

- UI-105 [IN-PROGRESS 2026-10-31 03:01] @PH-2 `Header` (hide on scroll down, reveal on scroll up, compact, skip link)
  - App: frontend-2/public
  - Implements: REQ-085, REQ-002, REQ-003, REQ-082, REQ-NFR-002, TS-023, DES-056, DES-065
  - Uses API: none (`settings.booking_url` from `site`)
  - Files: `src/features/public/layout/Header/`, `src/shared/motion/scroll-direction.ts`, `src/shared/ui/{Wordmark,BookCallLink}/`
  - Behaviour: TS-023 steps 1-2: transparent at the top, compact (64 px, base surface + hairline) after scrolling past its height;
    `data-hidden` on scroll down, removed on scroll up; always visible with `:focus-within` and while the menu is open; skip link
    first; `scroll-padding-top` keeps focus targets visible; nav links with grow-bar hover and `aria-current`; "Menu" button below
    `--bp-md`.
  - States: top (transparent), compact, hidden, revealed, focus-within, menu open, reduced motion (no animation).
  - Done when: UI-T-136 and E2E UI-T-151 pass.

- UI-106 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Mobile menu (full screen, hairline rows)
  - App: frontend-2/public
  - Implements: REQ-003, REQ-085, REQ-NFR-002, REQ-NFR-003, TS-023, DES-053
  - Uses API: none
  - Files: `src/features/public/layout/MobileMenu/`
  - Behaviour: DES-053 menu row: dialog semantics, focus to first link and trapped, Esc/close returns focus to the Menu button,
    `inert` background, scroll lock via a class, closes on link choice, route change and at ≥ 768 px; slide 450 ms + backdrop
    500 ms (instant under reduced motion); rows ≥ 56 px with hairlines; "Book a call" full-width primary.
  - States: closed, opening, open, closing.
  - Done when: UI-T-137 and E2E UI-T-148 (menu-open state, axe) pass.

- UI-107 [IN-PROGRESS 2026-10-31 03:01] @PH-2 `Footer` (giant "let's talk" call-to-action, then link columns)
  - App: frontend-2/public
  - Implements: REQ-004, REQ-005, REQ-086, REQ-065, TS-023, DES-052, DES-057, DES-065
  - Uses API: `getPublicSite` (`settings.social_links`, `contact_email`, `footer_signoff`, `footer_rights_line`, `generated_at`)
  - Files: `src/features/public/layout/Footer/`
  - Behaviour: TS-023 step 4 on `--surface-deep`: giant two-line "let's talk" `ArrowLink` to `/contact` with a 4 px green underline,
    hairline, giant wordmark + `mailto:` email, hairline, link columns (quick links incl. FAQs; social links http(s) only with
    `target`/`rel`; contact), bottom bar with year of `generated_at`, sign-off and rights line as plain text. Links ≥ 44 px tall on
    touch layouts. Empty social links → group omitted.
  - States: with / without social links.
  - Done when: UI-T-138 passes.

- UI-108 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Primitives: `Wordmark`, `Button`/`ButtonLink`/`BookCallLink`, `ArrowLink`, `Chip`/`FilterChip`,
  `HairlineList`
  - App: frontend-2/shared
  - Implements: REQ-002, REQ-005, REQ-NFR-002, TS-023, TS-026, DES-052, DES-065
  - Uses API: none (`settings.booking_url`)
  - Files: `src/shared/ui/{Wordmark,Button,ArrowLink,Chip,HairlineList}/`
  - Behaviour: DES-052 (48 px buttons, 2 px radius, primary green fill + ink text, secondary 2 px border; arrow-swap on
    hover/focus; chips with text labels and `aria-current` when active); `BookCallLink` and external-link rules as `frontend/`
    UI-006 (http(s) only, new tab, "(opens in a new tab)"); `Wordmark` "MITALI" with accessible name "Mitali, home".
  - States: default, hover, focus-visible, active, disabled, loading (Button).
  - Done when: UI-T-142 passes.

- UI-109 [IN-PROGRESS 2026-10-31 03:01] @PH-2 `ResponsiveImage` (reserved boxes), `MediaBand`, `Collage`; loading polish @PH-3
  - App: frontend-2/shared
  - Phase split (G2): PH-2 = component, reserved width/height boxes, MediaBand, Collage; PH-3 = REQ-095 polish (placeholder frames, eager +
    high priority for the largest image).
  - Implements: REQ-095 (PH-3 part), REQ-084, REQ-NFR-004, REQ-NFR-011, TS-025, TS-022, DES-062
  - Uses API: `ImageRef` (`url`, `alt`, `width`, `height`, `mime`, `srcset[]`)
  - Files: `src/shared/ui/{ResponsiveImage,MediaBand,Collage}/`
  - Behaviour: TS-025: slot ratio classes, skeleton shimmer behind the image (static under reduced motion), `priority` → eager +
    `fetchpriority="high"`, others lazy; `/media/` root-relative URLs only, fallback block on missing/error; no inline styles.
  - States: loading (placeholder), loaded, error (fallback), missing.
  - Done when: UI-T-141 passes and E2E UI-T-150 measures CLS < 0.05.

- UI-110 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Content components: `Accordion`, `Carousel`, `FaqPreview`, `StoryBlock`, `SampleDataNote`,
  `SanitizedHtml`, `MetaRow`, `OffsetText`, `IntroSplit`
  - App: frontend-2/public
  - Implements: REQ-006, REQ-012, REQ-014, REQ-015, REQ-021, REQ-023, REQ-031, REQ-NFR-002, TS-026, DES-052, DES-061
  - Uses API: `listPublicFaqPreview` (via aggregates), `listPublicTestimonials`, `getPublicSite` (profile), `is_sample` flags,
    `problem_html`/`solution_html`
  - Files: `src/shared/ui/{Accordion,Carousel,FaqPreview,StoryBlock,SampleDataNote,SanitizedHtml,MetaRow,OffsetText,IntroSplit}/`
  - Behaviour: behaviour identical to `frontend/` UI-011, UI-012, UI-014, UI-015, UI-017, UI-018 (accordion `aria-expanded`/
    `aria-controls`, content in pre-rendered HTML; carousel no autoplay, wraps, polite live region, swipe; `SanitizedHtml` the only
    `dangerouslySetInnerHTML`); frontend-2 styling: hairline rows, display-300 headings, `MetaRow` as a `<dl>` in 4/2/1 columns,
    `OffsetText` at column 5 from `--bp-lg`.
  - States: per component as in `frontend/` (collapsed/expanded; single/multiple/none; sample/not sample).
  - Done when: UI-T-143 passes.

- UI-111 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Home page
  - App: frontend-2/public
  - Implements: REQ-086, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-006, REQ-082, TS-026, DES-051, DES-057, DES-061
  - Uses API: aggregate `home` (`listPublicCaseStudies?featured=true`, `listPublicServices`, `listPublicEngagementModels`,
    `listPublicTestimonials`, `listPublicFaqPreview`) + `site` (`getPublicSite`)
  - Behaviour: TS-026 Home section order and surfaces; one `h1` (`--text-display-xl`), both hero actions visible without scrolling
    at 1440×900 and 390×844; up to 4 featured units in position order with "View all work"; services accordion; 3 engagement
    units with `cta_target` actions; story; testimonial carousel; FAQ preview; reveals on blocks below the fold.
  - States: success; each data section hidden when empty; reduced motion.
  - Done when: UI-T-144 and E2E UI-T-148 pass.

- UI-112 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Case-study page `/work/:slug`
  - App: frontend-2/public
  - Implements: REQ-086, REQ-021, REQ-022, REQ-023, REQ-050, REQ-082, TS-026, TS-025, DES-052, DES-061, DES-062
  - Uses API: `getPublicCaseStudy` (key `work/<slug>`; results, images, `more_work`) + `site`
  - Behaviour: TS-026 case-study order: title block with chip and "Sample case study" note; cover as full-bleed parallax band
    (the LCP image, priority); `MetaRow` (Client, Year, Industry, Timeline, Campaign type, Channels); summary intro split; Problem
    and Solution offset blocks via `SanitizedHtml`; results on a deep band with "Sample data" note; gallery (full spans; halves side
    by side from 768 px, stacked below; optional collage drift); "More work" (2 units + "View all work") with the one slide-in
    heading; unknown/unpublished slug → not-found page.
  - States: success, not found, sections hidden when empty (no results, no gallery, no more work).
  - Done when: UI-T-145 and E2E UI-T-148 pass.

- UI-113 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Dev server configuration and the dev-only Origin rewrite
  - App: frontend-2/shared (tooling)
  - Implements: REQ-090, REQ-081, TS-027, SD-112, SEC-UI-014
  - Uses API: none directly (affects every `/api/admin/*` request through the dev server: `adminLogin`, `adminLogout`,
    `getAdminMe` in PH-2 checks; all admin operations from PH-3)
  - Files: `frontend-2/vite.config.ts`, `frontend-2/vite/dev-origin.ts` (+ test)
  - Behaviour: TS-027: port 5174 strict, `localhost` only, proxy `/api` and `/media` to `http://127.0.0.1:8000`; Origin rewritten
    to `http://127.0.0.1:8000` only for `/api/admin` paths and only when the incoming Origin is the 5174 dev origin; wired only for
    `command === "serve"` and not preview; never imported by `src/`. Does not touch `ALLOWED_ORIGINS` or any `.env`.
  - States: dev serve (rewrite active), preview/build (no rewrite).
  - Done when: UI-T-140 and E2E UI-T-149 pass.

- UI-114 [IN-PROGRESS 2026-10-31 06:36] @PH-2 Run kit entry `web2`
  - App: frontend-2 (tooling)
  - Implements: REQ-092, TS-028, SD-116
  - Uses API: none (`getHealth` is used by the kit for the `api` app only)
  - Files: `run/run.json` (one new object; `web` unchanged)
  - Behaviour: TS-028 entry (id `web2`, dir `frontend-2`, port 5174, `npm ci`, `npm run dev`, depends on `api`, opens
    `http://localhost:5174/`).
  - States: n/a.
  - Done when: UI-T-147 passes (`make-run-kit.ps1 -CheckOnly` 0 warnings; `start-classic.cmd -DryRun` output unchanged).

- UI-115 [IN-PROGRESS 2026-10-31 03:01] @PH-2 Not-found page and route error page
  - App: frontend-2/public
  - Implements: REQ-001, REQ-022, REQ-086, TS-026, DES-051, DES-057
  - Uses API: none (layout reads `site`)
  - Behaviour: as `frontend/` UI-034 (same `h1` copy, "Back to home" and "/work" links, `noindex`, title "Page not found — Mitali";
    route error page "Something went wrong" with reload link), frontend-2 styling on `--surface-deep`. `404.html` output and the
    404 status arrive with the pre-render in PH-3 (UI-126).
  - States: not found, unexpected error.
  - Done when: UI-T-146 passes.

### 7.2 Scope items, PH-3 and PH-4 (outlines; full detail when the phase becomes ACTIVE)
- UI-120 [NEW 2026-10-31 02:54] @PH-3 Work page — parity with UI-027 (REQ-087, REQ-020).
- UI-121 [NEW 2026-10-31 02:54] @PH-3 Writing page with `?format=` filter — parity with UI-029 (REQ-087, REQ-030).
- UI-122 [NEW 2026-10-31 02:54] @PH-3 Writing-sample page — parity with UI-030 (REQ-087, REQ-031).
- UI-123 [NEW 2026-10-31 02:54] @PH-3 About page incl. staircase — parity with UI-031 (REQ-087, REQ-040).
- UI-124 [NEW 2026-10-31 02:54] @PH-3 FAQs page — parity with UI-032 (REQ-087, REQ-041).
- UI-125 [NEW 2026-10-31 02:54] @PH-3 Contact page with every form state — parity with UI-033 (REQ-087, REQ-042, REQ-043).
- UI-126 [NEW 2026-10-31 02:54] @PH-3 Pre-render, SEO outputs, compress (TS-029) — parity with UI-004 (REQ-089).
- UI-127 [NEW 2026-10-31 02:54] @PH-3 JSON-LD structured data (TS-030) (REQ-097).
- UI-128 [NEW 2026-10-31 02:54] @PH-3 Production-like preview via `FRONTEND_DIST_DIR` process env (TS-032) (REQ-091).
- UI-129 [NEW 2026-10-31 02:54] @PH-3 Admin API client, session, query plumbing — parity with UI-035 (REQ-088).
- UI-130 [NEW 2026-10-31 02:54] @PH-3 Admin login — parity with UI-036 (REQ-088, REQ-060, REQ-061).
- UI-131 [NEW 2026-10-31 02:54] @PH-3 Admin layout, guard, sidebar, logout and admin not-found — parity with UI-037 (REQ-088).
- UI-132 [NEW 2026-10-31 02:54] @PH-3 Admin dashboard with "needs rebuild" — parity with UI-038 (REQ-088, REQ-052).
- UI-133 [NEW 2026-10-31 02:54] @PH-3 Admin kit: form fields, `ConfirmDialog`, `Toast`, `SidePanel`, unsaved-changes guard,
  `NotFoundState` — parity with UI-040; pop-up patterns DES-053 (REQ-088).
- UI-134 [NEW 2026-10-31 02:54] @PH-3 `ReorderableList` — parity with UI-039 (REQ-088).
- UI-135 [NEW 2026-10-31 02:54] @PH-3 Markdown editor with preview — parity with UI-041 (REQ-088).
- UI-136 [NEW 2026-10-31 02:54] @PH-3 Media field, picker and upload — parity with UI-042 (REQ-088).
- UI-137 [NEW 2026-10-31 02:54] @PH-3 Case studies list — parity with UI-043 (REQ-088, REQ-063).
- UI-138 [NEW 2026-10-31 02:54] @PH-3 Case-study editor: Details, Results and Gallery tabs — parity with UI-044..UI-046 (REQ-088).
- UI-139 [NEW 2026-10-31 02:54] @PH-3 Writing samples list and editor — parity with UI-047, UI-048 (REQ-088).
- UI-140 [NEW 2026-10-31 02:54] @PH-3 Services, engagement models, testimonials, values, process steps — parity with UI-049..UI-051,
  UI-053, UI-054 (REQ-088).
- UI-141 [NEW 2026-10-31 02:54] @PH-3 FAQ categories and FAQs — parity with UI-052 (REQ-088).
- UI-142 [NEW 2026-10-31 02:54] @PH-3 Profile and site settings — parity with UI-055, UI-056 (REQ-088).
- UI-143 [NEW 2026-10-31 02:54] @PH-3 Enquiries list and detail — parity with UI-057, UI-058 (REQ-088).
- UI-144 [NEW 2026-10-31 02:54] @PH-3 Admin skeleton loading states for lists, editors and dashboard (DES-064) (REQ-096).
- UI-145 [NEW 2026-10-31 02:54] @PH-3 Screen-parity matrix complete and the automated parity check (REQ-093).
- UI-150 [NEW 2026-10-31 02:54] @PH-4 Polish rounds and `/ui-review freeze` (G-D) (REQ-082, REQ-NFR-010).
- UI-151 [NEW 2026-10-31 02:54] @PH-4 Performance budget: Lighthouse on an idle machine, bundle comparison (REQ-NFR-011).
- UI-152 [NEW 2026-10-31 02:54] @PH-4 Close-out: README section for frontend-2, run kit check, push plan; `docs/FEATURE.html` unchanged
  (features identical).

### 7.3 Screen-parity matrix (kept current in every phase; REQ-093)
Status = the frontend-2 item's status. API operations are taken from the `frontend/` items' "Uses API" lines; both apps must call
exactly these (public content operations at build time / in dev only; `createEnquiry` and all admin operations at runtime).

| # | Screen | Route | API operations used | frontend/ UI id | frontend-2 UI id | Status |
|---|--------|-------|---------------------|-----------------|------------------|--------|
| 1 | Home | `/` | `getPublicSite`, `listPublicCaseStudies` (featured), `listPublicServices`, `listPublicEngagementModels`, `listPublicTestimonials`, `listPublicFaqPreview` | UI-022..UI-026 | UI-111 | NEW (PH-2) |
| 2 | Work | `/work` | `getPublicSite`, `listPublicCaseStudies`, `listPublicFaqPreview` | UI-027 | UI-120 | NEW, outline (PH-3) |
| 3 | Case study | `/work/:slug` | `getPublicSite`, `getPublicCaseStudy` | UI-028 | UI-112 | NEW (PH-2) |
| 4 | Writing (`?format=`) | `/writing` | `getPublicSite`, `listPublicWritingSamples` | UI-029 | UI-121 | NEW, outline (PH-3) |
| 5 | Writing sample | `/writing/:slug` | `getPublicSite`, `getPublicWritingSample` | UI-030 | UI-122 | NEW, outline (PH-3) |
| 6 | About | `/about` | `getPublicSite`, `listPublicValues`, `listPublicProcessSteps`, `listPublicFaqPreview` | UI-031 | UI-123 | NEW, outline (PH-3) |
| 7 | FAQs | `/faqs` | `getPublicSite`, `listPublicFaqGroups` | UI-032 | UI-124 | NEW, outline (PH-3) |
| 8 | Contact (all form states) | `/contact` | `getPublicSite`, `listPublicFaqPreview`, `createEnquiry` (runtime) | UI-033 | UI-125 | NEW, outline (PH-3) |
| 9 | Not found / route error | `*`, `404.html` | — (layout `getPublicSite`) | UI-034 | UI-115 (+UI-126 for `404.html`) | NEW (PH-2) |
| 10 | Header | all public | `getPublicSite` (`booking_url`) | UI-019, UI-005, UI-006 | UI-105, UI-108 | NEW (PH-2) |
| 11 | Mobile menu | all public, narrow | none | UI-020 | UI-106 | NEW (PH-2) |
| 12 | Footer | all public | `getPublicSite` | UI-021 | UI-107 | NEW (PH-2) |
| 13 | FAQ preview | Home, Work, About, Contact | `listPublicFaqPreview` | UI-017, UI-011 | UI-110 | NEW (PH-2) |
| 14 | Sample-data notes | case study, writing list and sample | `is_sample` from `getPublicCaseStudy`, `listPublicWritingSamples`, `getPublicWritingSample` | UI-015 | UI-110 | NEW (PH-2) |
| 15 | SEO outputs (pre-render, sitemap, robots, admin shell `noindex`) | build | `getPublicSite`, `listPublicCaseStudies`, `listPublicWritingSamples` + page data | UI-004 | UI-126, UI-127 | NEW, outline (PH-3) |
| 16 | Admin login | `/admin/login` | `adminLogin`, `getAdminMe` | UI-036 | UI-130 | NEW, outline (PH-3) |
| 17 | Admin layout, guard, sidebar, logout | `/admin/*` | `getAdminMe`, `getAdminDashboard`, `adminLogout` | UI-037, UI-035 | UI-131, UI-129 | NEW, outline (PH-3) |
| 18 | Dashboard incl. needs-rebuild | `/admin` | `getAdminDashboard` | UI-038 | UI-132, UI-144 | NEW, outline (PH-3) |
| 19 | Case studies list | `/admin/case-studies` | `listAdminCaseStudies`, `reorderAdminCaseStudies`, `deleteAdminCaseStudy` | UI-043 | UI-137 | NEW, outline (PH-3) |
| 20 | Case-study editor: Details | `/admin/case-studies/new`, `/:id` | `createAdminCaseStudy`, `getAdminCaseStudy`, `updateAdminCaseStudy`, `deleteAdminCaseStudy`, `updateAdminCaseStudyResult` | UI-044 | UI-138 | NEW, outline (PH-3) |
| 21 | Case-study editor: Results | `/admin/case-studies/:id` | `getAdminCaseStudy`, `createAdminCaseStudyResult`, `updateAdminCaseStudyResult`, `deleteAdminCaseStudyResult`, `reorderAdminCaseStudyResults` | UI-045 | UI-138 | NEW, outline (PH-3) |
| 22 | Case-study editor: Gallery | `/admin/case-studies/:id` | `getAdminCaseStudy`, `createAdminCaseStudyImage`, `updateAdminCaseStudyImage`, `deleteAdminCaseStudyImage`, `reorderAdminCaseStudyImages` + media operations | UI-046 | UI-138 | NEW, outline (PH-3) |
| 23 | Writing samples list | `/admin/writing` | `listAdminWritingSamples`, `reorderAdminWritingSamples`, `deleteAdminWritingSample` | UI-047 | UI-139 | NEW, outline (PH-3) |
| 24 | Writing-sample editor | `/admin/writing/new`, `/:id` | `createAdminWritingSample`, `getAdminWritingSample`, `updateAdminWritingSample`, `deleteAdminWritingSample` | UI-048 | UI-139 | NEW, outline (PH-3) |
| 25 | Services | `/admin/services` | `listAdminServices`, `createAdminService`, `getAdminService`, `updateAdminService`, `deleteAdminService`, `reorderAdminServices` | UI-049 | UI-140 | NEW, outline (PH-3) |
| 26 | Engagement models | `/admin/engagement-models` | `listAdminEngagementModels`, `createAdminEngagementModel`, `getAdminEngagementModel`, `updateAdminEngagementModel`, `deleteAdminEngagementModel`, `reorderAdminEngagementModels` | UI-050 | UI-140 | NEW, outline (PH-3) |
| 27 | Testimonials | `/admin/testimonials` | `listAdminTestimonials`, `createAdminTestimonial`, `getAdminTestimonial`, `updateAdminTestimonial`, `deleteAdminTestimonial`, `reorderAdminTestimonials`, `listAdminCaseStudies` | UI-051 | UI-140 | NEW, outline (PH-3) |
| 28 | FAQs (categories + items) | `/admin/faqs` | `listAdminFaqCategories`, `createAdminFaqCategory`, `getAdminFaqCategory`, `updateAdminFaqCategory`, `deleteAdminFaqCategory`, `reorderAdminFaqCategories`, `listAdminFaqs`, `createAdminFaq`, `getAdminFaq`, `updateAdminFaq`, `deleteAdminFaq`, `reorderAdminFaqs` | UI-052 | UI-141 | NEW, outline (PH-3) |
| 29 | Values | `/admin/values` | `listAdminValues`, `createAdminValue`, `getAdminValue`, `updateAdminValue`, `deleteAdminValue`, `reorderAdminValues` | UI-053 | UI-140 | NEW, outline (PH-3) |
| 30 | Process steps | `/admin/process-steps` | `listAdminProcessSteps`, `createAdminProcessStep`, `getAdminProcessStep`, `updateAdminProcessStep`, `deleteAdminProcessStep`, `reorderAdminProcessSteps` | UI-054 | UI-140 | NEW, outline (PH-3) |
| 31 | Profile | `/admin/profile` | `getAdminProfile`, `updateAdminProfile` (+ media operations) | UI-055 | UI-142 | NEW, outline (PH-3) |
| 32 | Settings | `/admin/settings` | `getAdminSettings`, `updateAdminSettings` | UI-056 | UI-142 | NEW, outline (PH-3) |
| 33 | Enquiries list | `/admin/enquiries` (`?status=&page=`) | `listAdminEnquiries` | UI-057 | UI-143 | NEW, outline (PH-3) |
| 34 | Enquiry detail | `/admin/enquiries/:id` | `getAdminEnquiry`, `updateAdminEnquiryStatus`, `deleteAdminEnquiry` | UI-058 | UI-143 | NEW, outline (PH-3) |
| 35 | Admin not-found (unknown route or id) | `/admin/*` | — | UI-037, UI-040 (`NotFoundState`) | UI-131, UI-133 | NEW, outline (PH-3) |
| 36 | Unsaved-changes guard | admin editors | — | UI-040 | UI-133 | NEW, outline (PH-3) |
| 37 | Confirm dialogs | admin deletes, clear sample flags | the screen's delete/update operation | UI-040 | UI-133 | NEW, outline (PH-3) |
| 38 | Toasts | admin | — | UI-037, UI-040 | UI-133 | NEW, outline (PH-3) |
| 39 | Reorder | admin lists | the 11 `reorderAdmin*` operations | UI-039 | UI-134 | NEW, outline (PH-3) |
| 40 | Markdown editor with preview | case-study and writing editors | `previewAdminMarkdown` | UI-041 | UI-135 | NEW, outline (PH-3) |
| 41 | Media picker / upload | `MediaField` (cover, thumbnail, portrait, gallery) | `uploadAdminMedia`, `listAdminMedia`, `deleteAdminMedia` | UI-042 | UI-136 | NEW, outline (PH-3) |

### 7.4 Design system, responsive and accessibility rules (frontend-2)
- Tokens: DES-060 only (`palette.css` → `semantic.css` → `surfaces.css`); components read semantic tokens and surface aliases,
  never `--p-*`, never literals. Colour rules DES-051 (green only as fills/indicators; never text, icon or thin line on base or
  band; magenta `#D920E5` never used). Contrast DES-059.
- Typography DES-050/DES-057; layout DES-061; components DES-052; pop-ups DES-053; motion DES-058; header DES-056; images DES-062.
- Responsive (DES-055): mobile-first, custom media `--bp-md` 768, `--bp-lg` 1024, `--bp-xl` 1440 only; one column on phones; no
  horizontal page scroll from 360 to 1920 px; touch targets ≥ 44 × 44 px.
- Accessibility: same rules as section 3.3 (WCAG 2.1 AA required; 2.4.11, 2.5.8, 3.3.8 adopted from 2.2), plus: header never
  hidden while it holds focus and never covering focus (REQ-085); no content depends on motion; reveals never hide content without
  JS, in print or under reduced motion; view transitions do not change focus or scroll handling.

### 7.5 Code review guidelines (frontend-2)
UI-REV-001..UI-REV-025 apply to frontend-2 as well, read with `frontend-2/` paths and the frontend-2 token names. Additionally:
- UI-REV-026 [NEW 2026-10-31 02:54] No imports from `../frontend`: no import specifier, relative path, alias, config entry or
  script path resolves into `frontend/`; the generated client is generated inside `frontend-2/` from `docs/api-contract.yaml`;
  the ESLint rule and the scan test (UI-T-127) pass (SD-111).
- UI-REV-027 [NEW 2026-10-31 02:54] No hard-coded values outside the frontend-2 tokens: component CSS uses only semantic tokens and
  surface aliases (no hex/rgb/hsl, font names, px/rem spacing, radii or durations, no `--p-*` outside `semantic.css`); new
  token-like values go only into the token files and trace to a DES item; `check:styles` passes (UI-T-128).
- UI-REV-028 [NEW 2026-10-31 02:54] Reveals are visible without JavaScript, before hydration, in print and under reduced motion: the
  hidden state exists only under `html[data-motion="on"]` inside `prefers-reduced-motion: no-preference`; the flag is set from
  the client entry after hydration, never by an inline script (UI-T-133, UI-T-150).
- UI-REV-029 [NEW 2026-10-31 02:54] The Origin rewrite exists only in the dev server configuration: `vite/dev-origin.ts` is wired
  only from `server.proxy` for `command === "serve"` (not `preview`), only for `/api/admin` paths and only for the 5174 dev
  origin; nothing in `src/` imports `vite/`; the dist scan finds no rewrite code (UI-T-140; SEC-UI-014).
- UI-REV-030 [NEW 2026-10-31 02:54] Motion: no motion library; only `transform`/`opacity` animate (hover colour/underline-colour
  excepted); every `transition`/`animation` is inside the no-preference block; no scroll listeners except the header's documented
  one; `check:motion-size` ≤ 2 KB gzip passes (UI-T-134, UI-T-135).
- UI-REV-031 [NEW 2026-10-31 02:54] No inline styles or scripts anywhere, including view-transition names, drift offsets, image
  ratios, stagger indices and the motion flag (classes and `data-*` attributes only); JSON-LD only as `application/ld+json`
  (SEC-UI-015).
- UI-REV-032 [NEW 2026-10-31 02:54] Colour use follows DES-051 per surface: green never as text, icon or thin line on base/band;
  muted text per surface; focus ring colour per surface; the derived magenta is never used.
- UI-REV-033 [NEW 2026-10-31 02:54] Fonts: only the six Fontsource Latin files of TS-021 are shipped, each with its licence text;
  only Inter Tight 300 is preloaded; no font URL points outside `/fonts/` (SEC-UI-017, REQ-NFR-012).
- UI-REV-034 [NEW 2026-10-31 02:54] Parity: routes, data keys and API operations per screen match the parity matrix (7.3); the
  static copy and `buildHead` rules are identical to `frontend/`; the matrix row and status are updated in the same change as the
  screen (REQ-093).
- UI-REV-035 [NEW 2026-10-31 02:54] Header and menu: header visible with `:focus-within` and while the menu is open;
  `scroll-padding-top` set; skip link first; menu dialog rules of DES-053 (Esc, close, focus trap and return, `inert`, scroll lock).
- UI-REV-036 [NEW 2026-10-31 02:54] Images: one priority image per page (eager + `fetchpriority="high"`), all others lazy; slot
  ratio classes reserve space; placeholder static under reduced motion (REQ-095).
- UI-REV-037 [NEW 2026-10-31 02:54] Security items for frontend-2: see `security.md` SEC-UI-013..SEC-UI-019 (inherited SEC-UI
  controls, dev-only Origin rewrite, CSP compatibility, JSON-LD escaping, no third-party requests, admin session handling,
  deployment selection).

### 7.6 Unit and component test scenarios (frontend-2)
Vitest + RTL + MSW typed from the contract (jsdom). The `frontend/` scenarios for duplicated modules (UI-T-010 serializer,
UI-T-011 static source, UI-T-016..UI-T-034, UI-T-035..UI-T-040 behaviour parts) are ported with them and run in `frontend-2/`.

| ID | Component / unit | Scenario | Expected | Covers |
|----|------------------|----------|----------|--------|
| UI-T-127 [NEW 2026-10-31 02:54] | Self-containment scan | Scan `src/`, `scripts/`, `vite/`, `e2e/`, configs for paths/specifiers into `frontend/`; ESLint with a planted `import "../../frontend/src/x"` | Scan finds none (only `../docs/api-contract.yaml` in `generate:api`); ESLint reports the planted import | UI-100, UI-REV-026 |
| UI-T-128 [NEW 2026-10-31 02:54] | `check-styles.ts` | Run on the stylesheets; plant a hex colour, a `font-family` name, `padding: 12px`, `var(--p-cream)` in a component | Clean run exits 0; each planted value is reported with file and line | UI-101, UI-REV-027 |
| UI-T-129 [NEW 2026-10-31 02:54] | Token files | Parse `palette.css`, `semantic.css`, `surfaces.css` against the DES-060 list | Every DES-060 token defined once with the documented value; `--p-*` read only in `semantic.css` | UI-101 |
| UI-T-130 [NEW 2026-10-31 02:54] | `Section` + `surfaces.css` | Render each surface | `data-surface` set; deep surfaces map `--accent-on-surface`/`--focus-on-surface` to green; base/band map them to `#367A00`/ink; muted per surface | UI-101, UI-REV-032 |
| UI-T-131 [NEW 2026-10-31 02:54] | `copy-fonts.ts` + `fonts.css` + `index.html` | Run with the installed packages; with a licence file that is not OFL | Exactly the six Latin files + licence texts copied, licence name and version printed, every licence is SIL OFL 1.1; non-OFL → exit ≠ 0; every `@font-face` has `font-display: swap` and a `/fonts/` URL; only Inter Tight 300 preloaded | UI-101, UI-REV-033 |
| UI-T-132 [NEW 2026-10-31 02:54] | White-base review switch | Dev render with `?base=white`; production build | Dev: `<html data-base="white">` and surfaces swapped; build: no `review-switch` module and no `data-base` string in `dist/assets` | UI-101 |
| UI-T-133 [NEW 2026-10-31 02:54] | `Reveal` + `initMotion` | Before hydration; `matchMedia(reduce)`; no IntersectionObserver; motion allowed with one element above and one below 85 %; intersect twice | Visible in the first three cases (no `data-motion`); above-fold element revealed at once, below-fold revealed on intersect, unobserved, never hidden again | UI-102, UI-REV-028 |
| UI-T-134 [NEW 2026-10-31 02:54] | CSS motion check | Scan stylesheets | Every `transition`/`animation` inside `prefers-reduced-motion: no-preference`; animated properties only `transform`/`opacity` (hover colour exceptions listed); `@media print` reveal override present; scroll timelines inside `@supports` | UI-102, UI-REV-030 |
| UI-T-135 [NEW 2026-10-31 02:54] | `check-motion-size.ts` | Bundle `src/shared/motion/index.ts` | gzip ≤ 2048 bytes; no `addEventListener("scroll"` outside `scroll-direction.ts` | UI-102, UI-REV-030 |
| UI-T-136 [NEW 2026-10-31 02:54] | `Header` | Mock scrollY 0 → 300 → 600 → 500; focus a nav link while hidden; open the menu; routes `/work/x` | Compact after header height; hidden on down, shown on up; focus shows it; menu open keeps it; Work has `aria-current`; skip link first focusable | UI-105, UI-REV-035 |
| UI-T-137 [NEW 2026-10-31 02:54] | Mobile menu | Open, Tab cycling, Escape, choose a link, resize ≥ 768 | Dialog semantics, focus trapped and returned, `inert` on siblings, scroll-lock class on `<html>`, closes on link/route change/resize | UI-106 |
| UI-T-138 [NEW 2026-10-31 02:54] | `Footer` | Settings with 2 social links (one `javascript:`), `generated_at` 2026, rights line with `<b>` | "let's talk" link to `/contact`; quick links incl. FAQs; only the http(s) social link rendered with `target`/`rel`; year 2026; rights line as literal text | UI-107 |
| UI-T-139 [NEW 2026-10-31 02:54] | `AppLink` + RootLayout | `document.startViewTransition` present / absent; reduced motion; navigate `/` → `/work/x` → Back | Transition requested only when present; reduced-motion CSS sets `::view-transition-*` animations to none; focus on `<main>`, title updated, scroll top on push and restored on Back in every case | UI-104 |
| UI-T-140 [NEW 2026-10-31 02:54] | `devAdminOrigin` + Vite config | Paths `/api/admin/auth/login`, `/api/admin`, `/api/public/site`, `/api/administrator`; origins `http://localhost:5174`, `http://127.0.0.1:5174`, `http://evil.example`, undefined; resolve config for `serve`, `preview` and `build`; scan `dist/` after `vite build` | Rewritten to `http://127.0.0.1:8000` only for the two admin paths with a 5174 origin; everything else unchanged; rewrite wired only for `serve`; `dist/` contains neither `devAdminOrigin` nor a `127.0.0.1:8000` Origin literal | UI-113, UI-REV-029, SEC-UI-014 |
| UI-T-141 [NEW 2026-10-31 02:54] | `ResponsiveImage` | Raster ref, SVG ref, priority, missing ref, load error, external URL | `srcset`/`sizes`/`alt`; slot ratio class; lazy by default; priority eager + `fetchpriority=high`; fallback in the same frame; external URL → fallback, no `<img src>` | UI-109, SEC-UI-009 |
| UI-T-142 [NEW 2026-10-31 02:54] | Primitives | `Button` variants/loading; `BookCallLink` with https / null / "#" / `javascript:`; `ArrowLink`; `Chip` active; `Wordmark` | As UI-T-016..UI-T-018, UI-T-021 behaviour; ArrowLink has two `aria-hidden` arrows and one accessible name | UI-108 |
| UI-T-143 [NEW 2026-10-31 02:54] | Content components | Ports of UI-T-023..UI-T-034 scenarios; `MetaRow` with 6 fields | Same expectations as `frontend/`; `MetaRow` renders a `<dl>` in field order | UI-110 |
| UI-T-144 [NEW 2026-10-31 02:54] | Home | Render with fixtures; 0 featured; 0 testimonials | One `h1`; sections in the TS-026 order; actions present; empty sections hidden | UI-111 |
| UI-T-145 [NEW 2026-10-31 02:54] | Case study | Fixture with 3 results (1 sample), gallery full/half/half, `more_work` 2; `is_sample`; 0 results; unknown slug | `h1`, meta `<dl>`, results with "Sample data", "Sample case study" note, tile classes in order, 2 more-work units; sections hidden when empty; not-found page | UI-112 |
| UI-T-146 [NEW 2026-10-31 02:54] | Route tree + render | `entry-server.render("/")`, `render("/work/<slug>")`, `render("/work/unknown")`, loader 500; hydrate | Head tags as UI-T-004/006; 404 status + not-found; route error page; no hydration mismatch | UI-103, UI-115 |
| UI-T-147 [NEW 2026-10-31 02:54] | Run kit | Parse `run/run.json`; `make-run-kit.ps1 -CheckOnly`; `start-classic.cmd -DryRun` before/after | `web2` entry as TS-028 and `web` unchanged; check 0 warnings; dry-run output identical | UI-114 |

### 7.7 E2E journeys (frontend-2, Playwright + axe)
PH-2: backend on the **seeded test database** `mitali_portfolio_test` (stated by the orchestrator before the run), frontend-2 on
its dev server `http://localhost:5174`. Screenshot and axe contexts use `reducedMotion: "reduce"`. Axe: no serious or critical
violation. From PH-3 the same journeys also run on the production-like preview (TS-032).

| ID | Journey | Expected | Covers |
|----|---------|----------|--------|
| UI-T-148 [NEW 2026-10-31 02:54] | `/` and one case study at 375, 768, 1024, 1440 px; states: top, scrolled (header compact), header hidden, menu open (375, 768 if shown), accordion open, carousel slide 2 | Header and footer present; one `h1`; axe clean in every state and width; `scrollWidth ≤ innerWidth` also at 360 and 1920; touch targets ≥ 44 px on 375; hero actions visible without scrolling at 1440×900 and 390×844 | UI-105..UI-112, REQ-NFR-010 (PH-2 part) |
| UI-T-149 [NEW 2026-10-31 02:54] | Through `http://localhost:5174`: `POST /api/admin/auth/login` with the test admin (Origin 5174), `GET /api/admin/auth/me`, `POST /api/admin/auth/logout` with `X-CSRF-Token`; then a login with `Origin: http://evil.example` | Login 200 (wrong password → 401, never 403 `origin_rejected`); logout 204; foreign origin → 403 `origin_rejected`; Host `localhost:5174` accepted by the backend | UI-113, REQ-090, SEC-UI-014 |
| UI-T-150 [NEW 2026-10-31 02:54] | Motion: `no-preference` → scroll to a below-fold block; JS disabled; `reduce`; print emulation; CLS observer across a full scroll of `/` and the case study | Block hidden before and visible after crossing 85 %; JS off, reduce and print: everything visible at once, no transitions; parallax static under reduce; CLS < 0.05 | UI-102, UI-109, REQ-NFR-009 |
| UI-T-151 [NEW 2026-10-31 02:54] | Header at 1440 and 375: scroll down 800 px, up 100 px; Tab through the page from the top and from mid-page | Hidden after scrolling down, visible after up; while tabbing, the header is visible when it has focus and no focused element is covered by it | UI-105, REQ-085 |
| UI-T-152 [NEW 2026-10-31 02:54] | Record all requests while loading `/` and a case study | Every request is same-origin (fonts from `/fonts/`, images from `/media/`, data from `/api/public` in dev) | UI-101, SEC-UI-017 |
| UI-T-153 [NEW 2026-10-31 02:54] | Parity (PH-2 part): render `/` and `/work/<slug>` in both apps against the same API with a recording content source | Same set of public operations per route; identical `<title>`, description, canonical and `og:*` | UI-103, UI-111, UI-112, REQ-093 (partial) |
| UI-T-154 [NEW 2026-10-31 02:54] | (PH-3 outline) Smoke for every remaining public and admin screen and state on the production-like preview of `frontend-2/dist` (test DB) | Each screen's behavioural criteria pass (ports of UI-T-103..UI-T-126) | UI-120..UI-143 |
| UI-T-155 [NEW 2026-10-31 02:54] | (PH-3/PH-4 outline) axe on every screen state at 375 / 768 / 1024 / 1440 | No serious or critical violation | REQ-NFR-010 |
| UI-T-156 [NEW 2026-10-31 02:54] | (PH-3 outline) Full parity check: routes, API operations per screen (matrix 7.3), SEO outputs of both builds from the same snapshot | Identical | UI-145, REQ-093, REQ-089 |
| UI-T-157 [NEW 2026-10-31 02:54] | (PH-4 outline) Lighthouse 13 mobile on 6 static pages + one case study + one writing sample, idle machine, median of 3 | Performance ≥ 90; Accessibility, Best Practices, SEO = 100; `benchmarkIndex` recorded; public JS ≤ `frontend/` shared entry | UI-151, REQ-NFR-011 |
| UI-T-158 [NEW 2026-10-31 02:54] | (PH-3 outline) JSON-LD on Home, About, FAQs, case study, writing sample; value with `</script>` | Valid JSON-LD matching the visible content; escaped; no CSP violation | UI-127, REQ-097 |
| UI-T-159 [NEW 2026-10-31 02:54] | (PH-3 outline) Admin skeletons with a delayed API | Skeleton with `aria-busy`, then content or error state | UI-144, REQ-096 |
| UI-T-160 [NEW 2026-10-31 02:54] | (PH-3 outline) Preview command: backend with `FRONTEND_DIST_DIR` = `frontend-2/dist` via process env; unknown URL; `.env` files hashed before/after | frontend-2 served; 404 status with the frontend-2 `404.html`; `.env` unchanged; default run still serves `frontend/dist` | UI-128, REQ-091 |
| UI-T-161 [NEW 2026-10-31 02:54] | (PH-3 outline) Contact form E2E (empty, valid, rate limit) | Same results as UI-T-110/111; enquiries exist only in the test DB | UI-125, REQ-NFR-013 |
| UI-T-162 [NEW 2026-10-31 02:54] | (PH-3 outline) Dist scan of `frontend-2/dist` | No inline executable script (only `application/json` and `application/ld+json` blocks), no `style=`/`on*=` attributes, no external origins, no origin-rewrite code | UI-126, SEC-UI-015 |
