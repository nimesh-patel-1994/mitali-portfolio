# Design Brief — mitali-portfolio

> Look and feel inputs for every UI. Owned by the `design-brief` skill; read by `ui-scope`, `mobile-scope`,
> `fe-builder` and `mobile-builder`. Status tags: `ID [STATUS YYYY-MM-DD HH:MM]`.
> Every item is optional. A value marked **(default)** was assumed because the user gave none; it can be changed any time
> through `/feature`, which marks the affected `UI-` and `MOB-` items CHANGED.
> Inputs: `.dev-pipeline/intake.md` section 6 and `.dev-pipeline/reference/reference-notes.md` section 5.

## 1. Brand
- DES-001 [NEW 2026-10-29 16:06] Product / brand name: Mitali (site title "Mitali — Content Writer & Marketing Strategist").
- DES-002 [NEW 2026-10-29 16:06] Logo: none yet (wordmark placeholder). The wordmark is the text "MITALI" set in
  `--font-display`, weight 700, uppercase, `--color-primary` on dark surfaces and `--color-dark` on cream. When a logo is
  supplied it goes into `assets/brand/` unchanged (light and dark variants, SVG preferred) and replaces the `Wordmark`
  component's text; layouts do not change.
  - Variants: light background — n/a, dark background — n/a, icon-only — n/a (to be supplied).
  - Minimum size and clear space: wordmark at least 24 px tall in the header; clear space equal to the cap height on all
    sides. Footer wordmark scales with the viewport (about 18vw, capped at 300 px).
- DES-003 [NEW 2026-10-29 16:06] Tone: confident, punchy and editorial. Short uppercase headings with original wording
  (no reuse of the reference's puns), plain, warm sentence-case body copy. Mitali writes for a living, so copy should read
  well: clear, specific, no filler.

## 2. Colour
- DES-010 [NEW 2026-10-29 16:06] Primary: #70FF00 neon green (given; the reference palette, explicitly requested).
- DES-011 [NEW 2026-10-29 16:06] Accent: none as a second hue. The dark olive #0F1C00 / near-black #030500 and warm
  cream #FFFDE9 pair carries the contrast; muted text #63635A (given).
- DES-012 [NEW 2026-10-29 16:06] Light and dark mode: one fixed theme, no toggle. Sections alternate between dark
  (near-black or dark olive) and cream surfaces; every section declares its surface so text and accent tokens switch with it.
- DES-013 [NEW 2026-10-29 16:06] Colour-use rules:
  - Green (#70FF00) is used for headings, labels, icons and the wordmark **only on dark surfaces**, and as a fill
    (buttons, tape shapes, chips, focus ring on dark). It is **never** text or an icon on cream or white (1.28:1, FAIL).
  - On cream, coloured text or links that must look "green" use `--color-primary-text-on-light` #367A00 (5.33:1 on
    white). Default link colour on cream is `--color-dark` with an underline.
  - Text on green fills is always `--color-dark` #0F1C00 (13.48:1).
  - Muted text #63635A is for cream surfaces only (fails on dark at 2.92:1); on dark use `--color-text-muted-on-dark`
    #A3A396 (6.94:1).

Derived palette (from `palette.py "#70FF00"`) and project tokens:

| Token | Value | Used for |
|-------|-------|----------|
| `--color-primary` (primary-500 given) | #70FF00 | Buttons, tape shapes, headings and wordmark on dark, chips, focus ring on dark |
| `--color-primary-tint` | rgba(112, 255, 0, 0.2) | Subtle fills on dark (hover rows, selected filter chip background) |
| primary-50 … primary-900 (palette scale) | #F4FFEB, #E5FFD1, #CCFFA3, #A9FF66, #87FF29, #6CF500, #5ACC00, #48A300, #367A00, #245200 | Hover/pressed states (`--color-primary-hover` #A9FF66 on dark, `--color-primary-pressed` #5ACC00), admin tints |
| `--color-primary-text-on-light` | #367A00 (primary-800) | Green-family text/links on cream or white, success text in admin |
| `--color-on-primary` | #0F1C00 | Text and icons on green fills |
| `--color-bg-deepest` | #030500 | Page background, hero, header, CTA bands |
| `--color-dark` (surface-dark) | #0F1C00 | Dark-olive sections, footer, cards on cream; body text on cream |
| `--color-cream` (surface-light) | #FFFDE9 | Cream sections; body text on dark |
| `--color-text-muted` | #63635A | Secondary text on cream only |
| `--color-text-muted-on-dark` | #A3A396 | Secondary text on dark surfaces |
| `--color-input-bg-dark` | #2A3220 | Form fields on dark (with a visible border, see below) |
| `--color-border-on-dark` | #A3A396 at 100 % for inputs; 20 % cream for hairline dividers | Input borders (UI component 3:1), dividers |
| `--color-border-on-light` | #8A8A7E for inputs; 15 % dark for hairline dividers | Input borders on cream / admin, dividers |
| neutral-50 … neutral-900 (palette scale) | #F5F5F4, #E8E9E7, #D1D4CE, #B2B7AE, #939A8E, #7A8273, #666C60, #51564D, #3D413A, #292B26 | Admin surfaces, tables, disabled states |
| `--color-white` | #FFFFFF | Admin content surface |
| `--color-success` | #1E6B2E (on cream) | Success messages, "published" chips on light |
| `--color-warning` | #8C5A00 on cream; #FFB74D on dark | Warnings, "Sample data" note, "needs rebuild" notice |
| `--color-danger` | #B3261E on cream/white; #FF8A80 on dark | Errors, field errors, delete actions |

| Pair | Ratio | Result |
|------|-------|--------|
| on-primary #0F1C00 on primary #70FF00 | 13.48 | AAA |
| primary #70FF00 on dark #0F1C00 | 13.48 | AAA |
| primary #70FF00 on deepest #030500 | 15.59 | AAA |
| primary #70FF00 on white | 1.31 | **FAIL** (rule DES-013) |
| primary #70FF00 on cream #FFFDE9 | 1.28 | **FAIL** (rule DES-013) |
| primary-text-on-light #367A00 on white | 5.33 | AA |
| cream #FFFDE9 on dark #0F1C00 | 17.26 | AAA |
| cream #FFFDE9 on deepest #030500 | 19.97 | AAA |
| dark #0F1C00 on cream #FFFDE9 | 17.26 | AAA |
| muted #63635A on cream #FFFDE9 | 5.91 | AA |
| muted #63635A on dark #0F1C00 | 2.92 | **FAIL** (use muted-on-dark) |
| muted-on-dark #A3A396 on dark #0F1C00 | 6.94 | AA |
| cream on input-bg-dark #2A3220 | 13.00 | AAA |
| input-bg-dark #2A3220 vs dark #0F1C00 (field edge) | 1.33 | FAIL as a boundary, so inputs on dark carry a #A3A396 border (6.94) |
| input border #8A8A7E on cream | 3.40 | AA (UI component, 3:1) |
| danger #B3261E on cream | 6.37 | AA |
| danger-on-dark #FF8A80 on dark | 7.75 | AA |
| success #1E6B2E on cream | 6.40 | AA |
| warning #8C5A00 on cream | 5.72 | AA |
| warning-on-dark #FFB74D on dark | 10.23 | AAA |

## 3. Typography
- DES-020 [NEW 2026-10-29 16:06] Fonts: headings, buttons, navigation, labels and wordmark use **Antonio** (weights 500
  and 700); body, form text and admin use **Public Sans** (400, 600, 700).
  - Licence: both SIL Open Font License 1.1. Self-hosted as WOFF2 files obtained from the official Google Fonts / upstream
    releases (never from the reference site), with `font-display: swap`. The reference's display font is custom/licensed
    and is not used.
  - Stacks: `--font-display: "Antonio", "Oswald", "Arial Narrow", sans-serif`;
    `--font-body: "Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif`.
- DES-021 [NEW 2026-10-29 16:06] (definition updated 2026-10-30 05:08, CHG-005: article-heading note below) Type scale and line height (desktop → mobile via `clamp()`):

| Token | Size | Line height | Weight | Case / tracking | Use |
|-------|------|-------------|--------|-----------------|-----|
| `--text-hero` | clamp(56px, 9.5vw, 136px) | 0.9 | 700 display | uppercase, normal | Hero `h1` (Home, About, Contact) |
| `--text-h1` | clamp(36px, 4vw, 48px) | 0.9 | 700 display | uppercase, 0.02em | Inner page `h1` |
| `--text-h2` | clamp(32px, 4vw, 48px) | 0.9 | 700 display | uppercase, 0.02em | Section headings |
| `--text-h3` | clamp(24px, 2.6vw, 36px) | 0.95 | 500 display | uppercase, 0.02em | Card, service, value titles |
| `--text-statement` | clamp(20px, 2vw, 26px) | 1.3 | 700 body | sentence case | Origin statement, quotes |
| `--text-lead` | 18px | 1.5 | 400 body | sentence case | Intros |
| `--text-body` | 16px | 1.5 | 400 body | sentence case, -0.01em | Paragraphs |
| `--text-small` | 14px | 1.4 | 400/600 body | sentence case | Meta, notes, form hints |
| `--text-label` | 14-16px | 1 | 500 display | uppercase, 0.04em | Buttons, nav, chips, labels |
| `--text-footer-mark` | clamp(96px, 18vw, 300px) | 0.85 | 700 display | uppercase | Footer wordmark |

  Body copy line length is capped at about 70 characters (`--measure: 68ch`).

  Note (2026-10-30 05:08, CHG-005; design call delegated by the user): headings inside a writing-sample article body
  (UI-030). The page `h1` is the sample title, so author Markdown `#` → `h2`, `##` → `h3`, `###` and deeper → `h4`.
  Styles, scoped to the article body only: `h2` = `--text-h3` (display, uppercase), `h3` = `--text-statement` (body
  font, bold), `h4` = `--text-label` (display, uppercase); the body keeps `--measure` line length. No new tokens.

## 4. Reference designs
| Ref | Kind (URL, screenshot, Figma export, none) | Source | Take from it | Do not copy | Rights |
|-----|--------------------------------------------|--------|--------------|-------------|--------|
| DES-030 [NEW 2026-10-29 16:06] | URL, captured with `/replicate` (9 pages, desktop 1440 and mobile 390 screenshots, computed styles) | https://www.studiobrag.com; notes in `.dev-pipeline/reference/reference-notes.md`, screenshots in `.dev-pipeline/reference/screenshots/` (git-ignored) | Page structure and section order, layout patterns (2-col card grid, 3-col services/engagement cards, case-study meta block and gallery, staircase process, 2-col FAQ accordions, giant footer wordmark), component behaviour, dark/cream alternation, tilted green "tape" shapes, condensed uppercase display + grotesque pairing, colour palette (explicitly requested by the user) | Brand name, logo and wordmark, all headings and copy (including puns), client names and logos, case-study images, founder photo and bio, testimonials, FAQ wording, the custom display font, source code, the third-party booking link | Inspiration only (ownership/permission not confirmed) |

Rule: for "inspiration only" references, rebuild structure and behaviour with our own branding, copy and images.
Never reproduce another organisation's login or payment pages so that they could pass as the real thing.
Our additions beyond the reference: Writing page with format filter and detail pages, results row on case studies,
enquiry type and budget on the contact form, the admin area.

## 5. Platform differences
- DES-040 [NEW 2026-10-29 16:06] Web (public site): editorial, spacious, flat (no shadows). Layout and components:
  - Grid: `--container-max: 1100px`, `--container-wide: 1320px` (footer, galleries), side gutters `--space-5` (24 px) on
    mobile, `--space-7` (48 px) on tablet, auto-centred on desktop. Breakpoints: mobile < 810 px, tablet 810-1199 px,
    desktop ≥ 1200 px; layouts verified from 360 px.
  - Spacing scale (4 px base): `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6`
    32, `--space-7` 48, `--space-8` 64, `--space-9` 96, `--space-10` 128, `--space-11` 160 px. Section padding
    `--section-pad: clamp(64px, 10vw, 160px)` vertical.
  - Radii: `--radius-0: 0` (buttons, inputs), `--radius-1: 6px` (cards, images, chips), `--radius-full: 9999px` (dots,
    round icons). Shadows: none.
  - Tape shapes: `--tape-rotate: -4deg`; heading tape is a `--color-primary` block about 0.9em × 1.6em behind the first
    letters; seam tapes are larger blocks overlapping section boundaries, alternating left/right, `aria-hidden`.
  - Buttons: primary = green fill / dark text; secondary = cream fill / dark text; ghost = transparent with a 1 px border.
    Height 48 px (44 px minimum touch target), `--text-label`. Hover: colour inversion (green ↔ cream), 150 ms.
  - Cards: 16:9 image with `--radius-1`, uppercase title left, outlined chip right, 3-4 line muted summary. Hover:
    image scale 1.03 and title underline (no motion under reduced motion).
  - Header (our design; not observable on the reference): fixed, 80 px tall transparent over the dark hero, shrinking to
    64 px with a `--color-bg-deepest` background after scrolling past its own height. Below 810 px the links collapse into
    a "Menu" button that opens a full-screen dark overlay with large display-font links and the "Book a call" button.
  - Motion: hero glow is a blurred radial gradient drifting slowly (20 s loop); sections fade/translate up 16 px over
    300 ms once on entry; accordion height transition 200 ms with the plus icon rotating to a cross; carousel cross-fade
    250 ms. Easing `--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)`. Everything is disabled under
    `prefers-reduced-motion: reduce`.
  - Focus: 2 px solid outline with 2 px offset; `--color-primary` on dark surfaces, `--color-dark` on cream/white.
- DES-041 [NEW 2026-10-29 16:06] Mobile: not applicable (no native app). The responsive web layout follows DES-040.
- DES-042 [NEW 2026-10-29 16:06] Web (admin area at `/admin`): a calm, functional skin using the same tokens. Light
  content area (`--color-white` / neutral-50 surfaces, `--color-dark` text), a dark-olive sidebar with the wordmark in
  green, Public Sans throughout except headings in Antonio, standard tables and forms, green used only as fills (primary
  buttons, active nav marker) and `--color-primary-text-on-light` for links. Desktop-first but usable from 360 px.
- Different on purpose? Yes: the admin is a work tool and favours legibility and density over the public site's
  expressive layout.

## 6. Design tokens (the contract)
Builders use these tokens and never hard-code colours, fonts or spacing in components.
- Web: CSS custom properties defined once in `frontend/src/styles/tokens.css` with the names in sections 2, 3 and 5
  (`--color-*`, `--font-*`, `--text-*`, `--space-1…11`, `--radius-*`, `--container-*`, `--ease-out`). Section surfaces set
  contextual aliases (`--surface`, `--on-surface`, `--on-surface-muted`, `--accent-on-surface`, `--border`) so components
  read the alias and work on both dark and cream sections.
- Flutter / React Native: not applicable.

## 7. Design notes (from references)
> Added by `/upgrade-project` (toolkit 1.2.0, 2026-10-31 02:18). Only for references used as **UI inspiration** (`/inspire`). Visual and
> interaction design only; nothing about a reference's domain, features, pages, data or business rules is recorded or used.

**frontend/ (the current front end):** None as `/inspire` notes. Its reference (studiobrag.com) was captured with `/replicate`
before `/inspire` existed and is recorded in DES-030 (section 4) with the observations in `.dev-pipeline/reference/reference-notes.md`;
the resulting decisions are DES-001..DES-042 above.

### Variant: frontend-2 (CHG-012)
> Applies **only** to the second front end in `frontend-2/` (REQ-080..REQ-097). It does not change DES-001..DES-042, section 6 or any
> token of `frontend/`. Shared brand facts still hold for both: DES-001 (name), DES-002 (wordmark placeholder, logos only from
> `assets/brand/`, never edited), DES-003 (tone), DES-010 (primary #70FF00) and the colour-use rule of DES-013 (green is never text
> or an icon on cream or white).
> Reference: https://theatlyx.com/sportfolio/ecommerce-brand-identity-redesign/ — **inspiration only** (no ownership, no permission),
> captured with `/inspire` in design mode; observations in `.dev-pipeline/reference/inspiration/reference-notes.md`, `summary.md`,
> `analysis.json` and the probe results (screenshots stay in that folder, out of git). Only visual and interaction design is taken;
> no text, images, logos, fonts, code, brand or product names, and nothing about the reference's domain, pages or data.
> Decisions below were made by the user at G1 (2026-10-31). Values marked (P1) are reviewed at the PH-2 `/ui-review`.

**Aspects chosen**

| Aspect | Observed (neutral wording, no brand or text) | Decision | Our token or spec | DES id |
|--------|----------------------------------------------|----------|-------------------|--------|
| Typography | Very large, light (300) grotesk display with tight negative tracking (about −0.07 em) and line height 0.9; neutral geometric sans body about 18-20 px; title-case nav in the body font | ADAPT | Inter Tight 300 display, Public Sans body, Antonio for wordmark and small labels; scale DES-057 | DES-050 [NEW 2026-10-31 02:54] |
| Colour scheme | Near-monochrome neutral system (white → light grey → mid grey → near-black → black), one saturated accent on very few elements, colour coming from imagery, dark full-bleed bands as rhythm breaks | ADAPT (relationships only, around our brand) | Cream base, white alternate bands, ink, deep bands, muted, green only as fills/indicators; DES-051, DES-059 | DES-051 [NEW 2026-10-31 02:54] |
| Buttons, inputs, cards | No card chrome; linked items are image + text + an arrow icon that swaps diagonally on hover; text links darken on hover; boxed buttons rare, 2 px border, near-square radius, 44 px tall; one giant underlined call-to-action in the footer; third-party form and consent styles | TAKE cardless items and arrow swap; ADAPT buttons; SKIP the consent banner and third-party form styles | DES-052 | DES-052 [NEW 2026-10-31 02:54] |
| Pop-ups and overlays | Only an off-canvas full-width menu with a dark backdrop (panel slide 0.45 s, backdrop fade 0.5 s, hairline rows) and a consent modal | ADAPT the menu; our own dialog and toast patterns; SKIP the consent modal | DES-053 (pattern table below) | DES-053 [NEW 2026-10-31 02:54] |
| Spacing, radius, shadows, motion | Near full-bleed content with narrow (~15 px) gutters; large vertical gaps (80-120 px); 1 px hairlines; radii 2 / 8 / 20 px; no content shadows; fade-up reveals (1.15 s, ease-out, 0.15 s delay, at 85 % of the viewport, once), slow parallax bands, scrubbed collage drift, 0.3 s hovers; smooth-scroll hijacking and a custom cursor | TAKE spacing, hairlines, radii, flat; TAKE reveal and arrow swap; ADAPT parallax and collage (CSS, smaller offsets); SKIP smooth scroll and custom cursor | DES-054, DES-056, DES-058, DES-061 | DES-054 [NEW 2026-10-31 02:54] |

**Colour scheme derivation** (observed values from `summary.md` / `analysis.json` computed styles, confirmed against the screenshots)
- Reference roles observed: base surface white `#FFFFFF`, warm tint `#FCF7F3`, light surface `#F0F0F0` / `#F8F8F8`; headings `#111111`,
  body `#555555`, labels `#999999`; dark bands `#111111` and media frames `#000000`; one saturated orange accent on very few elements
  (its hue is not used). Neutral tint: plain greys.
- Mode: **build around our own primary** (inspiration only; the observed scheme itself is not used).
- Our primary: `#70FF00` (DES-010, given). Palette helper results used: `primary_text_on_white` = `#367A00`. The helper's derived
  accent for the reference relationship, magenta `#D920E5`, is **not used** (decision at G1): the reference has one accent, and our
  green plays that role.
- Relationship kept: neutral-first UI, one accent used sparingly (fills, active/hover indicators, small marks), colour from imagery,
  dark full-bleed bands as rhythm breaks, hairlines instead of boxes. Role mapping (reference role → ours):

  | Reference role | Observed | frontend-2 role | Ours |
  |----------------|----------|-----------------|------|
  | page base | #FFFFFF / #FCF7F3 | `--surface-base` (single base token) | cream #FFFDE9 (P1: white #FFFFFF shown as comparison) |
  | alternate light band | #F0F0F0 / #F8F8F8 | `--surface-band` | white #FFFFFF |
  | headings / strong text | #111111 / #212121 | `--ink-strong` | ink #0F1C00 |
  | body / secondary text | #555555 | `--ink-muted` (light surfaces) | muted #63635A |
  | labels | #999999 | `--ink-muted` (no lighter step: a lighter grey fails 4.5:1 on cream) | muted #63635A |
  | dark band | #111111 | `--surface-deep-alt` | #0F1C00 |
  | darkest band / media frame | #000000 | `--surface-deep` | #030500 |
  | muted text on dark | (n/a) | `--ink-inverse-muted` | #A3A396 |
  | accent | single orange | `--brand-accent` (fills, indicators only) | #70FF00; as text on light only `--brand-accent-text-on-light` #367A00 |
- Contrast results: DES-059. No new FAIL beyond the known ones (green on cream/white), which DES-051 rules out by construction.

- DES-051 detail (colour-use rules, frontend-2):
  - `--surface-base` is the only base surface; every section declares `data-surface="base|band|deep|deep-alt"` and components read
    the surface aliases (DES-060), never raw colours.
  - `#70FF00` only as: button and chip fills (text on it = ink `#0F1C00`), active/hover indicator bars and underline bars **on deep
    surfaces only**, focus ring on deep surfaces, the footer CTA underline and arrow on deep surfaces, small decorative marks with
    `aria-hidden`. Never text, icon or thin line on cream or white.
  - Green-family text on light surfaces (rare: success text in the admin) uses `#367A00`. Default links on light are ink with an
    underline.
  - Muted `#63635A` only on cream/white; on deep surfaces `#A3A396`.
  - (P1) White-as-base comparison: a dev-only switch (UI-101) maps `--surface-base` to white and `--surface-band` to cream for the
    review; the losing option is removed after the P1 decision.

**Typography pairing**
- Observed: a light (300) neo-grotesk display at very large sizes (about 100 / 90 px on the case page, about 140 px on a landing
  hero) with tight tracking (−0.07 to −0.09 em) and line height 0.85-0.9, a second condensed uppercase display for one giant
  headline, and a neutral geometric sans body (about 18-20 px). The licensed display faces are not used and not named here.
- DES-050 detail (ours):
  | Role | Family | Weights / styles shipped | Use |
  |------|--------|--------------------------|-----|
  | `--font-display` | **Inter Tight** (`@fontsource/inter-tight`) | 300 normal | h1-h3, display statements, footer CTA, big numbers |
  | `--font-body` | **Public Sans** (`@fontsource/public-sans`) | 400 normal, 400 italic, 600 normal | body, nav, forms, admin, buttons |
  | `--font-label` | **Antonio** (`@fontsource/antonio`) | 500, 700 normal | wordmark (700, uppercase), small uppercase labels and meta labels (500) |
  - Stacks: `"Inter Tight", "Helvetica Neue", Arial, sans-serif`; `"Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;
    `"Antonio", "Arial Narrow", sans-serif`.
  - Loading: self-hosted from the Fontsource npm packages (bundled into the build, never fetched from a CDN), **Latin subset files
    only**, `font-display: swap`; only the display font (Inter Tight 300) is preloaded. Public Sans 400 italic is shipped so writing
    samples never use synthetic italics; no other weights.
  - Licences: all three are **SIL Open Font License 1.1** — verified by the orchestrator on 2026-10-31 02:55 from the npm registry metadata
    (`npm view`: `@fontsource/inter-tight` 5.3.0, `@fontsource/public-sans` 5.3.0, `@fontsource/antonio` 5.3.0, all `license: OFL-1.1`).
    The builder still checks the licence file shipped in each installed package (check UI-T-131); the licence texts ship in `frontend-2/public/fonts/LICENSES/`. If any is not OFL 1.1, stop and ask the user.

**Pop-ups and overlays (our patterns)** — DES-053 detail

| Kind | Size and placement | Surface (radius, shadow, backdrop) | Motion (motion allowed / reduced) | Behaviour | UI kit component |
|------|--------------------|------------------------------------|-----------------------------------|-----------|------------------|
| Mobile menu (drawer, full screen) | Full viewport below 768 px (and on the "Menu" button at any width where shown); wordmark and close button in a row at the top, then nav rows | `--surface-deep`, no radius, no shadow; rows separated by hairlines (`--line-on-surface`), each row ≥ 56 px tall with the link in `--text-h3`; "Book a call" as a full-width primary button at the end | Panel `translateX(100% → 0)` in `--motion-dur-slow` (450 ms) `--motion-ease-in-out`, backdrop opacity `--motion-dur-backdrop` (500 ms) / instant | Close button and Esc close it; focus moves to the first link, is trapped, and returns to the Menu button; background `inert`, page scroll locked; `role="dialog"`, `aria-modal="true"`, labelled "Menu"; closes on route change and when the viewport grows to ≥ 768 px; header stays visible while open | `MobileMenu` (UI-106) |
| Dialog (confirm, media picker) | Centred; confirm max 480 px wide, picker max 960 px; full-screen sheet below 768 px | `--surface-band` (white) with `--radius-md` (8 px), 1 px `--line-strong` border instead of a shadow; backdrop ink at 60 % opacity | Fade + 8 px rise in `--motion-dur-base` / instant | Close button and Esc close it (Esc = cancel on confirm); focus moves to the first control (confirm: the safe "Cancel"), trapped, returns to the trigger; scroll locked; `role="dialog"` or `alertdialog` for confirms, `aria-modal`, labelled by its heading | `Dialog`, `ConfirmDialog` (PH-3) |
| Side panel (admin editors) | Docked right, 480 px on ≥ 1024 px; full-screen sheet below | `--surface-band`, left hairline, no shadow | Slide in `--motion-dur-slow` / instant | As dialog when modal (below 1024 px); docked mode keeps the list usable and moves focus into the panel heading | `SidePanel` (PH-3) |
| Toast | Bottom-left on ≥ 768 px, bottom full-width below; stacked, max 3 | `--surface-deep`, cream text, `--radius-sm`, no shadow; success marker bar in `--brand-accent` (on deep), errors use `--danger-on-surface` text | Fade + 8 px rise / instant | `role="status"` (success, auto-dismiss after 5 s, paused on hover and focus) or `role="alert"` (errors, stay until dismissed); close button; never steals focus | `Toast` (PH-3) |

- DES-052 [NEW 2026-10-31 02:54] Components (frontend-2):
  - **Cardless content units** (case studies, writing samples, engagement models, values): image in a fixed aspect box
    (`--radius-lg` 20 px for large media, `--radius-md` 8 px for thumbnails), title in `--font-display` 300, a label row (chip,
    meta) in `--font-label` 500 uppercase, summary in `--ink-muted`; one link per unit; top hairline separates units in lists.
  - **ArrowLink** (linked units, "View all", "Read the case study"): text + an arrow icon in an `overflow: hidden` box; on
    `:hover`/`:focus-visible` the arrow moves out diagonally (up-right) and a second arrow enters from bottom-left, `--motion-dur-base`
    `--motion-ease-out`; text gains its underline. Reduced motion: arrows swap instantly.
  - **Text links**: ink with a 1 px underline offset 0.2 em on light; on deep surfaces cream with a green underline bar that grows
    `scaleX(0 → 1)` from the left on hover (`--motion-dur-base`). Nav links use the same grow-bar (ink bar on light, green on deep).
  - **Buttons**: height 48 px (≥ 44 px touch target), padding `0 var(--space-5)`, `--radius-sm` (2 px), `--font-body` 600, sentence
    case. Primary = `--brand-accent` fill + ink text; secondary = transparent with a 2 px `--on-surface` border; hover = the arrow /
    underline motion, not opacity. Loading = spinner + "Sending…" text, disabled.
  - **Inputs** (contact form, admin): our own (the reference's third-party form styles are skipped): 48 px tall, 1 px `--line-input`
    border (≥ 3:1), `--radius-sm`, label above, focus = 2 px `--focus-on-surface` outline with 2 px offset, transition
    `--motion-dur-fast`.
  - **Chips**: `--font-label` 500 uppercase, 1 px border in `--line-strong`, `--radius-full`; active filter chip = accent fill + ink
    text.
  - **Meta row** (case-study page): 4 equal columns (2 at 768 px, 1 below), each with a 1 px top hairline, a muted label above and an
    ink value below (client, year, industry, timeline; campaign type and channels in a second row).
  - **Footer CTA**: a giant two-line "let's talk" link (`--text-cta`, display 300) with a thin diagonal arrow and a 4 px underline as
    wide as the text (`--brand-accent` on the deep footer), linking to `/contact`; then a hairline, the wordmark + contact email row,
    a hairline, and the link columns (muted column labels in `--font-label`, links ≥ 44 px tall on touch layouts).
  - Shadows: none anywhere (flat, hairline-structured).

- DES-055 [NEW 2026-10-31 02:54] Responsive breakpoints (own, mobile-first) and reflow:
  | Token (custom media) | Min width | Layout |
  |----------------------|-----------|--------|
  | (default) | 0 (verified from 360 px; designed at 375) | One column; Menu button + full-screen menu; meta row 1 column; offset text full width; gallery pairs stack; collage becomes a vertical stack; footer stacks (CTA, wordmark + email, link groups) |
  | `--bp-md` | 768 px | Inline nav (4 links + "Book a call"); meta row 2 columns; gallery pairs side by side; card grids 2 columns |
  | `--bp-lg` | 1024 px | 12-column grid; offset text in columns 5-12 (starts at about 37 % of the width); meta row 4 columns; collage asymmetric |
  | `--bp-xl` | 1440 px | Full display scale and tightest tracking; content grows full-bleed up to 1920 px and is centred beyond |
  Touch targets ≥ 44 × 44 px everywhere (menu rows 56 px, footer links ≥ 44 px on touch layouts).

- DES-056 [NEW 2026-10-31 02:54] Header (frontend-2): transparent over the top of the page with the wordmark left and nav right;
  after scrolling past its own height it becomes compact (64 px, `--surface-base` with a bottom hairline). Scrolling down hides it
  (`translateY(-100%)`, `--motion-dur-base`); scrolling up reveals it. It stays visible while it contains keyboard focus
  (`:focus-within`) and while the mobile menu is open. `scroll-padding-top: var(--header-h-compact)` so focused elements and anchor
  targets are never hidden under it; a "Skip to content" link is the first focusable element. Reduced motion: hide/show without
  animation. (Detection approach: requirements open question 13.)

- DES-057 [NEW 2026-10-31 02:54] Type scale (frontend-2; fluid `clamp()`, values computed at the four review widths) (P1):
  | Token | `clamp()` | 375 | 768 | 1024 | 1440 | Line height | Weight / font | Tracking |
  |-------|-----------|-----|-----|------|------|-------------|---------------|----------|
  | `--text-display-xl` (Home / About hero `h1`) | clamp(3rem, 1.4rem + 7.6vw, 8.75rem) | 50 | 81 | 100 | 132 | 0.88 | 300 display | `--tracking-display` |
  | `--text-display` (inner `h1`, case-study title) | clamp(2.5rem, 1.25rem + 5.6vw, 6.25rem) | 41 | 63 | 77 | 100 | 0.9 | 300 display | `--tracking-display` |
  | `--text-h2` | clamp(1.875rem, 1.3rem + 2.5vw, 3.125rem) | 30 | 40 | 46 | 50 | 1.0 | 300 display | `--tracking-heading` |
  | `--text-h3` | clamp(1.375rem, 1.1rem + 0.9vw, 1.875rem) | 22 | 25 | 27 | 30 | 1.1 | 300 display | −0.03em |
  | `--text-cta` (footer "let's talk") | clamp(3rem, 0.9rem + 9vw, 10rem) | 48 | 84 | 107 | 144 | 0.9 | 300 display | `--tracking-display` |
  | `--text-lead` | clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem) | 18 | 19 | 20 | 20 | 1.4 | 400 body | normal |
  | `--text-body` | 1rem | 16 | 16 | 16 | 16 | 1.55 | 400 body | normal |
  | `--text-small` | 0.875rem | 14 | 14 | 14 | 14 | 1.45 | 400/600 body | normal |
  | `--text-label` | 0.875rem | 14 | 14 | 14 | 14 | 1.0 | 500 label, uppercase | 0.06em |
  | `--text-wordmark` | 1.5rem (header), footer clamp(4rem, 1rem + 14vw, 15rem) | 24 / 69 | 24 / 124 | 24 / 159 | 24 / 218 | 0.85 | 700 label, uppercase | 0.02em |
  - Tracking tokens per width (redefined in the breakpoints): `--tracking-display` −0.04em (default), −0.055em (`--bp-md`),
    −0.07em (`--bp-xl`); `--tracking-heading` −0.03em, −0.05em (`--bp-lg`).
  - Body line length capped at `--measure: 68ch`; article-body heading mapping as in the DES-021 note but with the frontend-2 tokens
    (`h2` = `--text-h3`, `h3` = `--text-lead` 600 body, `h4` = `--text-label`).
  - Hero `h1` must leave both hero actions visible without scrolling at 1440×900 and 390×844 (REQ-010 via REQ-082); the clamp caps
    are chosen for that and are checked at the P1 review.

- DES-058 [NEW 2026-10-31 02:54] Motion tokens and rules (frontend-2; no motion library):
  | Token | Value | Use |
  |-------|-------|-----|
  | `--motion-dur-fast` | 150ms | input focus, small state changes |
  | `--motion-dur-base` | 300ms | link/nav hover, arrow swap, header hide/show, chip states |
  | `--motion-dur-slow` | 450ms | menu panel, side panel |
  | `--motion-dur-backdrop` | 500ms | menu/dialog backdrop |
  | `--motion-dur-reveal` | 1150ms | fade-up reveal |
  | `--motion-delay-reveal` | 150ms | reveal start delay |
  | `--motion-reveal-distance` | 50px | reveal start offset (translateY 50 → 0) |
  | `--motion-ease-out` | cubic-bezier(0.215, 0.61, 0.355, 1) | power2-like ease-out (reveals, hovers) |
  | `--motion-ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | menu and panels |
  | `--motion-parallax-shift` | 8% | media-band drift (image 116 % of its frame, −8 % → +8 %) |
  | `--motion-drift-max` | 12% | collage item drift limit (per-item variants d1..d4 within ±12 %) |
  | `--motion-vt-dur` | 250ms | route view-transition cross-fade (DES-063) |
  - Reveal: one shared observer; starts when the block top crosses about 85 % of the viewport height; plays once; no stagger beyond
    `--motion-delay-reveal` (optional +60 ms per item, at most 4 items, via `:nth-child`, never inline styles).
  - Parallax bands and collage drift: CSS scroll-driven animations (`animation-timeline: view()`) inside `@supports` and
    `prefers-reduced-motion: no-preference`; static layout otherwise.
  - Only `transform` and `opacity` animate (colour/underline-colour hover changes excepted); every animation and transition lives
    inside `@media (prefers-reduced-motion: no-preference)`; nothing loops, flashes or autoplays; content is visible without JS, in
    print and under reduced motion; skipped: smooth scrolling, custom cursor.

- DES-059 [NEW 2026-10-31 02:54] Contrast table (frontend-2 pairs in use; WCAG relative luminance, ratios rounded to 2 decimals;
  pairs shared with section 2 match its values):
  | Pair (text or UI on surface) | Ratio | Result | Used for |
  |------------------------------|-------|--------|----------|
  | ink #0F1C00 on cream #FFFDE9 | 17.26 | AAA | text on base |
  | ink #0F1C00 on white #FFFFFF | 17.70 | AAA | text on bands, admin |
  | muted #63635A on cream #FFFDE9 | 5.91 | AA | secondary text, meta labels on base |
  | muted #63635A on white #FFFFFF | 6.06 | AA | secondary text on bands |
  | cream #FFFDE9 on deep #030500 | 19.97 | AAA | text on deepest bands, footer, menu |
  | cream #FFFDE9 on deep-alt #0F1C00 | 17.26 | AAA | text on dark-olive bands |
  | white #FFFFFF on deep #030500 | 20.48 | AAA | (if used on media frames) |
  | muted-on-dark #A3A396 on deep #030500 | 8.03 | AAA | secondary text on deepest bands |
  | muted-on-dark #A3A396 on deep-alt #0F1C00 | 6.94 | AA | secondary text on dark-olive bands |
  | green #70FF00 on deep #030500 | 15.59 | AAA | indicator bars, focus ring, footer CTA underline |
  | green #70FF00 on deep-alt #0F1C00 | 13.48 | AAA | indicator bars, focus ring |
  | ink #0F1C00 on green #70FF00 | 13.48 | AAA | primary button and active chip text |
  | green-text #367A00 on white #FFFFFF | 5.33 | AA | success text (admin) |
  | green-text #367A00 on cream #FFFDE9 | 5.20 | AA | green-family text on base (rare) |
  | input border #8A8A7E on cream #FFFDE9 | 3.40 | AA (UI 3:1) | input borders |
  | input border #8A8A7E on white #FFFFFF | 3.49 | AA (UI 3:1) | input borders on bands and admin |
  | focus ink #0F1C00 on cream / white | 17.26 / 17.70 | AAA | focus ring on light |
  | danger #B3261E on cream / white | 6.37 / 6.54 | AA | field errors |
  | danger-on-dark #FF8A80 on deep-alt #0F1C00 | 7.75 | AA | errors on dark (contact form) |
  | green #70FF00 on cream / white | 1.28 / 1.31 | **FAIL** | never used (DES-051) |
  | muted #63635A on deep-alt #0F1C00 | 2.92 | **FAIL** | never used (use #A3A396) |
  Hairlines (`--line-hairline`: ink at 15 % on light, cream at 20 % on deep) are decorative separators, not the only cue for any
  state, so the 3:1 rule does not apply to them; borders that identify a control use `--line-input` or `--line-strong` (≥ 3:1).

- DES-060 [NEW 2026-10-31 02:54] Semantic token layer contract (frontend-2; improvement #1). Three files in `frontend-2/src/styles/`:
  1. `palette.css` — raw values only, prefix `--p-` (`--p-cream #FFFDE9`, `--p-white #FFFFFF`, `--p-ink #0F1C00`, `--p-deep #030500`,
     `--p-olive #0F1C00`, `--p-muted #63635A`, `--p-muted-on-dark #A3A396`, `--p-green #70FF00`, `--p-green-text #367A00`,
     `--p-input-border #8A8A7E`, `--p-danger #B3261E`, `--p-danger-on-dark #FF8A80`, `--p-warning #8C5A00`, `--p-warning-on-dark #FFB74D`,
     `--p-success #1E6B2E`, `--p-neutral-50…900` as section 2). Nothing but `semantic.css` may read `--p-*`.
  2. `semantic.css` — roles: **brand** `--brand-accent`, `--brand-on-accent`, `--brand-accent-text-on-light`; **surface**
     `--surface-base`, `--surface-band`, `--surface-deep`, `--surface-deep-alt`, `--surface-skeleton`; **ink** `--ink-strong`,
     `--ink-muted`, `--ink-inverse`, `--ink-inverse-muted`; **line** `--line-hairline`, `--line-strong`, `--line-input`; **status**
     `--status-danger`, `--status-warning`, `--status-success` (+ `-on-dark`); **type** `--font-display`, `--font-body`, `--font-label`,
     `--text-*`, `--tracking-*`, `--measure`; **space** `--space-1…11` (4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160 px),
     `--section-gap: clamp(4rem, 2rem + 6vw, 8rem)`; **layout** `--layout-inset` (16 / 20 / 24 px at default / md / lg+),
     `--layout-gutter` (16 / 20 / 24 px), `--layout-max: 1920px`, `--header-h: 80px`, `--header-h-compact: 64px`; **radius**
     `--radius-sm 2px`, `--radius-md 8px`, `--radius-lg 20px`, `--radius-full 9999px`; **motion** the DES-058 tokens;
     **focus** `--focus-width 2px`, `--focus-offset 2px`.
  3. `surfaces.css` — context aliases set by `[data-surface]`: `--on-surface`, `--on-surface-muted`, `--accent-on-surface` (green on
     deep surfaces; `--brand-accent-text-on-light` on base/band), `--line-on-surface`, `--focus-on-surface` (green on deep; ink on
     light), `--danger-on-surface`, `--warning-on-surface`.
  Breakpoints as custom media in `media.css` (`--bp-md`, `--bp-lg`, `--bp-xl`). Components read only semantic tokens and surface
  aliases. A third variant = a new `palette.css` + `semantic.css` mapping (and fonts), no component changes. Light/dark mode (#8) is
  out of scope; it would be one more `semantic.css` mapping under a `[data-theme]` selector.

- DES-061 [NEW 2026-10-31 02:54] Grid and layout patterns (frontend-2): near full-bleed — content spans the viewport minus
  `--layout-inset`; 12-column grid with `--layout-gutter` from `--bp-lg`; generous vertical rhythm `--section-gap`; tight 10-12 px
  (`--space-3`) gaps inside image rows; **offset text blocks** start at column 5 (about 37 % of the width) on `--bp-lg`+ and span the
  full width below; **50/50 intro split** (heading left, text right) on `--bp-lg`+; **meta row** per DES-052; 1 px hairlines
  structure lists and sections; dark full-bleed bands (`--surface-deep`/`--surface-deep-alt`) as rhythm breaks (e.g. results, the
  media band, testimonials, footer); the staircase of process steps (REQ-040) keeps its diagonal on `--bp-lg`+ in the flat
  hairline style.

- DES-062 [NEW 2026-10-31 02:54] Image treatment and loading (frontend-2; improvement #4): every image sits in a fixed
  `aspect-ratio` box from the API's `width`/`height` (or the slot's ratio: covers and media bands 16:9, gallery halves 4:3, thumbnails
  3:2, portrait 5:6) with `--radius-lg` (large) or `--radius-md` (small); until loaded the box shows `--surface-skeleton` with a slow
  neutral shimmer (opacity/transform of a pseudo-element only; static under reduced motion); the image simply paints over the
  placeholder (no fade-in, so a pre-rendered image is never hidden waiting for JavaScript). No captions unless the data has one. No hover zoom on gallery images. No AVIF or blur-up (would need backend
  image changes).

- DES-063 [NEW 2026-10-31 02:54] Route view transitions (frontend-2; improvement #3) (P1): a 250 ms cross-fade of the main content
  between pages (header and footer stay put via their own `view-transition-name`, set in CSS classes); off under reduced motion
  and where the API is missing. May be dropped at the P1 review if it breaks focus management or scroll reset.

- DES-064 [NEW 2026-10-31 02:54] Admin skin (frontend-2): calm and functional like DES-042 but with the frontend-2 tokens:
  `--surface-band` (white) content area, `--surface-deep-alt` sidebar with the wordmark in green, Public Sans throughout with
  headings in Inter Tight 300 at `--text-h2`/`--text-h3`, hairline tables, green only as fills (primary buttons, active nav marker)
  and `--brand-accent-text-on-light` for links; **skeletons** (improvement #5) for lists, editors and the dashboard: blocks in
  `--surface-skeleton` shaped like the content, shimmer as DES-062, `aria-busy="true"` on the region and a visually hidden
  "Loading…" status.

- DES-065 [NEW 2026-10-31 02:54] Wordmark and brand in frontend-2: the "MITALI" text wordmark (DES-002 placeholder rules: never a
  drawn logo; a supplied logo from `assets/brand/` replaces only the `Wordmark` component) set in Antonio 700 uppercase; ink on
  light surfaces, green on deep surfaces; header size `--text-wordmark` 24 px, footer giant size per DES-057.

## 8. Open questions
| # | Question | Owner | Resolved? |
|---|----------|-------|-----------|
| 1 | Logo file (SVG, light and dark variants) to replace the "MITALI" wordmark. | User | No |
| 2 | Primary green fails as text on cream/white (1.28-1.31:1); handled by DES-013 (never used as text on light). Accepted in the intake. | User | Yes |
| 3 | Muted #63635A fails on dark (2.92:1); replaced on dark by #A3A396. | Design | Yes |
| 4 | Real portrait photo of Mitali to replace the generated silhouette. | User | No |
| 5 | Is Antonio a close enough display font, or should Oswald / Bebas Neue be tried? | User | No |
| 6 | frontend-2 (P1 review): cream `#FFFDE9` or white `#FFFFFF` as the single base surface (DES-051)? | User | No |
| 7 | frontend-2 (P1 review): type scale and tracking at 375 / 768 / 1024 / 1440 px (DES-057), incl. hero actions visible at 1440×900 and 390×844. | User | No |
| 8 | frontend-2 (P1 review): keep or drop route view transitions (DES-063, REQ-094)? | User | No |
| 9 | frontend-2: licences of Inter Tight, Public Sans and Antonio not yet verified from the Fontsource package licence files (packages not installed); builder verifies (UI-T-131) and stops if any is not SIL OFL 1.1. | Builder | No |
| 10 | frontend-2: header hide/reveal needs scroll direction (DES-056); see requirements open question 13. | User | No |
| 11 | frontend-2: the reference's hover-media tab showcase on the case-study page was not agreed and is not included; add later through `/feature` if wanted. | User | Yes |
