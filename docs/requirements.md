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
- REQ-001 [NEW 2026-10-29 16:06] The public site provides the pages Home, Work (case-study list), Case study detail,
  Writing (writing-sample list), Writing sample detail, About, Contact, FAQs and a not-found page.
  - Acceptance criteria:
    - Given the site is running, when a visitor opens each of `/`, `/work`, `/writing`, `/about`, `/contact`, `/faqs`, then
      the page renders with the shared header and footer.
    - Given a visitor requests a URL that does not exist, then a styled not-found page is shown with a link back to Home and
      the response status is 404.
- REQ-002 [NEW 2026-10-29 16:06] Every public page shows a header with the wordmark (link to Home), navigation links
  Work, Writing, About, Contact, and a primary "Book a call" action whose target URL comes from site settings.
  - Acceptance criteria:
    - Given the booking URL in settings is `https://example.com/book`, when a visitor activates "Book a call", then that URL
      opens in a new tab.
    - Given the booking URL is empty or `#`, then "Book a call" links to the Contact page instead.
    - Given the visitor is on a page, then the matching navigation link is marked as current (visually and with
      `aria-current="page"`).
- REQ-003 [NEW 2026-10-29 16:06] The header stays available while scrolling: it is fixed to the top, becomes compact with
  a solid background after the visitor scrolls past the hero, and on narrow screens collapses into a menu button that opens
  a full-screen menu.
  - Acceptance criteria:
    - Given a viewport narrower than the tablet breakpoint, when the visitor activates the menu button, then a full-screen
      menu opens with all navigation links and "Book a call", focus moves into it, and Escape or the close button closes it
      and returns focus to the menu button.
    - Given the menu is open, when the visitor selects a link, then the menu closes and the page navigates.
    - Given the visitor has scrolled more than the header height, then the header shows its compact solid state.
- REQ-004 [NEW 2026-10-29 16:06] Every public page shows a footer with a large wordmark block, quick links (Work, Writing,
  About, Contact, FAQs), social links and contact email from settings, the current year, and a bottom bar with copyright and
  a short original sign-off.
  - Acceptance criteria:
    - Given settings contain two social links, then both appear in the footer and open in a new tab with
      `rel="noopener noreferrer"`.
    - Given the year changes, then the footer shows the year of the build without a code change.
- REQ-005 [NEW 2026-10-29 16:06] Until a logo is supplied, the brand mark is the text wordmark "MITALI" set in the heading
  font; replacing it with a supplied logo file requires no change to page layouts.
  - Acceptance criteria:
    - Given no logo file exists in `assets/brand/`, then header and footer show the "MITALI" text wordmark with an
      accessible name.
- REQ-006 [NEW 2026-10-29 16:06] Several public pages include an FAQ preview: an accordion of FAQs marked "show in
  preview", with a link to the full FAQs page.
  - Acceptance criteria:
    - Given 6 FAQs are marked for preview, when Home loads, then those 6 appear in display order, all collapsed.
    - Given the FAQ preview appears on Home, Work, About and Contact, then each links to `/faqs`.

### 3.2 Home
- REQ-010 [NEW 2026-10-29 16:06] Home opens with a full-width dark hero: a large uppercase statement, a short
  introduction, a highlighted one-line tagline and two actions ("Book a call" and "View work"), over a soft animated green
  glow.
  - Acceptance criteria:
    - Given a visitor opens Home, then the hero heading is the page's only `h1` and both actions are visible without
      scrolling on a 1440×900 and a 390×844 viewport.
- REQ-011 [NEW 2026-10-29 16:06] Home shows up to 4 featured, published case studies as cards in display order, with a
  "View all work" link.
  - Acceptance criteria:
    - Given 5 published case studies are marked featured, when a visitor opens Home, then the first 4 by display order are
      shown.
    - Given a featured case study is unpublished, then it is not shown.
- REQ-012 [NEW 2026-10-29 16:06] Home shows the services as an expandable list: each service shows its name and expands to
  its description and deliverables.
  - Acceptance criteria:
    - Given 5 published services, when the visitor activates a service row (mouse, touch or keyboard), then its description
      and deliverables are revealed and the expanded state is announced to assistive technology.
- REQ-013 [NEW 2026-10-29 16:06] Home shows the engagement models as cards, each with a name, description, a checklist of
  features and an action that leads to booking or contact.
  - Acceptance criteria:
    - Given 3 published engagement models, then 3 cards are shown in display order, each with its features as a list.
- REQ-014 [NEW 2026-10-29 16:06] Home and About show a personal story block with Mitali's portrait and short bio from the
  profile.
  - Acceptance criteria:
    - Given the profile has a portrait and 3 bio paragraphs, then the block shows the portrait with alt text and the 3
      paragraphs.
- REQ-015 [NEW 2026-10-29 16:06] Home shows a testimonial carousel with previous/next controls and position indicators
  that works with mouse, touch and keyboard.
  - Acceptance criteria:
    - Given 5 published testimonials, when the visitor activates "next" on the last one, then the first one is shown.
    - Given keyboard focus is on a control, when Enter or Space is pressed, then the slide changes and the new quote is
      announced politely.
    - The carousel does not advance on its own.

### 3.3 Work and case studies
- REQ-020 [NEW 2026-10-29 16:06] The Work page lists all published case studies as cards (cover image, title,
  campaign-type chip, summary) in display order; each card links to its case-study page.
  - Acceptance criteria:
    - Given 6 published and 1 unpublished case study, when a visitor opens Work, then 6 cards are shown in display order.
- REQ-021 [NEW 2026-10-29 16:06] A case-study page at `/work/<slug>` shows a full-width cover, a details block (client,
  year, industry, timeline, campaign type, channels), problem, solution, a results row, an ordered image gallery of
  full-width and half-width tiles, and a "More work" strip with 2 other published case studies and a link to Work.
  - Acceptance criteria:
    - Given a published case study with 3 results, then the results row shows each metric label, value and (when present)
      the change.
    - Given gallery images with layouts full, half, half, then the first spans the content width and the next two sit side
      by side on desktop and stack on mobile.
    - Given 6 published case studies, then "More work" shows 2 case studies other than the current one.
- REQ-022 [NEW 2026-10-29 16:06] Unpublished or unknown case studies and writing samples are not reachable on the public
  site.
  - Acceptance criteria:
    - Given a case study is unpublished, when a visitor requests its URL, then the not-found page is shown with status 404.
    - Given a case study is unpublished, then it does not appear in any list, the sitemap or the "More work" strip.
- REQ-023 [NEW 2026-10-29 16:06] Results and other content seeded as sample data are labelled "Sample data" on the public
  site until replaced or the flag is cleared by the admin.
  - Acceptance criteria:
    - Given a case study result is flagged as sample, then a visible "Sample data" note appears next to the results row.

### 3.4 Writing
- REQ-030 [NEW 2026-10-29 16:06] The Writing page lists published writing samples as cards (thumbnail, title, format
  chip, excerpt) and can be filtered by format: blog, web copy, email, social, landing page, newsletter.
  - Acceptance criteria:
    - Given the visitor selects the filter "email", then only email samples are shown and the URL reflects the filter
      (for example `/writing?format=email`).
    - Given a visitor opens `/writing?format=email` directly, then the email filter is active on load.
    - Given no sample matches the filter, then an empty-state message is shown with a way to clear the filter.
    - Given JavaScript is unavailable, then all samples are listed (the filter is an enhancement).
- REQ-031 [NEW 2026-10-29 16:06] A writing-sample page at `/writing/<slug>` shows the title, format, client, date,
  reading time, tags and the full text.
  - Acceptance criteria:
    - Given a published sample with a formatted body (headings, lists, links), then the body renders with that formatting
      and without any executable script.

### 3.5 About, FAQs, Contact
- REQ-040 [NEW 2026-10-29 16:06] The About page shows a statement hero, an origin statement, a two-part vision block,
  four values, four process steps laid out as a descending staircase on desktop (stacked on smaller screens), the personal
  story block, an FAQ preview and a closing call-to-action band.
  - Acceptance criteria:
    - Given 4 published values and 4 process steps, then all appear in display order, and process steps keep their reading
      order for screen readers regardless of the staircase layout.
- REQ-041 [NEW 2026-10-29 16:06] The FAQs page shows all published FAQs grouped by category; each group is an accordion
  (two columns on desktop, one on mobile), followed by a call-to-action band. FAQs is linked from the footer.
  - Acceptance criteria:
    - Given 4 categories with 16 FAQs, then 4 groups appear in category order with their FAQs in display order.
    - Given an accordion item has keyboard focus, when Enter or Space is pressed, then it toggles and `aria-expanded`
      reflects its state.
- REQ-042 [NEW 2026-10-29 16:06] The Contact page shows a heading, a short promise line, the contact email from settings
  and an enquiry form with name, email, enquiry type (content strategy, copywriting, SEO content, brand messaging, campaign
  planning, other), budget range (optional), company (optional) and message, plus a short privacy note.
  - Acceptance criteria:
    - Given valid input, when the visitor submits, then the enquiry is stored with status "new" and a confirmation message
      replaces the form.
    - Given name, email or message is missing, or the email is malformed, then field-level errors are shown, focus moves to
      the first invalid field, and nothing is stored.
    - Given the server rejects or cannot be reached, then an error message is shown and the visitor's input is kept.
- REQ-043 [NEW 2026-10-29 16:06] The contact form is protected against abuse: a hidden honeypot field and a per-client
  submission rate limit; validation is enforced on the server regardless of the browser.
  - Acceptance criteria:
    - Given the honeypot field is filled, when the form is submitted, then the visitor sees the normal confirmation but no
      enquiry is stored.
    - Given more than 5 submissions from the same client within 10 minutes, then further submissions are rejected with a
      "try again later" message until the window passes.

### 3.6 SEO and publishing
- REQ-050 [NEW 2026-10-29 16:06] Public pages are delivered as pre-rendered HTML with their content present before
  JavaScript runs, each with its own title, meta description, canonical URL and Open Graph tags (title, description,
  image).
  - Acceptance criteria:
    - Given the site has been built, when `/work/<slug>` is fetched without running JavaScript, then the HTML contains the
      case-study title, summary, a unique `<title>`, meta description, canonical link and `og:image`.
- REQ-051 [NEW 2026-10-29 16:06] The build produces `sitemap.xml` listing every published public page and `robots.txt`
  that excludes `/admin`; admin pages carry `noindex`.
  - Acceptance criteria:
    - Given 6 published case studies and 12 published writing samples, then `sitemap.xml` lists the 6 static pages plus
      18 detail pages and nothing under `/admin`.
- REQ-052 [NEW 2026-10-29 16:06] Content changes made in the admin area reach the public site when a "rebuild site"
  command is run; the admin area tells Mitali when content has changed since the last rebuild.
  - Acceptance criteria:
    - Given Mitali edits a case study title, when the rebuild command completes, then the public page shows the new title.
    - Given content changed after the last rebuild, then the admin dashboard shows a "Site needs rebuilding" notice with
      the command to run.

### 3.7 Admin
- REQ-060 [NEW 2026-10-29 16:06] The admin logs in at `/admin/login` with email and password; the session is held in a
  secure HttpOnly cookie, expires after inactivity, and logout ends it. There is no public sign-up.
  - Acceptance criteria:
    - Given correct credentials, when the admin logs in, then the admin dashboard opens.
    - Given wrong credentials, then a generic "email or password is incorrect" message is shown (no hint which was wrong).
    - Given the admin logs out, when any admin page or admin API is requested with the old session, then access is refused
      and the login page is shown.
    - Given no session, when any `/admin` page other than login is opened, then the visitor is redirected to login.
- REQ-061 [NEW 2026-10-29 16:06] Repeated failed logins are throttled.
  - Acceptance criteria:
    - Given 5 failed login attempts for the same account or client within 15 minutes, then further attempts are blocked
      for 15 minutes with a "too many attempts" message, even with the correct password.
- REQ-062 [NEW 2026-10-29 16:06] The admin account is created and its password reset only through a command-line tool;
  the tool enforces a minimum password strength.
  - Acceptance criteria:
    - Given no admin exists, when the create-admin command runs with an email and a password of at least 12 characters,
      then the admin can log in.
    - Given a password shorter than 12 characters, then the command refuses it.
    - Given a password reset by the command, then existing sessions end.
- REQ-063 [NEW 2026-10-29 16:06] The admin can create, edit, publish/unpublish, reorder and delete case studies,
  including their results and gallery images (upload, alt text, full/half layout, order).
  - Acceptance criteria:
    - Given the admin saves a case study with a duplicate slug, then a validation error is shown and nothing is saved.
    - Given the admin uploads a gallery image without alt text, then saving is refused until alt text is provided.
    - Given the admin uploads a file that is not a JPEG, PNG, WebP or SVG image, or is larger than 10 MB, then the upload
      is rejected with a clear message.
    - Given the admin drags or moves an item up/down, then the new display order is saved and used on the public site after
      rebuild.
    - Given the admin deletes a case study, then a confirmation is required, and its results and gallery entries are
      removed with it.
- REQ-064 [NEW 2026-10-29 16:06] The admin can create, edit, publish/unpublish, reorder and delete writing samples
  (including thumbnail and a formatted body), services, engagement models, testimonials, FAQ categories and FAQs (including
  the "show in preview" flag), values and process steps.
  - Acceptance criteria:
    - Given the admin unpublishes a testimonial, then after rebuild it no longer appears in the carousel.
    - Given the admin deletes an FAQ category that still contains FAQs, then deletion is refused with a message to move or
      delete those FAQs first.
- REQ-065 [NEW 2026-10-29 16:06] The admin can edit the profile (name, headline, bio, skills, tools, years of
  experience, origin statement, vision blocks, portrait) and site settings (contact email, booking URL, social links,
  footer sign-off, notification email placeholder).
  - Acceptance criteria:
    - Given the admin enters an invalid email or URL in settings, then a field error is shown and nothing is saved.
- REQ-066 [NEW 2026-10-29 16:06] The admin can list enquiries (newest first, filterable by status), open one to read it,
  and change its status between new, replied and archived.
  - Acceptance criteria:
    - Given 3 new and 1 archived enquiry, when the admin filters by "new", then 3 enquiries are shown.
    - Given the admin marks an enquiry "replied", then the list shows the new status.
    - The admin dashboard shows the count of enquiries with status "new".
- REQ-067 [NEW 2026-10-29 16:06] The admin can clear the "sample data" flag on any case study, result or writing sample.
  - Acceptance criteria:
    - Given the admin clears the flag on a case study's results, then after rebuild the "Sample data" note no longer
      appears for that case study.

### 3.8 Data and setup
- REQ-070 [NEW 2026-10-29 16:06] A re-runnable seed command fills the database with original dummy content themed on
  content writing and marketing strategy: 6 case studies (4 featured) with 18 sample results and gallery images,
  12 writing samples across all formats, 5 services, 3 engagement models, 5 testimonials from fictional clients, 16 FAQs in
  4 categories (6 marked for preview), 4 values, 4 process steps, the profile and site settings; 4 enquiries are seeded in
  development only.
  - Acceptance criteria:
    - Given the seed has run once, when it runs again, then the record counts are unchanged (no duplicates).
    - Given the environment is not development, then no enquiries are seeded.
    - All seeded case studies, results and writing samples are flagged as sample data.
- REQ-071 [NEW 2026-10-29 16:06] All placeholder images (case-study covers and gallery tiles, writing thumbnails,
  portrait) are generated locally by the seed; nothing is downloaded from or linked to any third-party site, and no text,
  image, logo, font or data from the reference site is used.
  - Acceptance criteria:
    - Given the seed has run, then every image path in the database points to a file inside the project's media folder.
- REQ-072 [NEW 2026-10-29 16:06] The project includes a database setup script that the user runs with their own
  PostgreSQL superuser credentials to create the application role and the development and test databases; application
  credentials are read from a git-ignored environment file, with a committed example file.
  - Acceptance criteria:
    - Given the user runs the setup script against PostgreSQL 17 on port 5442, then the databases `mitali_portfolio` and
      `mitali_portfolio_test` exist and are owned by the application role.
    - The repository contains `.env.example` and no `.env`.

## 4. Non-functional requirements
- REQ-NFR-001 [NEW 2026-10-29 16:06] Responsive layout from 360 px wide phones to 1920 px desktops, with mobile, tablet
  and desktop layouts; no horizontal scrolling at any width from 360 px.
- REQ-NFR-002 [NEW 2026-10-29 16:06] Accessibility: public and admin pages meet WCAG 2.1 AA (contrast, visible focus,
  keyboard operation of menu, accordions, carousel, filters and forms, labelled form fields, alt text). The neon green is
  never used for text or icons on cream or white.
- REQ-NFR-003 [NEW 2026-10-29 16:06] Motion (hero glow, scroll reveals, hover effects, accordion and carousel transitions)
  is subtle and is turned off when the visitor's system requests reduced motion.
- REQ-NFR-004 [NEW 2026-10-29 16:06] Performance: on a local production build, each public page scores at least 90 for
  Performance, Accessibility, Best Practices and SEO in Lighthouse (mobile profile); images are served in sizes appropriate
  to their display width.
- REQ-NFR-005 [NEW 2026-10-29 16:06] Privacy and security: enquiry data and the admin session are protected (no secrets
  in the repository, passwords stored only as strong one-way hashes, admin endpoints require a valid session, state-changing
  admin requests are protected against cross-site request forgery). Enquiries are kept until the admin deletes or archives
  them.
- REQ-NFR-006 [NEW 2026-10-29 16:06] The project runs locally on the user's Windows machine (PostgreSQL 17 on port 5442,
  Python 3.12, Node.js) without Docker; setup and run steps are documented in a README.
- REQ-NFR-007 [NEW 2026-10-29 16:06] All styling uses the design tokens in `docs/design-brief.md`; fonts are self-hosted
  open-licence fonts (Antonio, Public Sans).
- REQ-NFR-008 [NEW 2026-10-29 16:06] Scale: one admin and low public traffic; budget minimal (no paid services required to
  run the project locally).

## 5. Out of scope
- Blog comments, newsletter sign-up, analytics, cookie banner, multiple languages, payments.
- Cloud hosting, infrastructure, CI/CD and a production deployment (to be added through `/feature` later).
- Sending email notifications for enquiries (only a settings placeholder exists).
- Public user accounts, multiple admins, roles, password reset by email.
- A theme switch (the site has one fixed theme with alternating dark and cream sections).
- Mobile apps.
- Copying any text, images, logo, fonts, code or data from the reference site.

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
