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
- DES-021 [NEW 2026-10-29 16:06] Type scale and line height (desktop → mobile via `clamp()`):

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

## 7. Open questions
| # | Question | Owner | Resolved? |
|---|----------|-------|-----------|
| 1 | Logo file (SVG, light and dark variants) to replace the "MITALI" wordmark. | User | No |
| 2 | Primary green fails as text on cream/white (1.28-1.31:1); handled by DES-013 (never used as text on light). Accepted in the intake. | User | Yes |
| 3 | Muted #63635A fails on dark (2.92:1); replaced on dark by #A3A396. | Design | Yes |
| 4 | Real portrait photo of Mitali to replace the generated silhouette. | User | No |
| 5 | Is Antonio a close enough display font, or should Oswald / Bebas Neue be tried? | User | No |
