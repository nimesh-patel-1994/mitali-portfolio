# User Requirements — mitali-portfolio

> Source of truth for WHAT the product must do. Owned by the `requirements` skill.
> Status tags: see `status-tracker` skill. Format: `ID [STATUS YYYY-MM-DD HH:MM]`.
> Source: `.dev-pipeline/intake.md` (gate G1 passed 2026-10-29) and `.dev-pipeline/reference/reference-notes.md`.
> The reference site (studiobrag.com) informs structure, behaviour and visual language only; every requirement below
> describes our own behaviour, and all shipped text, images and data are original or dummy.

## 1. Vision and goals
Mitali is a content writer and marketing strategist who needs a personal portfolio website that shows her case studies,
writing samples, services and client feedback, and turns visitors into enquiries. The site has a bold dark / neon-green
look with alternating dark and cream sections, is fast and indexable by search engines, and lets Mitali manage all content
and enquiries herself through a private admin area without touching code. Success: every public page is pre-rendered with
correct SEO metadata, a visitor can send an enquiry in under a minute, and Mitali can publish a new case study or writing
sample without developer help.

## 2. Users and roles
| Role | Description | Key needs |
|------|-------------|-----------|
| Visitor | Anonymous person browsing the public site (prospective client, recruiter, peer) | Understand what Mitali does, see proof of results, read samples, get in touch or book a call quickly, on any device |
| Admin | Mitali; exactly one account, created by a command-line tool (no public sign-up) | Log in securely, edit all content and settings, publish/unpublish and reorder items, read and triage enquiries, refresh the public site |

## 3. Functional requirements

### 3.1 Site-wide (public)
- REQ-001 [IMPLEMENTED 2026-10-31 00:12] The public site provides the pages Home, Work (case-study list), Case study detail,
  Writing (writing-sample list), Writing sample detail, About, Contact, FAQs and a not-found page.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the site is running, when a visitor opens each of `/`, `/work`, `/writing`, `/about`, `/contact`, `/faqs`, then
      the page renders with the shared header and footer.
    - Given a visitor requests a URL that does not exist, then a styled not-found page is shown with a link back to Home and
      the response status is 404.
- REQ-002 [IMPLEMENTED 2026-10-30 18:36] Every public page shows a header with the wordmark (link to Home), navigation links
  Work, Writing, About, Contact, and a primary "Book a call" action whose target URL comes from site settings.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the booking URL in settings is `https://example.com/book`, when a visitor activates "Book a call", then that URL
      opens in a new tab.
    - Given the booking URL is empty or `#`, then "Book a call" links to the Contact page instead.
    - Given the visitor is on a page, then the matching navigation link is marked as current (visually and with
      `aria-current="page"`).
- REQ-003 [IMPLEMENTED 2026-10-30 18:36] (frontend 1; variant in REQ-082) The header stays available while scrolling: it is fixed to the top, becomes compact with
  a solid background after the visitor scrolls past the hero, and on narrow screens collapses into a menu button that opens
  a full-screen menu.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given a viewport narrower than the tablet breakpoint, when the visitor activates the menu button, then a full-screen
      menu opens with all navigation links and "Book a call", focus moves into it, and Escape or the close button closes it
      and returns focus to the menu button.
    - Given the menu is open, when the visitor selects a link, then the menu closes and the page navigates.
    - Given the visitor has scrolled more than the header height, then the header shows its compact solid state.
- REQ-004 [IMPLEMENTED 2026-10-30 18:36] Every public page shows a footer with a large wordmark block, quick links (Work, Writing,
  About, Contact, FAQs), social links and contact email from settings, the current year, and a bottom bar with copyright and
  a short original sign-off.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given settings contain two social links, then both appear in the footer and open in a new tab with
      `rel="noopener noreferrer"`.
    - Given the year changes, then the footer shows the year of the build without a code change.
- REQ-005 [IMPLEMENTED 2026-10-30 18:36] (frontend 1; variant in REQ-082) Until a logo is supplied, the brand mark is the text wordmark "MITALI" set in the heading
  font; replacing it with a supplied logo file requires no change to page layouts.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given no logo file exists in `assets/brand/`, then header and footer show the "MITALI" text wordmark with an
      accessible name.
- REQ-006 [IMPLEMENTED 2026-10-31 00:12] Several public pages include an FAQ preview: an accordion of FAQs marked "show in
  preview", with a link to the full FAQs page.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 6 FAQs are marked for preview, when Home loads, then those 6 appear in display order, all collapsed.
    - Given the FAQ preview appears on Home, Work, About and Contact, then each links to `/faqs`.

### 3.2 Home
- REQ-010 [IMPLEMENTED 2026-10-30 18:36] (frontend 1; variant in REQ-082) Home opens with a full-width dark hero: a large uppercase statement, a short
  introduction, a highlighted one-line tagline and two actions ("Book a call" and "View work"), over a soft animated green
  glow.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given a visitor opens Home, then the hero heading is the page's only `h1` and both actions are visible without
      scrolling on a 1440×900 and a 390×844 viewport.
- REQ-011 [IMPLEMENTED 2026-10-30 18:36] Home shows up to 4 featured, published case studies as cards in display order, with a
  "View all work" link.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 5 published case studies are marked featured, when a visitor opens Home, then the first 4 by display order are
      shown.
    - Given a featured case study is unpublished, then it is not shown.
- REQ-012 [IMPLEMENTED 2026-10-31 00:12] Home shows the services as an expandable list: each service shows its name and expands to
  its description and deliverables.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 5 published services, when the visitor activates a service row (mouse, touch or keyboard), then its description
      and deliverables are revealed and the expanded state is announced to assistive technology.
- REQ-013 [IMPLEMENTED 2026-10-30 18:36] Home shows the engagement models as cards, each with a name, description, a checklist of
  features and an action that leads to booking or contact.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 3 published engagement models, then 3 cards are shown in display order, each with its features as a list.
- REQ-014 [IMPLEMENTED 2026-10-30 18:36] Home and About show a personal story block with Mitali's portrait and short bio from the
  profile.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the profile has a portrait and 3 bio paragraphs, then the block shows the portrait with alt text and the 3
      paragraphs.
- REQ-015 [IMPLEMENTED 2026-10-30 18:36] Home shows a testimonial carousel with previous/next controls and position indicators
  that works with mouse, touch and keyboard.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 5 published testimonials, when the visitor activates "next" on the last one, then the first one is shown.
    - Given keyboard focus is on a control, when Enter or Space is pressed, then the slide changes and the new quote is
      announced politely.
    - The carousel does not advance on its own.

### 3.3 Work and case studies
- REQ-020 [IMPLEMENTED 2026-10-30 18:36] The Work page lists all published case studies as cards (cover image, title,
  campaign-type chip, summary) in display order; each card links to its case-study page.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 6 published and 1 unpublished case study, when a visitor opens Work, then 6 cards are shown in display order.
- REQ-021 [IMPLEMENTED 2026-10-30 18:36] A case-study page at `/work/<slug>` shows a full-width cover, a details block (client,
  year, industry, timeline, campaign type, channels), problem, solution, a results row, an ordered image gallery of
  full-width and half-width tiles, and a "More work" strip with 2 other published case studies and a link to Work.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given a published case study with 3 results, then the results row shows each metric label, value and (when present)
      the change.
    - Given gallery images with layouts full, half, half, then the first spans the content width and the next two sit side
      by side on desktop and stack on mobile.
    - Given 6 published case studies, then "More work" shows 2 case studies other than the current one.
- REQ-022 [IMPLEMENTED 2026-10-30 18:36] Unpublished or unknown case studies and writing samples are not reachable on the public
  site.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given a case study is unpublished, when a visitor requests its URL, then the not-found page is shown with status 404.
    - Given a case study is unpublished, then it does not appear in any list, the sitemap or the "More work" strip.
- REQ-023 [IMPLEMENTED 2026-10-30 18:36] Results and other content seeded as sample data are labelled "Sample data" on the public
  site until replaced or the flag is cleared by the admin.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given a case study result is flagged as sample, then a visible "Sample data" note appears next to the results row.

### 3.4 Writing
- REQ-030 [IMPLEMENTED 2026-10-30 18:36] The Writing page lists published writing samples as cards (thumbnail, title, format
  chip, excerpt) and can be filtered by format: blog, web copy, email, social, landing page, newsletter.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the visitor selects the filter "email", then only email samples are shown and the URL reflects the filter
      (for example `/writing?format=email`).
    - Given a visitor opens `/writing?format=email` directly, then the email filter is active on load.
    - Given no sample matches the filter, then an empty-state message is shown with a way to clear the filter.
    - Given JavaScript is unavailable, then all samples are listed (the filter is an enhancement).
- REQ-031 [IMPLEMENTED 2026-10-30 18:36] A writing-sample page at `/writing/<slug>` shows the title, format, client, date,
  reading time, tags and the full text.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given a published sample with a formatted body (headings, lists, links), then the body renders with that formatting
      and without any executable script.

### 3.5 About, FAQs, Contact
- REQ-040 [IMPLEMENTED 2026-10-30 18:36] The About page shows a statement hero, an origin statement, a two-part vision block,
  four values, four process steps laid out as a descending staircase on desktop (stacked on smaller screens), the personal
  story block, an FAQ preview and a closing call-to-action band.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 4 published values and 4 process steps, then all appear in display order, and process steps keep their reading
      order for screen readers regardless of the staircase layout.
- REQ-041 [IMPLEMENTED 2026-10-31 00:12] The FAQs page shows all published FAQs grouped by category; each group is an accordion
  (two columns on desktop, one on mobile), followed by a call-to-action band. FAQs is linked from the footer.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 4 categories with 16 FAQs, then 4 groups appear in category order with their FAQs in display order.
    - Given an accordion item has keyboard focus, when Enter or Space is pressed, then it toggles and `aria-expanded`
      reflects its state.
- REQ-042 [IMPLEMENTED 2026-10-30 18:36] (definition updated 2026-10-29 20:55, CHG-005) The Contact page shows a heading, a short promise line (from settings), the contact email from settings
  and an enquiry form with name, email, enquiry type (content strategy, copywriting, SEO content, brand messaging, campaign
  planning, other), budget range (optional), company (optional) and message, plus a short privacy note.
  - priority: Must (baseline default, all built; not a client priority)
  - The enquiry-type field starts on a "Choose one…" placeholder and is required.
  - Acceptance criteria:
    - Given the visitor leaves enquiry type on "Choose one…", when they submit, then a field error is shown on enquiry type and nothing is stored.
    - Given valid input, when the visitor submits, then the enquiry is stored with status "new" and a confirmation message
      replaces the form.
    - Given name, email or message is missing, or the email is malformed, then field-level errors are shown, focus moves to
      the first invalid field, and nothing is stored.
    - Given the server rejects or cannot be reached, then an error message is shown and the visitor's input is kept.
- REQ-043 [IMPLEMENTED 2026-10-30 18:36] The contact form is protected against abuse: a hidden honeypot field and a per-client
  submission rate limit; validation is enforced on the server regardless of the browser.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the honeypot field is filled, when the form is submitted, then the visitor sees the normal confirmation but no
      enquiry is stored.
    - Given more than 5 submissions from the same client within 10 minutes, then further submissions are rejected with a
      "try again later" message until the window passes.

### 3.6 SEO and publishing
- REQ-050 [IMPLEMENTED 2026-10-30 18:36] Public pages are delivered as pre-rendered HTML with their content present before
  JavaScript runs, each with its own title, meta description, canonical URL and Open Graph tags (title, description,
  image).
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the site has been built, when `/work/<slug>` is fetched without running JavaScript, then the HTML contains the
      case-study title, summary, a unique `<title>`, meta description, canonical link and `og:image`.
- REQ-051 [IMPLEMENTED 2026-10-30 18:36] The build produces `sitemap.xml` listing every published public page and `robots.txt`
  that excludes `/admin`; admin pages carry `noindex`.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 6 published case studies and 12 published writing samples, then `sitemap.xml` lists the 6 static pages plus
      18 detail pages and nothing under `/admin`.
- REQ-052 [IMPLEMENTED 2026-10-30 18:36] Content changes made in the admin area reach the public site when a "rebuild site"
  command is run; the admin area tells Mitali when content has changed since the last rebuild.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given Mitali edits a case study title, when the rebuild command completes, then the public page shows the new title.
    - Given content changed after the last rebuild, then the admin dashboard shows a "Site needs rebuilding" notice with
      the command to run.

### 3.7 Admin
- REQ-060 [IMPLEMENTED 2026-10-30 18:36] The admin logs in at `/admin/login` with email and password; the session is held in a
  secure HttpOnly cookie, expires after inactivity, and logout ends it. There is no public sign-up.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given correct credentials, when the admin logs in, then the admin dashboard opens.
    - Given wrong credentials, then a generic "email or password is incorrect" message is shown (no hint which was wrong).
    - Given the admin logs out, when any admin page or admin API is requested with the old session, then access is refused
      and the login page is shown.
    - Given no session, when any `/admin` page other than login is opened, then the visitor is redirected to login.
- REQ-061 [IMPLEMENTED 2026-10-30 18:36] Repeated failed logins are throttled.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 5 failed login attempts for the same account or client within 15 minutes, then further attempts are blocked
      for 15 minutes with a "too many attempts" message, even with the correct password.
- REQ-062 [IMPLEMENTED 2026-10-30 18:36] The admin account is created and its password reset only through a command-line tool;
  the tool enforces a minimum password strength.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given no admin exists, when the create-admin command runs with an email and a password of at least 12 characters,
      then the admin can log in.
    - Given a password shorter than 12 characters, then the command refuses it.
    - Given a password reset by the command, then existing sessions end.
- REQ-063 [IMPLEMENTED 2026-10-30 18:36] The admin can create, edit, publish/unpublish, reorder and delete case studies,
  including their results and gallery images (upload, alt text, full/half layout, order).
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the admin saves a case study with a duplicate slug, then a validation error is shown and nothing is saved.
    - Given the admin uploads a gallery image without alt text, then saving is refused until alt text is provided.
    - Given the admin uploads a file that is not a JPEG, PNG, WebP or SVG image, or is larger than 10 MB, then the upload
      is rejected with a clear message.
    - Given the admin drags or moves an item up/down, then the new display order is saved and used on the public site after
      rebuild.
    - Given the admin deletes a case study, then a confirmation is required, and its results and gallery entries are
      removed with it.
- REQ-064 [IMPLEMENTED 2026-10-30 18:36] The admin can create, edit, publish/unpublish, reorder and delete writing samples
  (including thumbnail and a formatted body), services, engagement models, testimonials, FAQ categories and FAQs (including
  the "show in preview" flag), values and process steps.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the admin unpublishes a testimonial, then after rebuild it no longer appears in the carousel.
    - Given the admin deletes an FAQ category that still contains FAQs, then deletion is refused with a message to move or
      delete those FAQs first.
- REQ-065 [IMPLEMENTED 2026-10-30 18:36] (definition updated 2026-10-29 20:55, CHG-005: contact promise line and footer rights line added to settings) The admin can edit the profile (name, headline, bio, skills, tools, years of
  experience, origin statement, vision blocks, portrait) and site settings (contact email, booking URL, social links,
  footer sign-off, footer rights line, contact promise line, notification email placeholder).
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the admin enters an invalid email or URL in settings, then a field error is shown and nothing is saved.
- REQ-066 [IMPLEMENTED 2026-10-30 18:36] The admin can list enquiries (newest first, filterable by status), open one to read it,
  and change its status between new, replied and archived.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given 3 new and 1 archived enquiry, when the admin filters by "new", then 3 enquiries are shown.
    - Given the admin marks an enquiry "replied", then the list shows the new status.
    - The admin dashboard shows the count of enquiries with status "new".
- REQ-067 [IMPLEMENTED 2026-10-30 18:36] The admin can clear the "sample data" flag on any case study, result or writing sample.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the admin clears the flag on a case study's results, then after rebuild the "Sample data" note no longer
      appears for that case study.

### 3.8 Data and setup
- REQ-070 [IMPLEMENTED 2026-10-30 18:36] A re-runnable seed command fills the database with original dummy content themed on
  content writing and marketing strategy: 6 case studies (4 featured) with 18 sample results and gallery images,
  12 writing samples across all formats, 5 services, 3 engagement models, 5 testimonials from fictional clients, 16 FAQs in
  4 categories (6 marked for preview), 4 values, 4 process steps, the profile and site settings; 4 enquiries are seeded in
  development only.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the seed has run once, when it runs again, then the record counts are unchanged (no duplicates).
    - Given the environment is not development, then no enquiries are seeded.
    - All seeded case studies, results and writing samples are flagged as sample data.
- REQ-071 [IMPLEMENTED 2026-10-30 18:36] All placeholder images (case-study covers and gallery tiles, writing thumbnails,
  portrait) are generated locally by the seed; nothing is downloaded from or linked to any third-party site, and no text,
  image, logo, font or data from the reference site is used.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the seed has run, then every image path in the database points to a file inside the project's media folder.
- REQ-072 [IMPLEMENTED 2026-10-30 18:36] The project includes a database setup script that the user runs with their own
  PostgreSQL superuser credentials to create the application role and the development and test databases; application
  credentials are read from a git-ignored environment file, with a committed example file.
  - priority: Must (baseline default, all built; not a client priority)
  - Acceptance criteria:
    - Given the user runs the setup script against PostgreSQL 17 on port 5442, then the databases `mitali_portfolio` and
      `mitali_portfolio_test` exist and are owned by the application role.
    - The repository contains `.env.example` and no `.env`.

- REQ-DOC-001 [NEW 2026-10-31 02:18] Client feature guide: the project keeps `docs/FEATURE.html`, a single self-contained page that explains every implemented and tested feature in plain language and how to use it (skill `feature-guide`, command `/feature-guide`). Added by `/upgrade-project` (toolkit 1.2.0).
  - priority: Must (toolkit requirement)
  - Acceptance criteria:
    - Given features are IMPLEMENTED and tested, when a phase, feature, bug fix or visible change is closed out, then `docs/FEATURE.html` describes them and `make-feature-guide.ps1 -CheckOnly` reports no problem
    - Given the guide has more than 8 features, when it is opened, then it is paginated by section with a menu, previous/next buttons and search
    - Given the file is emailed on its own, when it is opened offline, then all text, styling and images display
    - Until the developer has checked it against the built app, the guide is marked DRAFT.

### 3.9 Variant: frontend-2 (second, alternative front end; feature agreed at G1 on 2026-10-31, CHG-012)
> A design option for the client: a second, self-contained web app in `frontend-2/` that shows the **same screens with the same
> behaviour, states, data and SEO outputs** as `frontend/`, with a new visual and motion design (design-brief section 7,
> "Variant: frontend-2", DES-050..). Every functional requirement above (REQ-001..REQ-072) applies to frontend-2 unchanged and is
> not repeated here; the items below add only what is specific to the variant. Only one front end is ever deployed.
> Inspiration: https://theatlyx.com/sportfolio/ecommerce-brand-identity-redesign/ (inspiration only, visual and interaction design;
> nothing about its content, domain or features is used). Priorities are **proposed; the user confirms them at G2**.

- REQ-080 [NEW 2026-10-31 02:54] @PH-2 A second web app exists in `frontend-2/` at the project root that is self-contained: it
  builds, tests and runs on its own and does not import, link to or read any file from `frontend/`.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given a clean checkout, when `npm ci` and `npm run build` run inside `frontend-2/`, then they succeed without `frontend/`
      having been installed or built.
    - Given the source of `frontend-2/`, when it is scanned for imports and paths, then nothing resolves into `../frontend/`
      (including the generated API client, which is generated from `docs/api-contract.yaml` inside `frontend-2/`).
    - Given frontend-2 is added, then `frontend/` (its files, scripts, ports and the existing launchers) is unchanged.
- REQ-081 [NEW 2026-10-31 02:54] @PH-2 frontend-2 uses the existing backend exactly as it is: the same API operations, the same
  database (through the API only), the same admin authentication flow (session cookie + CSRF token) and the same environment
  variable names; the API contract, backend code and database schema are not changed for it.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given the frontend-2 work is complete, when `git diff main -- backend/ docs/api-contract.yaml` is run, then it shows no
      change made for frontend-2.
    - Given frontend-2 calls the API, then every call is an operation that exists in `docs/api-contract.yaml`.
    - Given frontend-2 needs configuration, then it uses only `VITE_SITE_URL` (public) and the build-time `API_BASE_URL`.
    - There is no mock API: development runs against the real backend on the development database, tests against the test
      database.
- REQ-082 [NEW 2026-10-31 02:54] @PH-2 frontend-2 keeps every behavioural acceptance criterion of REQ-001..REQ-072 and differs only
  in visual design; where an existing requirement prescribes a look, frontend-2 follows its own design instead, as listed here.
  - priority: Must (confirmed at G2)
  - Variant differences (visual only): REQ-003 "stays fixed while scrolling" is replaced by REQ-085; REQ-005 the wordmark uses
    the label font (Antonio) rather than the frontend-2 heading font; REQ-010 the hero follows the frontend-2 surface design
    (it need not be dark and has no green glow); REQ-NFR-003's list of effects is replaced by REQ-084; REQ-NFR-007's font list
    is replaced by REQ-NFR-012; "cards" in REQ-011/013/020/030 mean content units (image, title, chip, summary, link), which
    frontend-2 shows without card chrome.
  - Acceptance criteria:
    - Given any public or admin screen of frontend-2, when its behavioural acceptance criteria from REQ-001..REQ-072 are run,
      then they pass (for example REQ-010: Home has exactly one `h1`, and "Book a call" and "View work" are visible without
      scrolling at 1440×900 and 390×844).
    - Given the list above, then no other requirement is relaxed for frontend-2.
- REQ-083 [NEW 2026-10-31 02:54] @PH-2 frontend-2 styles everything through a semantic design-token layer (brand, surface, ink,
  line, type, space, radius and motion roles) on top of a raw palette, so that another visual variant needs mainly a new token
  file.
  - priority: Must (confirmed at G2; improvement #1)
  - Acceptance criteria:
    - Given the frontend-2 stylesheets, when the style check runs, then component styles contain no literal colour, font family,
      spacing, radius or duration, and read only semantic or surface tokens (never the raw palette).
    - Given the semantic file is pointed at a different raw palette (the white-base comparison of the P1 review), when the
      site is rebuilt, then every screen changes colour without any component file changing.
- REQ-084 [NEW 2026-10-31 02:54] @PH-2 frontend-2 has a motion system: content blocks fade up once as they enter the viewport,
  media bands drift slowly (parallax) and image collages drift while scrolling, links and buttons animate on hover, and the
  mobile menu slides in; all motion is an enhancement that never hides content.
  - priority: Must (confirmed at G2; improvement #2)
  - Acceptance criteria:
    - Given motion is allowed and JavaScript runs, when a block reaches about 85 % of the viewport height, then it fades and
      moves up once and stays visible afterwards (scrolling back does not replay it).
    - Given JavaScript is disabled, when any page loads, then all content is visible at once, in its final position, with no
      animation (reveals are progressive enhancement: content is hidden only after the script has run and marked the page).
    - Given the page is printed (print preview or print media), then all content is visible in its final position.
    - Given the system requests reduced motion, then all content is visible at once, in its final position, with no animation.
    - Given an automated screenshot or accessibility test (E2E, axe, Lighthouse), then all content is visible in its final
      state in the captured image or tree.
    - Given a browser without scroll-driven animation support, then parallax bands and collages show a static layout.
    - The site has no smooth-scrolling (scroll hijacking) and no custom cursor.
- REQ-085 [NEW 2026-10-31 02:54] @PH-2 The frontend-2 header hides when the visitor scrolls down and reappears when they scroll up,
  is never hidden while it contains keyboard focus, and never covers a focused element.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given the visitor has scrolled down more than the header height, when they continue scrolling down, then the header
      moves out of view; when they scroll up, then it comes back in its compact state.
    - Given a scroll movement smaller than about 8 px in either direction, then the header does not change state.
    - Given the page is scrolled to near the top (within the header height), then the header is always visible.
    - Given keyboard focus is anywhere inside the header (a header link, "Book a call" or the menu button), then the header is
      visible.
    - Given the mobile menu is open, then the header stays visible.
    - Given the visitor tabs to any element below the header, then the element is not covered by the header (WCAG 2.4.11):
      the page has `scroll-padding-top` at least equal to the header height.
    - Given the page loads, then "Skip to content" is the first focusable element and moves focus to the main content.
    - Given the system requests reduced motion, then the header is always visible (it never hides) and nothing animates.
    - The scroll direction comes from one passive, once-per-frame scroll listener that only toggles a class; it is the single
      deliberate exception to the motion budget (REQ-NFR-009, SD-118).
- REQ-086 [NEW 2026-10-31 02:54] @PH-2 frontend-2 provides the public layout shell (header, mobile menu, footer, skip link, route
  error and not-found page) and the Home and case-study pages with the same content, behaviour, states and API data as
  `frontend/`, reading the real API.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given the development backend runs, when `/` and `/work/<slug>` are opened on the frontend-2 dev server, then they show the
      content of REQ-010..REQ-015, REQ-021 and REQ-023 from the development database, with header and footer per REQ-002..REQ-006.
    - Given an unknown case-study slug, then the frontend-2 not-found page is shown (REQ-022).
    - Given the footer, then it shows a large "let's talk" call-to-action linking to Contact, followed by the link columns
      of REQ-004.
- REQ-087 [NEW 2026-10-31 02:54] @PH-3 frontend-2 provides every remaining public screen with the same behaviour and states as
  `frontend/`: Work, Writing with the `?format=` filter, writing sample, About, FAQs and Contact (all form states).
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given each screen, when the acceptance criteria of REQ-020, REQ-030, REQ-031, REQ-040..REQ-043 and REQ-006 are run
      against frontend-2, then they pass.
    - Given the contact form is submitted in an automated test, then the enquiry is stored only in the test database.
- REQ-088 [NEW 2026-10-31 02:54] @PH-3 frontend-2 provides the complete admin area with the same behaviour and states as
  `frontend/`: login, layout with guard, sidebar and logout, dashboard with the rebuild notice, every content list and editor
  (including the case-study Details, Results and Gallery tabs), profile, settings, enquiries list and detail, the admin
  not-found state, unsaved-changes guards, confirmation dialogs, toasts, reordering, the Markdown editor with preview and the
  media picker with upload.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given each admin screen, when the acceptance criteria of REQ-052 and REQ-060..REQ-067 are run against frontend-2, then
      they pass.
    - Given an admin logs in through frontend-2, then the same session cookie and CSRF rules apply as in `frontend/` (REQ-060,
      REQ-NFR-005).
- REQ-089 [NEW 2026-10-31 02:54] @PH-3 frontend-2 produces the same SEO outputs as `frontend/`: pre-rendered HTML for every public
  page with the same titles, meta descriptions, canonical URLs and Open Graph tags, the same `sitemap.xml` and `robots.txt`,
  `noindex` on the admin, and a `404.html` served with status 404.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given both front ends are built from the same database snapshot, when their outputs are compared, then the route list,
      `<title>`, meta description, canonical, `og:*` values, `sitemap.xml` URLs and `robots.txt` are identical.
    - Given frontend-2 is served by the backend, when an unknown URL is requested, then its not-found page is returned with
      status 404 (REQ-001, REQ-022).
- REQ-090 [NEW 2026-10-31 02:54] @PH-2 frontend-2 runs in development on its own port (5174) next to `frontend/` (5173), against
  the same backend, and the admin area works there without changing the backend's allowed origins.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given the backend runs on port 8000, when `npm run dev` starts in `frontend-2/`, then the site opens at
      `http://localhost:5174/` and `/api` and `/media` requests reach the backend.
    - Given the frontend-2 dev server, when an admin login and then a state-changing admin request (with the CSRF token) are
      sent through it from the `http://localhost:5174` origin, then neither is rejected with `origin_rejected`, without editing
      `ALLOWED_ORIGINS` or any `.env` file (in PH-2 proved by an automated request; from PH-3 also through the admin screens).
    - Given a request through the dev server that carries any other origin, then the backend still rejects it as before.
    - Given a production build of frontend-2 (or `vite preview`), then it contains no origin rewriting of any kind.
- REQ-091 [NEW 2026-10-31 02:54] @PH-3 Only one front end is deployed at a time; the backend serves whichever build is selected by
  configuration, and frontend-2 can be previewed production-like locally without changing any `.env` file.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given the default configuration, then the backend serves `frontend/dist` exactly as before.
    - Given the frontend-2 preview command, then the backend serves `frontend-2/dist` (selected through a process environment
      variable for that run only), and no `.env` file is modified.
    - frontend-2 is never part of the deployment of `frontend/`.
- REQ-092 [NEW 2026-10-31 02:54] @PH-2 The project's run kit can start frontend-2 next to the existing apps, while
  `start-classic.cmd` and the existing `web` app start exactly as before.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given `run/run.json`, then it contains a second web app for `frontend-2` on port 5174 that depends on the API and opens
      `http://localhost:5174/`.
    - Given `start-classic.cmd -DryRun`, then its output is unchanged by the frontend-2 work.
- REQ-093 [NEW 2026-10-31 02:54] @PH-3 A screen-parity matrix lists every screen of `frontend/` with its route, the API operations it
  uses and the matching frontend-2 item and status, and an automated parity check proves frontend-2 matches `frontend/`.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given the matrix in `docs/ui-scope.md`, then every screen of `frontend/` has a row with a frontend-2 item.
    - Given the parity check runs, then for every screen frontend-2 has the same route and calls the same API operations as
      `frontend/`, and the SEO outputs of REQ-089 are identical.
- REQ-094 [NEW 2026-10-31 02:54] @PH-2 Navigating between pages of frontend-2 uses a short visual transition where the browser
  supports it, without breaking focus management or scroll position.
  - priority: Should (confirmed at G2; improvement #3; may be dropped at the P1 review)
  - Acceptance criteria:
    - Given a browser with the View Transitions API and motion allowed, when the visitor follows an internal link, then the
      page changes with a cross-fade.
    - Given reduced motion or no browser support, then navigation is instant.
    - Given any navigation, then focus moves to the main content, the document title updates and the new page starts at the
      top (or at the restored position on Back), exactly as without the transition.
- REQ-095 [NEW 2026-10-31 02:54] @PH-3 Images in frontend-2 load without layout shift: every image has a reserved box with a
  neutral placeholder until it loads, and the largest image of a page loads first.
  - priority: Should (improvement #4; no backend image change; moved from PH-2 to PH-3 at G2)
  - Acceptance criteria:
    - Given a page with images, when it loads, then no image changes the layout (CLS contribution 0) and a neutral placeholder
      shows in each box until its image appears.
    - Given the page's main (LCP) image, then it is requested eagerly with high priority, and all other images lazily.
    - Given reduced motion, then the placeholder does not animate.
- REQ-096 [NEW 2026-10-31 02:54] @PH-3 While admin lists, editors and the dashboard load, frontend-2 shows skeleton placeholders
  shaped like the content.
  - priority: Should (confirmed at G2; improvement #5)
  - Acceptance criteria:
    - Given a slow API response, when an admin list, editor or the dashboard is opened, then a skeleton is shown and announced
      as busy to assistive technology, and is replaced by the content (or the error state) when the response arrives.
- REQ-097 [NEW 2026-10-31 02:54] @PH-3 frontend-2 public pages carry structured data: the person (Mitali), each case study and each
  writing sample as a creative work, the FAQs page as an FAQ page, and breadcrumbs on detail pages.
  - priority: Should (confirmed at G2; improvement #6)
  - Acceptance criteria:
    - Given a built case-study page, then it contains one `application/ld+json` block with a creative work (title, summary,
      URL, image) and a breadcrumb list, and the values match the visible content.
    - Given a value containing `</script>`, then the block stays valid and nothing executes (same escaping as the hydration
      data).
    - Given the content security policy, then the pages produce no CSP violation.

## 4. Non-functional requirements
- REQ-NFR-001 [IMPLEMENTED 2026-10-30 18:36] Responsive layout from 360 px wide phones to 1920 px desktops, with mobile, tablet
  and desktop layouts; no horizontal scrolling at any width from 360 px.
  - priority: Must (baseline default, all built; not a client priority)
- REQ-NFR-002 [IMPLEMENTED 2026-10-31 00:12] Accessibility: public and admin pages meet WCAG 2.1 AA (contrast, visible focus,
  keyboard operation of menu, accordions, carousel, filters and forms, labelled form fields, alt text). The neon green is
  never used for text or icons on cream or white.
  - priority: Must (baseline default, all built; not a client priority)
- REQ-NFR-003 [IMPLEMENTED 2026-10-31 00:12] (frontend 1; variant in REQ-082) Motion (hero glow, scroll reveals, hover effects, accordion and carousel transitions)
  is subtle and is turned off when the visitor's system requests reduced motion.
  - priority: Must (baseline default, all built; not a client priority)
- REQ-NFR-004 [IMPLEMENTED 2026-10-31 00:12] Performance: on a local production build, each public page scores at least 90 for
  Performance, Accessibility, Best Practices and SEO in Lighthouse (mobile profile); images are served in sizes appropriate
  to their display width.
  - priority: Must (baseline default, all built; not a client priority)
- REQ-NFR-005 [IMPLEMENTED 2026-10-30 18:36] Privacy and security: enquiry data and the admin session are protected (no secrets
  in the repository, passwords stored only as strong one-way hashes, admin endpoints require a valid session, state-changing
  admin requests are protected against cross-site request forgery). Enquiries are kept until the admin deletes or archives
  them.
  - priority: Must (baseline default, all built; not a client priority)
- REQ-NFR-006 [IMPLEMENTED 2026-10-30 18:36] The project runs locally on the user's Windows machine (PostgreSQL 17 on port 5442,
  Python 3.12, Node.js) without Docker; setup and run steps are documented in a README.
  - priority: Must (baseline default, all built; not a client priority)
- REQ-NFR-007 [IMPLEMENTED 2026-10-30 18:36] (frontend 1; variant in REQ-082) All styling uses the design tokens in `docs/design-brief.md`; fonts are self-hosted
  open-licence fonts (Antonio, Public Sans).
  - priority: Must (baseline default, all built; not a client priority)
- REQ-NFR-008 [IMPLEMENTED 2026-10-30 18:36] Scale: one admin and low public traffic; budget minimal (no paid services required to
  run the project locally).
  - priority: Must (baseline default, all built; not a client priority)

Variant: frontend-2 (CHG-012; REQ-NFR-001..008 also apply to frontend-2 except where REQ-082 lists a variant difference):
- REQ-NFR-009 [NEW 2026-10-31 02:54] @PH-2 Motion budget for frontend-2: the motion system adds at most 2 KB (gzip) of JavaScript,
  animates only `transform` and `opacity`, uses no animation library and no scroll-event handlers for animation (the header's single passive, once-per-frame scroll
  listener that only toggles a class is the one deliberate exception, SD-118), and keeps
  Cumulative Layout Shift below 0.05 on every public page.
  - priority: Must (confirmed at G2; improvement #2)
  - Acceptance criteria:
    - Given a production build, when the motion modules are measured, then their gzip size is ≤ 2 KB.
    - Given the stylesheets, then every animation and transition targets only `transform` and/or `opacity` (colour, border
      and underline colour changes on hover excepted) and sits inside a `prefers-reduced-motion: no-preference` block.
    - Given Lighthouse (mobile) on each public page, then CLS < 0.05.
- REQ-NFR-010 [NEW 2026-10-31 02:54] @PH-4 Accessibility and responsiveness of frontend-2: every public and admin screen meets WCAG
  2.1 AA (as REQ-NFR-002), every screen state has no serious or critical axe violation at 375, 768, 1024 and 1440 px, there is no
  horizontal page scroll from 360 to 1920 px, and every touch target is at least 44 × 44 px.
  - priority: Must (confirmed at G2; applies to every screen from PH-2, verified in full in PH-4)
  - Acceptance criteria:
    - Given the E2E suite, when axe runs on every screen state at the four widths, then it reports no serious or critical
      violation.
    - Given widths 360 and 1920 px, then `scrollWidth ≤ innerWidth` on every screen.
    - Given any interactive control on a touch layout, then its target is at least 44 × 44 px.
- REQ-NFR-011 [NEW 2026-10-31 02:54] @PH-4 Performance budget for frontend-2: on a local production-like build measured on an idle
  machine, every public page scores at least 90 for Performance and 100 for Accessibility, Best Practices and SEO in
  Lighthouse (mobile); public-page JavaScript is no larger than `frontend/`'s shared entry; CLS < 0.05.
  - priority: Must (confirmed at G2; improvement #7)
  - Acceptance criteria:
    - Given each public page (6 static pages, one case study, one writing sample), when Lighthouse runs (median of 3 runs),
      then Performance ≥ 90 and Accessibility, Best Practices and SEO = 100, and the report records the CPU `benchmarkIndex`.
    - Given both production builds, then the gzip size of frontend-2's shared public entry (JS) is ≤ that of `frontend/`.
- REQ-NFR-012 [NEW 2026-10-31 02:54] @PH-2 frontend-2 fonts (Inter Tight, Public Sans, Antonio) are open-licence fonts self-hosted
  from their Fontsource packages (Latin subset, minimal weights, `font-display: swap`); no font or other resource is loaded
  from a third party.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given each font package, then its licence is verified as SIL Open Font License 1.1 from the package licence file and the
      licence text ships with the build.
    - Given any frontend-2 page, when its network requests are recorded, then every request goes to the same origin.
- REQ-NFR-013 [NEW 2026-10-31 02:54] @PH-2 frontend-2 work never touches production data and never mixes databases: development and
  site builds read the development database through the API, automated end-to-end tests use only the seeded test database, and
  the database in use is stated before every build or test run.
  - priority: Must (confirmed at G2)
  - Acceptance criteria:
    - Given an E2E run, then the backend it talks to is connected to `mitali_portfolio_test`, and enquiries created by tests
      exist only there.
    - Given a build that pre-renders, then it reads the development database through the API, never production.

## 5. Out of scope
- Blog comments, newsletter sign-up, analytics, cookie banner, multiple languages, payments.
- Cloud hosting, infrastructure, CI/CD and a production deployment (to be added through `/feature` later).
- Sending email notifications for enquiries (only a settings placeholder exists).
- Public user accounts, multiple admins, roles, password reset by email.
- A theme switch (the site has one fixed theme with alternating dark and cream sections).
- Mobile apps.
- Copying any text, images, logo, fonts, code or data from the reference site.
- frontend-2 (CHG-012): light/dark mode (improvement #8, skipped; the token layer keeps it cheap later), smooth scrolling,
  a custom cursor, AVIF or blur-up image placeholders (would need backend image changes), a hover-media tab showcase, any new
  screen, feature, API operation or data field, and deploying both front ends at once.

## 6. Assumptions, constraints, open questions
| # | Type | Item | Owner | Resolved? |
|---|------|------|-------|-----------|
| 1 | Constraint | Reference site is inspiration only; owner's permission not confirmed. Only structure, behaviour and the colour palette (explicitly requested) are taken. | User | Yes |
| 2 | Open | Real logo, contact email, booking URL and social links: placeholders until supplied. | User | No |
| 3 | Open | Real case studies, metrics, writing samples and permission to name clients: dummy data until supplied. | User / Mitali | No |
| 4 | Assumption | Writing sits in the main navigation next to Work (intake). | User | Yes |
| 5 | Assumption | Engagement models show descriptions and features without prices, as on the reference. Prices can be added via `/feature`. | User | No |
| 6 | Assumption | Headings use a punchy uppercase voice with original wording; no reuse of the reference's puns. | User | No |
| 7 | Assumption | Case-study URLs use `/work/<slug>` (matches the "Work" navigation label) rather than the reference's `/projects/<slug>`. | User | No |
| 8 | Assumption | Header scroll behaviour, mobile menu, motion details and tablet breakpoints are our own design (not observable on the reference). | Design | Yes |
| 9 | Constraint | The PostgreSQL superuser password is never asked for in chat; the user runs the DB setup script. | User | Yes |
| 10 | Deferred | Email notifications for enquiries; hosting and cloud. | User | No |
| 11 | Assumption | Rate limits: contact form 5 per 10 minutes per client; login 5 failures per 15 minutes. | User | No |
| 12 | Resolved | frontend-2 MoSCoW priorities on REQ-080..REQ-097 and REQ-NFR-009..013 are proposals (Must: parity, accessibility, no backend change, #1, #2, #7; Should: #3-#6). Resolved at G2: Must/Should as proposed. | User | Yes (2026-10-31 02:58) |
| 13 | Resolved | REQ-085 (header hides on scroll down) needs the scroll direction, which no CSS feature reports in every browser. Proposed: one passive, frame-throttled scroll listener in the header only (reads `scrollY`, no layout reads), documented as the single exception to "no scroll handlers" in REQ-NFR-009 (which then applies to animation only). Alternative: CSS scroll-state queries where supported and an always-visible compact header elsewhere. Resolved at G2: one passive, once-per-frame listener toggling a class; ignores movements under ~8 px; header always shown near the top, when it contains focus, when the menu is open, and always under reduced motion. Recorded as SD-118, the single exception to REQ-NFR-009. | User | Yes (2026-10-31 02:58) |
| 14 | Resolved | REQ-082 relaxes the visual parts of REQ-003, REQ-005, REQ-010, REQ-NFR-003 and REQ-NFR-007 for frontend-2 only. Confirm the list. Resolved at G2: agreed. Only the visual parts are relaxed; behaviour and accessibility criteria stay. REQ-003, REQ-005, REQ-010, REQ-NFR-003 and REQ-NFR-007 are marked "frontend 1; variant in REQ-082". | User | Yes (2026-10-31 02:58) |
| 15 | Constraint | frontend-2 is built UI-first but without a mock API (user decision at G1): the prototype phase reads the real backend on the development database, so reviews need the backend and PostgreSQL running. | User | Yes |
| 16 | Resolved | When frontend-2 is the deployed front end, the admin dashboard still shows the backend's constant rebuild command (`cd frontend; npm run build:site`), because the backend is not changed (REQ-081). The "needs rebuild" comparison itself reads the selected build's `build-info.json` and stays correct. Accept, or change the backend later through `/feature`? Resolved at G2: accepted for now as a known difference (TS open questions); a backend follow-up only if frontend-2 is chosen for deployment. | User | Yes (2026-10-31 02:58) |
