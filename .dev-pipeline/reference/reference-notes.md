# Reference notes: mitali-portfolio

> Written by the `reference-analyst` agent from a capture of https://www.studiobrag.com on 2026-10-29 15:52.
> These are OBSERVATIONS about structure, behaviour and design language. No text, images, logos, fonts or code from the
> reference are copied here or into the project. Everything the project ships is original or dummy content.

Capture basis: 9 pages (limit 12, 0 skipped, robots.txt respected), one desktop screenshot (1440 px wide) and one mobile
screenshot (390 px wide) per page, `analysis.json` with computed styles, and 16 network calls recorded as shapes.
Values marked **(observed)** come from `analysis.json`; values marked **(estimated)** were measured by eye from scaled-down
screenshots; anything marked **(guess)** was not observed.

## 1. Rights and scope
- Reference: https://www.studiobrag.com (a branding/advertising studio site, built with the Framer site builder).
- Rights: **inspiration only.** The user asked to "copy everything" but did not confirm owning the site or having the
  owner's permission. Branding rules therefore apply in full. The user explicitly asked for the reference's colours as the
  project's primary colours and will supply their own logo later; copying the colour palette is accepted on that basis.
- What to replicate: page structure and section order, layout patterns, component behaviour (accordions, carousel, card
  grids, case-study layout, contact form), interactions and motion as far as they can be inferred, and the visual language
  (colour palette, condensed uppercase display type paired with a neutral grotesque, tilted highlight "tape" shapes,
  dark/cream section alternation).
- What we deliberately do NOT copy: brand name, wordmark/logo (the giant footer wordmark is replaced by the user's own name
  or logo), all headings and copy (including the playful brand-name puns used in headings and buttons), client names,
  case-study images and client logos, the founder photo and biography, testimonials, FAQ wording, the custom display font,
  source code, and the third-party booking link.

## 2. Site map
Main navigation (observed, same on all pages): logo/home link, Work, About, Contact, plus an external "book a call" link
to a third-party scheduling service. The footer adds an FAQs link and two social links.

| Page | Purpose | Main sections (in order) |
|------|---------|--------------------------|
| Home `/` (6543 px desktop, 9100 px mobile) | Introduce the studio and funnel to work and contact | Hero (dark) > Featured work 2x2 grid (cream) > Services grid (dark olive) > Engagement models, 3 pricing-style cards (cream) > Founder/"why we exist" story (cream) > Testimonial carousel (dark olive) > FAQ preview, 6 items (cream) > Footer (dark olive) |
| Work `/projects` (2496 / 4035 px) | Index of all case studies | Page heading with tape highlight > 2x2 project card grid (4 projects observed, no filters, no pagination) > FAQ preview (6 items) > Footer |
| Case study `/projects/<slug>` (4 captured: 9599 to 12860 px desktop) | One project in depth | Full-bleed cover image with client logo (about 900 px tall) > Meta block: title with tape, category chip, rows Year / Industry / Timeline > "Problem" heading + paragraph > "Solution" heading + paragraph > Long image gallery (full-width and two-column tiles: logo, colour swatches, type specimen, mock-ups, signage, merchandise, screens) > "More work" strip: 2 other project cards + View all link > FAQ preview (on some pages) > Footer |
| About `/about` (7008 / 6552 px) | Studio story, values and process | Hero (dark, giant statement, intro + 2 buttons) > Origin statement (cream, label + large bold paragraph) > Two-column vision/daily-practice block (dark olive) > Values list, 4 large headings with short paragraphs (cream) > Process, 4 steps in a staggered diagonal layout (dark olive) > Founder story (same component as home) > FAQ preview (5 items) > Closing CTA band (dark, huge 2-line statement, 2 buttons) > Footer |
| Contact `/contact` (2127 / 2755 px) | Lead capture | Two-column block (dark olive): left giant heading, one-line promise, email with mail icon; right form (Name, Email, Company, Message, full-width submit, consent note) > FAQ preview (6 items) > Footer |
| FAQs `/faqs` (2870 / 3721 px, footer link only) | Full FAQ | Page heading with tape > 4 categories, each a sub-heading and a 2-column accordion (6, 5, 3 and 2 questions = 16) > Closing CTA band (2-line statement, 2 buttons) > Footer |
| Book a call (external) | Scheduling | Third-party booking page; not captured |

## 3. Section and component inventory
| Component | Where it appears | Layout pattern | Content type | Our replacement |
|-----------|------------------|----------------|--------------|-----------------|
| Site header / nav | All pages | Not visible in screenshots: a solid near-black band about 70-100 px tall sits at the top of every capture (estimated); 2 fixed/sticky elements were detected (observed) | Logo + 3 links + booking link | Fixed header with the user's logo placeholder (wordmark), Work / About / Contact, primary "book a call" button |
| Hero (statement) | Home, About | Dark background; left: 2-3 line uppercase display headline at 136 px in neon green; right column lower down: short intro paragraph, one green tagline line, two buttons (solid green, solid cream); a blurred neon-green glow rising from the bottom edge (home only) | Statement, intro, 2 CTAs | Original headline about Mitali's practice; glow as a CSS radial/blurred gradient, not an image |
| Section heading with tape | Every section heading on cream and dark | Uppercase condensed heading with a small neon-green rectangle, slightly rotated, sitting behind the first letters | Heading | `SectionHeading` component with a decorative rotated `::before` block |
| Tape divider shapes | Section boundaries (home, about, contact, faqs) | Larger rotated neon-green rectangles overlapping the seam between a dark and a cream section, alternating left/right | Decoration | Decorative absolutely positioned blocks, `aria-hidden` |
| Project card | Home, Work, case-study "more work" strip | 2-column grid; 16:9 image (cover with client logo), uppercase title left, small outlined category chip right, 3-4 line grey description; about 20 px gutter | Project summary | `ProjectCard` for case studies (campaign-type chip), reused for writing samples (format chip); generated cover image |
| "View all" link | Featured work and more-work strips | Small text link with an arrow, top-right of the section | Link | Same pattern |
| Services grid | Home | Dark olive; 3 columns x 2 rows of rows: uppercase service name left, plus icon right, thin divider below | 6 services | Expandable service list (guess: expands to a description) |
| Engagement-model cards | Home | 3 equal dark-olive cards on cream; green uppercase title, short description, checklist (6 items each, circular check icons), full-width-bottom green "book" button aligned bottom-right | Ways to work with the studio | 3 original engagement models for Mitali |
| Founder story | Home, About | Cream; left a large black-and-white portrait with a green tape shape on its corner; right column of short paragraphs and a signature line | Bio | Generated monochrome portrait placeholder + original bio |
| Testimonial carousel | Home | Dark olive; centred large quote (about 24-28 px, cream, estimated), name in display caps and role right-aligned below, square prev/next arrow buttons at the far left and right edges, dot indicators (2 slides observed) | Quotes | `TestimonialCarousel` with invented testimonials |
| FAQ accordion | Home, Work, About, Contact, case studies, FAQs | 2-column list on desktop, single column on mobile; question in body font left, thin plus icon right, hairline dividers; FAQs page groups them under category sub-headings | Q&A | `Accordion` fed from FAQ entity |
| Origin statement | About | Small tape label left, large bold sentence-case paragraph (about 26 px, estimated) offset right | Statement | Original statement |
| Two-column vision block | About | Dark olive; two columns each with a green display heading and 1-2 paragraphs | Vision / daily practice | Original copy |
| Values list | About | Label left; right column of 4 large uppercase headings (about 48 px) each followed by a short grey paragraph | Values | 4 original values |
| Process steps | About | Dark olive; 4 steps placed in a descending diagonal staircase across the width, each a small green uppercase title and short cream paragraph | Process | 4 original steps |
| Closing CTA band | About, FAQs | Dark olive; 2-line huge green uppercase statement, divider, two buttons | CTA | Original copy |
| Contact form | Contact | Labels above fields with a green asterisk; dark filled inputs (no visible radius), textarea, full-width neon-green submit in display caps, small grey consent line | Lead form | `ContactForm` posting to our FastAPI |
| Case-study meta block | Case studies | Title with tape left, category chip right; three rows (Year, Industry, Timeline) as label-left / value-right with dividers; then "Problem" and "Solution" headings left with paragraphs in the right half | Project metadata | Same layout from Project fields |
| Case-study gallery | Case studies | Stack of edge-to-edge (within container) image tiles: full-width tiles and 2-up tiles with no gaps; mixed aspect ratios; each project's own palette dominates | Project images | `GalleryBlock` list ordered by position, generated images |
| Footer | All pages | Dark olive; giant neon-green wordmark (about 300 px tall, with a small rotated sub-label tile) left; three link columns (green small label, cream uppercase display links): quick links, socials, email; year top-right; bottom bar with copyright, a one-line sign-off, rights notice | Navigation, contact | User's own logo or a typeset name in the display font; original sign-off |
| Buttons | Throughout | Rectangular (0-6 px radius), compact, uppercase condensed label; primary = neon green with dark text, secondary = cream with dark text | Actions | `Button` variants `primary`, `secondary` |

## 4. Interactions and motion
Observed (from DOM and screenshots):
- 2 fixed or sticky elements per page (observed). Most likely the header and possibly a Framer editor/badge element (guess).
- Only 1 element with a CSS transition/animation at capture time; no motion library detected (observed). Framer's own
  runtime animations (appear/scroll effects) would not show up as a named library, so this does not prove there is no motion.
- Accordions with a plus icon on services and FAQs (observed static state: all closed). Open-state styling, icon rotation and
  whether several can be open at once were not observed.
- Testimonial carousel with prev/next buttons and dot indicators, 2 slides (observed). Autoplay and transition style unknown.
- External "book a call" link opens a third-party scheduler (observed href); whether it opens in a new tab is unknown.
- Mobile: navigation was not reported as collapsed (`navCollapsed: false`) but the nav is not visible in any mobile
  screenshot, so the mobile menu pattern is unknown.

Not judgeable from stills (proposed defaults, mark as our design decision, not observation):
- Hero glow: suggest a slow subtle drift of the green gradient; respect `prefers-reduced-motion`.
- Section reveal: suggest a short fade/translate-up on scroll (200-400 ms).
- Card hover: suggest slight image zoom (scale 1.03) and title underline.
- Button hover: suggest colour inversion (green to cream) with 150 ms transition.
- Page transitions: none assumed.

## 5. Design language (input for design-brief.md)

### Colour roles (observed, from `analysis.json`)
| Role | Observed value | Hex | Proposed token |
|------|----------------|-----|----------------|
| **Primary / accent** (headlines on dark, buttons, tape shapes, labels, footer wordmark) | rgb(112, 255, 0) | **#70FF00** (neon lime green) | `color-primary` |
| Primary tint (subtle fills) | rgba(110, 255, 0, 0.2) | #6EFF00 at 20 % | `color-primary-tint` |
| Dark section surface, dark text on cream | rgb(15, 28, 0) | **#0F1C00** (very dark olive) | `color-surface-dark` / `color-text` |
| Page background (behind everything, hero, header band) | rgb(3, 5, 0) | **#030500** (near black) | `color-bg-deepest` |
| Near-black variant | rgb(3, 4, 0) | #030400 | merge into `color-bg-deepest` |
| Light section surface, text on dark | rgb(255, 253, 233) | **#FFFDE9** (warm cream) | `color-surface-light` / `color-text-inverse` |
| Muted body text on cream | rgb(99, 99, 90) | #63635A | `color-text-muted` |
| Other observed | rgb(255,255,255), rgb(250,250,250), rgb(102,102,102) | #FFFFFF, #FAFAFA, #666666 | `color-white`, `color-neutral-50`, `color-neutral-500` |
| Form field fill on dark | not in analysis; looks like a slightly lighter olive grey (estimated) | about #2A3220 (guess) | `color-input-bg` |

Primary is **#70FF00**; the accent role is carried by the dark olive **#0F1C00** and cream **#FFFDE9** pair rather than a
second hue. The site has no dark/light toggle; it alternates dark and cream sections.

Contrast (computed from the observed values, WCAG relative luminance):
- #70FF00 on #0F1C00: about 13.5:1 (pass) - green headlines on dark.
- #0F1C00 on #70FF00: about 13.5:1 (pass) - button labels.
- #FFFDE9 on #0F1C00: about 17:1 (pass).
- #0F1C00 on #FFFDE9: about 17:1 (pass).
- #63635A on #FFFDE9: about 5.8:1 (pass for body text).
- **#70FF00 on #FFFDE9: about 1.3:1 (FAIL).** The reference never uses green as text on cream, only as a decorative tape
  shape behind dark text. Rule for us: green is never text or an icon colour on cream or white.

### Typography
| Use | Observed family | Licence status | What we use |
|-----|-----------------|----------------|-------------|
| Display (h1-h3, buttons, nav, footer links) | "New Title" (weights 500 and 700), a tall, very condensed uppercase grotesque | Not a known public family; appears to be a custom or commercially licensed font (guess, licence not verifiable). **Do not use.** | **Antonio** (Google Fonts, SIL Open Font License 1.1, weights 100-700) as closest condensed match; fallback options **Oswald** (OFL) or **Bebas Neue** (OFL, single weight) |
| Body, labels, form text | "Public Sans" (400, 600, 700) | Free, SIL Open Font License 1.1 (on Google Fonts) | **Public Sans** (OFL), self-hosted from the Google Fonts release, not from the reference |

Type scale (observed, desktop 1440 px):
| Element | Size / line-height | Weight | Case | Letter-spacing | Colour |
|---------|--------------------|--------|------|----------------|--------|
| h1 hero (home, about, contact) | 136 / 122.4 px (0.9) | 700 | uppercase | normal | #70FF00 |
| h1 inner pages (work, case study) | 48 / 43.2 px | 700 | uppercase | 0.96 px (0.02 em) | #0F1C00 |
| h2 section heading | 48 / 43.2 px | 700 | uppercase | 0.96 px | #0F1C00 (green on dark) |
| h3 card/service title | 36 / 32.4 px | 500 | uppercase | 0.72 px (0.02 em) | #0F1C00 or #70FF00 |
| p (sampled) | 16 / 19.2 px (1.2) | 600 | reported uppercase for the sampled element, but paragraphs in screenshots are sentence case | -0.32 px (-0.02 em) | #FFFDE9 |
| Body paragraphs (estimated) | about 14-16 px, line-height about 1.5 | 400 | sentence case | normal | #63635A on cream |
| Buttons / small labels | about 14-16 px display font (estimated; the computed 12 px value was from an unstyled element) | 500-700 | uppercase | - | - |

Proposed tokens: `font-display: "Antonio", "Oswald", sans-serif`; `font-body: "Public Sans", system-ui, sans-serif`;
`text-hero: 136/0.9` (clamp to about 56 px on mobile, estimated from the mobile screenshot), `text-h2: 48/0.9`,
`text-h3: 36/0.9`, `text-body: 16/1.5`, `text-small: 14/1.4`, `tracking-display: 0.02em`.

### Spacing, grid, radii, shadows
- Container: no max-width rule found (observed). Content column measured at about 1100 px inside a 1440 px viewport,
  about 170 px side margins (estimated); footer runs wider with about 60 px margins (estimated).
  Proposed `container-max: 1100px`, `container-wide: 1320px`.
- Grid: 2 columns for project cards and FAQs (gutter about 20-40 px, estimated); 3 columns for services and engagement
  cards; case-study galleries use 1-up and 2-up tiles with no gap.
- Vertical rhythm: sections about 120-160 px top/bottom padding on desktop (estimated). Proposed spacing scale 4, 8, 12,
  16, 24, 32, 48, 64, 96, 128, 160 px.
- Radii (observed): 6 px (6 uses), 50 % (round icons/dots), 50 px (one pill). Buttons and inputs look square-cornered.
  Proposed `radius-sm: 6px`, `radius-full: 9999px`, buttons `0` to `radius-sm`.
- Shadows: none (observed). Flat design; depth comes from colour blocks and rotated tape shapes.
- Dividers: 1 px hairlines in a low-contrast tone of the section's text colour (estimated).

### Light/dark behaviour
No dark-mode support and no root CSS custom properties (observed). The page itself is a fixed alternation of near-black
or dark-olive sections and cream sections. We ship one theme with the same alternation.

### Responsive behaviour (desktop 1440 vs mobile 390)
- Only two widths were captured; intermediate breakpoints were not observed. Proposed breakpoints: 390-809 mobile,
  810-1199 tablet, 1200+ desktop (guess based on common Framer defaults).
- Mobile: hero headline drops to about 3-4 lines and the intro/buttons stack below; all 2- and 3-column grids collapse
  to one column; engagement cards stack; testimonial quote stays centred with arrows; FAQs become a single list;
  contact form moves below the heading; footer wordmark sits on top with link groups stacked beneath it and the bottom
  bar becomes three stacked lines. Case-study pages get shorter on mobile (about 6000 px vs 10000+ px).

## 6. Data the site shows (shapes only)
The site is a Framer build. Content is delivered from Framer's CMS as opaque binary/JS index chunks (observed
`application/javascript` range requests on case-study pages), so no JSON field names were seen. The only JSON call is a
Framer editor token check, shape `{ message: string }`, which is irrelevant to us. Fields below are inferred from what is
rendered on screen.

| Entity | Fields (types) | Where it appears | Source observed (API call or static) |
|--------|----------------|------------------|--------------------------------------|
| Project | slug (string), title (string), category (string, e.g. a discipline label), summary (text, 3-4 lines), cover_image (image 16:9), year (int), industry (string), timeline (string, e.g. "N weeks"), problem (text), solution (text), featured (bool, guess), sort_order (int, guess) | Home, Work, case study, more-work strip | Framer CMS chunks (opaque) |
| ProjectImage | project (fk), image (image), layout (full / half, inferred from tiles), position (int), alt (string) | Case-study gallery | Framer CMS / static (opaque) |
| Service | name (string), description (text, guess: revealed by the plus icon), position (int) | Home services grid | Static |
| EngagementModel | name (string), description (text), features (list of string, 6 each), cta_label (string), position (int) | Home | Static |
| Testimonial | quote (text), author_name (string), author_role (string), company (string), position (int) | Home carousel | Static |
| FaqCategory | name (string), position (int) | FAQs page | Static |
| Faq | category (fk), question (string), answer (text, not seen open), show_on_home (bool, guess), position (int) | All pages | Static |
| Value | title (string), body (text), position (int) | About | Static |
| ProcessStep | title (string), body (text), position (int) | About | Static |
| Profile / About | name, role, bio paragraphs (list of text), portrait (image), origin statement (text), vision blocks (2 x heading + text) | Home, About | Static |
| SiteSettings | contact_email, booking_url, social links (name + url, 2 observed), footer sign-off | Footer, contact, CTAs | Static |
| ContactSubmission | name (string, required), email (email, required), company (string, optional in DOM but starred in UI), message (text, optional in DOM but starred in UI), created_at; plus hidden extra text inputs (website, company, message, subject, title, description, feedback, notes, details, remarks, comments) which look like an anti-spam honeypot (guess) | Contact | Form POST to the same page; backend not observed |

## 7. Dummy data plan
Project context (from the coordinator): Mitali is a **content writer and marketing strategist**. Every entity, sample value
and seed record below is themed around her work. All client names, people, numbers and copy are fictional and original;
nothing is reused from the reference site's data. Rights stay inspiration only.

Seed script: `backend/app/seed.py` (FastAPI + PostgreSQL), idempotent (upsert by slug or natural key), run with
`python -m app.seed`. Metrics in the seed are illustrative and flagged `is_sample = true` so they can never be mistaken
for real results.

### Entity shapes for our project (adapted from the observed shapes in section 6)
Fields not seen on the reference are our additions and are marked (new).

| Entity | Fields (types) | Maps to reference component |
|--------|----------------|-----------------------------|
| CaseStudy (was Project) | slug, title, client_name (fictional), client_industry, campaign_type, channels (list of string) (new), goals (list of string) (new), summary (text), problem (text), solution (text), year (int), timeline (string), cover_image, featured (bool), sort_order (int), is_sample (bool) | Project cards, case-study page |
| CaseStudyResult (new) | case_study (fk), metric_label (string), before_value (string, optional), after_value (string), change_pct (decimal, optional), period (string), position (int) | Results row in the case-study meta block (our addition; the reference showed only year, industry and timeline) |
| CaseStudyImage (was ProjectImage) | case_study (fk), image, layout (full / half), alt, position | Case-study gallery |
| WritingSample (new) | slug, title, format (enum: blog, web_copy, email, social, landing_page, newsletter), client_name (fictional), industry, excerpt (text, 40-80 words), body (markdown), word_count (int), published_on (date), reading_time_min (int), tags (list of string), thumbnail, featured (bool), is_sample (bool) | New "Writing" listing and detail page, styled like the project card grid (not on the reference) |
| Service | name, description, deliverables (list of string) (new), position | Services grid (expandable) |
| EngagementModel | name, description, features (list of string), cta_label, position | Engagement cards |
| Testimonial | quote, author_name (fictional), author_role, company (fictional), case_study (fk, optional), position | Testimonial carousel |
| FaqCategory / Faq | name, position / category (fk), question, answer, show_on_home (bool), position | Accordions |
| Value | title, body, position | About values list |
| ProcessStep | title, body, position | About staircase |
| Profile | name, headline, bio (list of text), portrait, skills (list of string) (new), tools (list of string) (new), years_experience (int) (new), origin_statement, vision_blocks (2 x heading + text) | Founder story, About |
| SiteSettings | contact_email, booking_url, social_links (list of name + url), footer_signoff | Footer, CTAs |
| ContactEnquiry (was ContactSubmission) | name, email, company, enquiry_type (enum: content_strategy, copywriting, seo_content, brand_messaging, campaign_planning, other) (new), budget_range (string, optional) (new), message, status (enum: new, replied, archived) (new), created_at | Contact form |

### Records and sample values
| Entity | Records | Content plan |
|--------|---------|--------------|
| CaseStudy | 6 (4 featured) | Fictional clients across industries and campaign types, for example: "Verdant Loop" (D2C plant-care brand, product-launch campaign; channels email, Instagram, blog; goal pre-launch waitlist), "Northpeak Ledger" (B2B fintech SaaS, SEO content programme; channels blog, LinkedIn; goal organic sign-ups), "Kesar and Clay" (artisan homeware retailer, festive-season campaign; channels email, Instagram, WhatsApp), "Brightpath Tutors" (edtech, website copy rewrite; channel website; goal demo bookings), "Harbour Wellness Clinic" (healthcare, patient-education content hub; channels blog, newsletter), "Trailmix Travel Co." (travel, brand-messaging refresh; channels website, social). Year 2022-2026, timeline 4-16 weeks, summary 35-55 words, problem and solution 60-90 words each. |
| CaseStudyResult | 3 per case study (18) | Illustrative metrics such as organic traffic +40 % to +180 % over 6 months, email open rate 22 % to 38 %, click-through rate +1.2 to +3.5 points, landing-page conversion 1.8 % to 4.6 %, social engagement rate +60 % to +150 %, waitlist sign-ups 500 to 4,000. All flagged as sample data. |
| CaseStudyImage | 6-8 per case study (about 42) | Generated boards (see below): campaign key visual, channel mock-ups (email layout, social post grid, blog page wireframe), a results chart drawn from the CaseStudyResult rows, a messaging-pillars board with original short phrases. |
| WritingSample | 12 (2-3 per format) | Blog posts (e.g. a guide to building a content calendar for small brands; writing product pages that convert), web copy (homepage and about-page rewrites for the fictional clients), email (a 3-part welcome sequence, an abandoned-cart email, a monthly newsletter), social (caption sets, a LinkedIn thought-leadership series). Bodies are original placeholder prose, 300-900 words long form, 50-200 words short form; dates 2023-2026. |
| Service | 5 | Content strategy, copywriting, SEO content, brand messaging, campaign planning; each with a 1-2 sentence description and 3-5 deliverables (e.g. content audit, editorial calendar, keyword map, messaging framework, campaign brief). |
| EngagementModel | 3 | Project-based (one campaign or content programme), monthly content retainer (a set number of pieces per month), one-off piece (single article, landing page or email sequence); 5-6 original feature bullets each. |
| Testimonial | 5 | From fictional marketing managers and founders at the fictional clients above; 25-40 word quotes about clarity, deadlines and measurable results; clearly invented names. |
| FaqCategory / Faq | 4 categories, 16 questions (6 on home) | Working with Mitali (industries, remote work, time zones), process and timelines (briefs, revisions, turnaround), pricing (per project, per word or retainer, minimum budget), results and ownership (reporting, rights to the copy, SEO expectations). Answers 30-70 words. |
| Value | 4 | e.g. clarity over cleverness, research first, writing that can be measured, respect for the reader's time; 2-sentence bodies. |
| ProcessStep | 4 | Listen (brief and audience research), Plan (strategy and calendar), Write (drafts and revisions), Measure (reporting and iteration). |
| Profile | 1 | Placeholder bio in three short paragraphs (marked for Mitali to replace); skills: content strategy, long-form writing, SEO, brand voice, email marketing, campaign planning, editing; tools (sample list to confirm): Google Analytics, Google Search Console, Semrush, Ahrefs, Notion, Canva, Mailchimp, HubSpot, WordPress; years_experience: placeholder value. |
| SiteSettings | 1 | `hello@example.com` placeholder email, `#` booking URL until provided, LinkedIn and Instagram links pointing to `https://example.com/...`. |
| ContactEnquiry | 0 in production; 4 in dev only | Fictional names with `example.com` emails, one per enquiry type, mixed statuses, for testing an enquiries view. |

### Placeholder images
Generated by the seed script with the Python standard library, never downloaded or hot-linked, saved under
`backend/media/seed/...` and served by FastAPI static files; the database stores relative paths.
- Case-study covers (1920x1080) and full tiles: SVG gradient in a per-client two-colour palette stored with the record,
  geometric shapes and the fictional client name set in the display font stack.
- Channel mock-ups: SVG wireframe blocks (grey bars for text lines, a coloured button, an image area) suggesting an
  email, a social post grid or a blog page; no real screenshots.
- Results chart: SVG bar or line chart drawn from the seeded CaseStudyResult values, labelled "sample data".
- Writing-sample thumbnails (1200x800): a format icon (pen, envelope, speech bubble, browser frame) on the cream or dark
  olive surface with the sample title.
- Portrait (1000x1200): neutral monochrome head-and-shoulders silhouette.
- Optional later: raster export with Pillow if SVG is not wanted.

## 8. Draft requirements (untagged; `requirements` skill turns them into REQ items)
Pages and navigation
- The site shall have Home, Work (project index), Project detail, About, Contact and FAQs pages, with Work, About and
  Contact in the main navigation and FAQs in the footer.
- The site shall show a fixed header with the owner's logo (wordmark placeholder until provided), the three main links and
  a primary "book a call" action whose URL is configurable.
- The site shall show a footer on every page with a large logo/name block, quick links, social links, contact email, the
  current year and a bottom bar with copyright and a short sign-off.

Home
- The home page shall open with a full-width dark hero containing a large uppercase statement, a short introduction, a
  highlighted one-line tagline and two calls to action (book a call, view projects), over an animated soft green glow.
- The home page shall show featured case studies as a two-column card grid (one column on mobile) with a link to all work.
- The home page shall list services in a three-column expandable grid on a dark section.
- The home page shall present three engagement models as cards with a description, a checklist and a booking button.
- The home page shall show an owner story section with portrait and short bio.
- The home page shall show a testimonial carousel with previous/next controls and position indicators, operable by keyboard.
- Home, Work, About, Contact and project pages shall include an FAQ preview accordion with a configurable subset of questions.

Projects
- The Work page shall list all published case studies as cards (cover image, title, campaign-type chip, summary) ordered
  by a configurable sort order.
- Each case study shall have its own page at `/projects/<slug>` with a full-width cover, a metadata block (client industry,
  campaign type, channels, goals, year, timeline), a results row of key metrics, problem and solution texts, an ordered gallery of full-width and half-width images, and a strip
  of two other projects with a link to all work.
- Unknown project slugs shall show a styled not-found page.

Writing samples (our addition, not on the reference)
- The site shall have a Writing page listing writing samples as cards in the project-card style, filterable by format
  (blog, web copy, email, social, landing page, newsletter), and a detail page per sample showing title, format, client,
  date, reading time and the full text.
- Seeded sample metrics and writing samples shall be flagged as sample data so they can be hidden or replaced before launch.

About
- The About page shall show a statement hero, an origin statement, a two-column vision block, a list of four values, a
  four-step process laid out as a descending staircase on desktop (stacked on mobile), the owner story, an FAQ preview
  and a closing call-to-action band.

FAQs
- The FAQs page shall group questions by category, each category as a two-column accordion on desktop and one column on
  mobile, followed by a call-to-action band.

Contact
- The Contact page shall show a heading, a short promise line, the contact email and a form with name (required), email
  (required, validated), company and message fields, and a consent note.
- The form shall include an enquiry-type selector (content strategy, copywriting, SEO content, brand messaging,
  campaign planning, other) and an optional budget range (our addition).
- Submissions shall be validated on client and server, stored in PostgreSQL, rate-limited, and protected against spam with
  a hidden honeypot field; the user shall see a clear success or error state.
- (Open) Whether submissions also send an email notification to the owner.

Content and API
- All content shown (case studies and results, images, writing samples, services, engagement models, testimonials, FAQs,
  values, process steps, profile with skills and tools, site settings) shall be served by the FastAPI backend from PostgreSQL and be editable without code changes
  (admin interface scope to be decided).
- A seed script shall populate every entity with original dummy content and generated placeholder images.

Design and quality
- The site shall use design tokens for colour, type, spacing and radius; components shall not hard-code values.
- The palette shall use #70FF00 as primary, #0F1C00 and #030500 as dark surfaces, #FFFDE9 as light surface and #63635A for
  muted text; green shall never be used as text on light surfaces.
- Display type shall use a free condensed font (Antonio, OFL) and body text Public Sans (OFL), self-hosted.
- Section headings shall carry a rotated green highlight shape; section seams may carry larger decorative shapes, hidden
  from assistive technology.
- Layouts shall be responsive from 360 px to 1920 px, with one-column layouts on mobile.
- Motion (hero glow, scroll reveals, hover states, carousel transitions) shall be subtle and disabled under
  `prefers-reduced-motion`.
- Pages shall meet WCAG 2.1 AA for contrast, focus visibility, keyboard operation of accordions, carousel and menu.
- Each page shall have its own title and meta description, plus Open Graph tags for project pages.

## 9. Not observable, and open questions
Not observable in this capture:
- The header/navigation itself: every screenshot shows only an empty dark band at the top, so the nav layout, sticky
  behaviour, scroll state and the mobile menu (hamburger or not) were not seen.
- Any motion: scroll-triggered reveals, hover states, accordion open animation, carousel autoplay and transitions, hero
  glow animation, page transitions. Framer's built-in animations are not detectable as a library.
- Open state of accordions (answer text and layout) and service descriptions behind the plus icons.
- Contact form backend: where it posts, validation messages, success state, email notifications, spam handling (the
  hidden extra fields are only presumed to be a honeypot). The UI marks all four fields required while the DOM marks only
  name and email as required.
- CMS structure: content came as opaque Framer CMS chunks, so real field names, drafts, ordering rules and image sizes
  are unknown.
- The external booking service and any analytics or cookie consent.
- The lower part of one case-study page (desktop screenshot cut at 12000 of 12860 px; its more-work strip rendered blank,
  probably lazy-loaded).
- Tablet widths and exact breakpoints; mobile type sizes (only estimated from screenshots).

Open questions for the user:
1. Mitali is a content writer and marketing strategist (from the coordinator). Should the new Writing page sit in the
   main navigation next to Work, or be reached from Work only?
2. Logo: the reference uses a giant wordmark in the footer. Should we typeset "Mitali" in the display font as a placeholder until the logo arrives?
3. Booking: which scheduling service and URL for "book a call", or should it link to the contact page?
4. Contact form: should submissions email Mitali as well as being stored? Which address?
5. Do you need an admin interface to edit projects and FAQs, or is editing via seed/migrations enough at first?
6. Is the Antonio + Public Sans pairing acceptable, or do you have brand fonts?
7. Keep the playful uppercase, punchy tone of headings (in original wording), or a calmer voice?
8. Engagement models: should prices be shown, or only descriptions as in the reference?
9. Will Mitali supply real, permitted metrics and writing samples to replace the seeded ones, and may client names be shown?
10. Confirm: green #70FF00 is never used for text on cream (it fails contrast at about 1.3:1); acceptable?
