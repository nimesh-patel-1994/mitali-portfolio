# Intake: mitali-portfolio

> The agreed starting brief from the discussion in the toolkit session (gate G1 passed on 2026-10-29).
> `/init-project` reads this file and turns it into the project documents. It is not a project document itself;
> after `/init-project` finishes, `docs/` is the source of truth.

## 1. Idea and scope
A personal portfolio website for Mitali, a content writer and marketing strategist, using the structure, interactions and
bold dark/neon-green visual language of the reference site, with entirely original text and dummy data. It showcases her case
studies, writing samples, services and testimonials, and turns visitors into enquiries through a contact form and a
"book a call" link. Mitali manages the content herself through an admin area.

**In scope**
- Public site: Home, Work (list + case study detail), Writing (list + sample detail), About, Contact, FAQs.
- Admin area at `/admin` in the same React app for content and enquiries.
- Seed script with dummy data themed on content writing and marketing strategy; generated placeholder images.
- Local development only.

**Out of scope (for now)**
- Blog comments, newsletter signup, analytics, multi-language, payments.
- Cloud hosting and infrastructure (can be added later).
- Outbound email notifications (setting placeholder only).
- Copying any text, images, logo, fonts or data from the reference site.

## 2. Users and roles
- **Visitor** (anonymous): browses the public site, submits the contact form, follows the booking link.
- **Admin** (Mitali, a single account): logs in to manage content, settings and enquiries. No public sign-up; the account is
  created by a CLI command.

## 3. Concluded requirements
Public site
1. Home page shows: hero statement, featured case studies (up to 4), services grid, engagement models, a personal story block,
   testimonial carousel, FAQ preview, footer with large wordmark.
   - Given featured case studies exist, when a visitor opens Home, then up to 4 featured ones are shown in display order.
2. Work page lists all published case studies as cards; each links to a case study page.
3. Case study page shows cover, details block (year, industry, timeline, campaign type, channels), problem, solution, a results
   row (metric label, value, optional change), an image gallery (full and half-width tiles) and a "more work" strip with 2 other
   case studies.
   - Given a case study is unpublished, when a visitor requests its URL, then a 404 page is shown.
4. Writing page lists published writing samples and can be filtered by format (blog, web copy, email, social, landing page,
   newsletter); each sample has a detail page.
   - Given the filter "email" is selected, then only email samples are shown and the filter state is reflected in the URL.
5. About page shows origin/story, vision, values (4), process steps (4, staircase layout), and a closing call-to-action band.
6. Contact page has a form: name, email, enquiry type, budget range (optional), message; plus the contact email.
   - Given valid input, when submitted, then the enquiry is stored with status "new" and a confirmation is shown.
   - Given invalid input (missing name/email/message or bad email), then field errors are shown and nothing is stored.
   - Submissions are rate-limited and include a honeypot field for spam.
7. FAQs page shows FAQs grouped in categories as accordions; FAQs are also linked from the footer.
8. Header navigation: Work, Writing, About, Contact, plus a "Book a call" button using a configurable link (placeholder for now).
   Header behaviour on scroll and the mobile menu are to be designed (not observable on the reference).
9. Placeholder wordmark "MITALI" in the heading font until a logo is supplied.
10. SEO: public pages are pre-rendered to static HTML at build time with per-page title, meta description, Open Graph tags,
    canonical URL, `sitemap.xml` and `robots.txt`. `/admin` is excluded from indexing.

Admin area
11. Admin logs in with email and password; session is a secure HttpOnly cookie; failed logins are rate-limited; logout ends the
    session. Password reset via CLI only.
    - Given wrong credentials 5 times in a short window, then further attempts are temporarily blocked.
12. Admin can create, edit, publish/unpublish, reorder and delete: case studies (with results and gallery image uploads),
    writing samples, services, engagement models, testimonials, FAQ categories and FAQs, values, process steps.
13. Admin can edit the profile (bio, skills, tools, portrait) and site settings (contact email, booking URL, social links,
    notification email placeholder).
14. Admin can list and view enquiries and change their status (new, replied, archived).
15. Content changes reach the public site by re-running a "rebuild site" command (pre-render step).

Data
16. A re-runnable seed script fills dummy content: 6 case studies (4 featured) with 18 sample metrics, 12 writing samples,
    5 services (content strategy, copywriting, SEO content, brand messaging, campaign planning), engagement models,
    5 testimonials from fictional clients, 16 FAQs in 4 categories, 4 values, 4 process steps, profile, settings;
    enquiries seeded in development only. Images are generated SVG placeholders. Sample metrics are flagged as sample data.

## 4. Non-functional needs
- Responsive from 360 px phones to desktop (content width ~1100 px); tablet layouts to be designed.
- Accessibility: WCAG 2.1 AA; neon green is never used as text on cream (fails contrast ~1.3:1).
- Motion respects `prefers-reduced-motion`.
- Performance: pre-rendered public pages, optimised images, good Lighthouse scores on public pages.
- Scale: a single-owner portfolio; low traffic. Budget: minimal. No compliance regime beyond basic privacy for enquiries.
- No deadline stated.

## 5. Stack decisions (each layer chosen by the developer)
| Layer | Choice | Why | Alternatives considered |
|-------|--------|-----|-------------------------|
| Backend | Python FastAPI (`python-fastapi`) | Developer's choice; serves admin API, auth, uploads, contact form | .NET |
| Web app(s): role + stack | One React app (`react`, Vite + TypeScript): public site pre-rendered to static HTML at build time, plus `/admin` as a client-rendered section | Keeps the chosen stack while giving SEO and shareable link previews | Next.js (best SEO, different framework); plain React SPA (weak SEO) |
| Mobile | None | Not needed | — |
| Database | PostgreSQL 17 (`postgresql`), local Windows install on port 5442 | Relational content with ordering and relations; already installed | MySQL, MongoDB |
| Cloud / IaC | None for now (local only) | Hosting deferred | Azure + Terraform later |
| Auth | Single admin, email + password (strong hash), HttpOnly session cookie, login rate limit, CLI password reset | One user, minimal surface | JWT in local storage (rejected) |

## 6. Design inputs
- Reference designs / URLs: https://www.studiobrag.com — take layout, sections, components, interactions and visual
  language; do not copy brand name, logo, text, photos, licensed fonts or code. Rights: inspiration only.
- Logo file: none yet. Use the "MITALI" text wordmark placeholder; the user will add the logo later.
- Primary colour / accent: as the reference palette — primary #70FF00 (neon green), dark #030500, dark olive #0F1C00,
  cream #FFFDE9, muted text #63635A.
- Light and dark mode, fonts: no theme toggle; alternating dark and cream sections as on the reference. Headings: Antonio
  (Google Fonts, OFL) replacing the reference's licensed condensed display font; body: Public Sans (OFL). Flat style, no
  shadows, 6 px radius, tilted green "tape" shapes behind section headings. Web only.

### Reference site (if /replicate was used)
- URL and rights: https://www.studiobrag.com — inspiration only (the user asked to replicate everything; ownership or
  permission was not confirmed, so the strict branding rule applies).
- What is replicated: layout and sections, interactions and motion, visual language (colour palette as the user requested).
  Not copied: name, logo, text, photos, client names, licensed fonts, code, data.
- Notes: `.dev-pipeline/reference/reference-notes.md` (screenshots in `.dev-pipeline/reference/screenshots/`, git-ignored)
- Content rule: all text, images and data are original or dummy; nothing is hot-linked from the reference.
- Additions beyond the reference: Writing page with format filter and detail pages, results row on case studies, enquiry
  type and budget on the contact form, admin area.

## 7. Environment check results
- Git 2.55.0: OK.
- Node.js v26.13.0, npm 11.20.0: OK.
- Python 3.12.6, pip 26.2.1: OK.
- PostgreSQL: versions 16 (port 5432) and 17 (port 5442) installed as Windows services, both running. **Use 17 on port 5442.**
  psql 17.11 works at `C:\Program Files\PostgreSQL\17\bin\psql.exe` but is not on PATH; agents call it by full path (the user
  may add it to PATH). Connection settings must state port 5442 explicitly.
- Docker 29.8.1 installed, engine not running. Decision: Docker is not needed initially; integration tests use a local test
  database (`mitali_portfolio_test`) on PostgreSQL 17 instead of test containers.
- Agents run on this Windows machine.

## 8. Open questions and risks
- Database setup needs the PostgreSQL 17 superuser password, which only the user has: provide a script the user runs to create
  the app role and the `mitali_portfolio` / `mitali_portfolio_test` databases; credentials live in a git-ignored `.env` with a
  `.env.example`. Never ask for the password in chat.
- Real logo, contact email, booking link and social links: placeholders until supplied.
- Real case studies, metrics and permission to name clients: dummy data until supplied.
- Header scroll behaviour, mobile menu, motion details and tablet breakpoints were not observable on the reference; design them.
- Pre-rendering approach for React (Vite) to be chosen in system design/tech spec.
- Email notifications for enquiries: deferred; placeholder setting only.
- Hosting/cloud: deferred.
