# Reference notes: mitali-portfolio (Variant: frontend-2)

> Written by the `reference-analyst` agent from a capture of https://theatlyx.com/sportfolio/ecommerce-brand-identity-redesign/
> on 2026-10-31 00:37 (capture made 2026-10-30, `--mode design`, 5 pages; plus two read-only headless probes of the primary
> page on 2026-10-31).
> These are OBSERVATIONS about structure, behaviour and design language. No text, images, logos, fonts or code from the
> reference are copied here or into the project. Everything the project ships is original or dummy content.
>
> Value markers: **(observed)** = measured from computed styles or a runtime probe; **(estimated)** = read from a screenshot;
> **(guess)** = inferred, not verified.

## 1. Rights and scope
- Reference: https://theatlyx.com/sportfolio/ecommerce-brand-identity-redesign/ (primary page). The home page, the services
  page and two service detail pages of the same site were used only for design-language context.
- Rights: **inspiration only** (no ownership, no permission).
- Mode: INSPIRATION (`/inspire`). We design an alternative front end ("Variant: frontend-2") for mitali-portfolio. Screens,
  content, data and features stay as they are and come from our own API; only visual and interaction design is inspired.
  Our own brand stays: primary #70FF00, dark #030500 / #0F1C00, cream #FFFDE9, muted #63635A (see `docs/design-brief.md`).
- What to take: typographic attitude (huge light, tightly tracked display headlines), editorial case-study layout (meta row,
  offset text columns, rounded media), hairline structure, restrained accent use, and the motion vocabulary (fade-up reveals,
  slow parallax media bands, scroll-drifting collage, arrow-swap link hover, slide-in mobile menu). Each is graded TAKE /
  ADAPT / SKIP below.
- What we deliberately do NOT copy: brand name, logo, wordmark, headings and copy, case-study content, client names, images
  and videos, the licensed display fonts, the orange accent hue, source code, plugin markup or class naming, the cookie
  banner and the third-party newsletter form.

## 2. Site map
Not collected in inspiration mode. (Our own screens stay as they are.)

## 3. Section and component inventory
Primary page, top to bottom, at 1440 px wide (observed order from scroll screenshots `screenshots/scroll-*.png`; document
height 10180 px desktop, 7139 px at 390 px wide, observed).

| # | Component | Layout pattern | Content type | Our replacement / use in frontend-2 |
|---|-----------|----------------|--------------|--------------------------------------|
| 1 | Header | Transparent, `position: absolute`, 80 px tall (observed); logo left, five text links right, two with a chevron dropdown; not sticky, scrolls away | Nav | Our nav items; logo is our wordmark placeholder (DES-002). ADAPT (see 5a) |
| 2 | Case hero | Small rounded thumbnail (~276x155, estimated) left, giant three-line headline right filling ~75 % of the width | Title + cover | Case-study detail hero: our cover image + our title |
| 3 | Meta row | Four equal columns, each with a 1 px top hairline, grey label above dark value (one column empty on this page) | Key/value | Our case-study meta (client, role, year, deliverables) |
| 4 | Full-bleed media band | Black band ~700+ px tall, video (blocked in probe), slow parallax | Video/image | Our hero image (no autoplay video) |
| 5 | Intro split | 50/50: section heading left (50 px), paragraph + short "+"-prefixed list right | Text | Our challenge/summary text and tag list |
| 6 | Gallery pair | Two images in one row, ~2:1 width split, 10 px gap, ~20 px radius (estimated) | Images | Our gallery images |
| 7 | Full-width image | Single rounded image across the container | Image | Our gallery image |
| 8 | Offset text block | Heading (~30 px) + paragraph + plain list, starting at ~37 % of the width (x ≈ 535 px), right-aligned column ~890 px (estimated) | Text | Our "approach"/"result" text |
| 9 | Hover-media showcase | Dark full-width 16:9 panel; three column titles across the top separated by vertical hairlines, active title white and underlined, others faded; hovering a title swaps the media; three short dash indicators below | Media + labels | Optional: tabbed showcase of up to three gallery images (ADAPT, see 4) |
| 10 | Coloured media band | Full-width image band | Image | Our gallery image |
| 11 | Second offset text block | As #8 | Text | Our results text |
| 12 | Scattered collage | 3-4 images of mixed sizes placed asymmetrically with big white space; each drifts sideways/vertically while scrolling (scrubbed) | Images | Our gallery images, drift softened (ADAPT) |
| 13 | Section header slide-in | Heading that slides in from the left | Text | "More work" heading (if our screen has one) |
| 14 | Footer CTA | Two-line very large headline with a thin diagonal arrow glyph and a thick (~4 px, estimated) underline as wide as the text | CTA link | Our contact CTA in our wording |
| 15 | Footer brand row | Hairline; very large logo left, short statement and underlined email right; hairline | Brand | Our wordmark + our contact email from the API/settings |
| 16 | Footer columns | Newsletter form left (~60 %); three link columns right (grey column label, dark 20 px links) | Links/form | Our footer links; no newsletter unless already in scope |
| 17 | Cookie banner | Bottom fixed bar with three buttons | Consent | SKIP (not part of our design; only if our app already has one) |

Context pages (design language only): home has an off-white warm-tinted hero with a 140 px uppercase headline and a pill
graphic between words; services has a 385 px condensed uppercase headline; service detail pages use a dark (#111111)
two-column hero with an embedded video.

## 4. Interactions and motion
Observed with Playwright (headless Chromium, GET only, media requests blocked, no form submitted, no login, no navigation
away; scripts `probe-motion.cjs` and `probe-motion-2.cjs`, results `motion-probe.json` and `motion-probe-2.json`, all in the
capture folder).

### 4.1 Libraries found (observed)
- GSAP **3.11.4** with **ScrollTrigger** (25 instances), **ScrollSmoother** (active), and loaded but unused on this page:
  SplitText (0 split elements), TextPlugin, CustomEase, Flip, ScrollToPlugin.
- Swiper and Owl Carousel scripts are loaded but **no slider instance exists on this page** (0 Swiper instances).
- A "magic cursor" plugin (custom cursor follower), a hover-video widget from an Elementor add-on, odometer/counter and
  progress-bar scripts (unused here), jQuery, Bootstrap 5 grid/breakpoints, WordPress + Elementor page builder.
- No Lenis, no Locomotive Scroll, no AOS/WOW. CSS keyframe library (Animate.css-style names) is present; only one CSS
  animation runs on the page (`opacity` fade-in, 0.5 s ease-in, 3 elements).

### 4.2 Effects and exact settings (observed)
| Effect | How it works | Settings | Grade for frontend-2 |
|--------|--------------|----------|----------------------|
| Fade-up reveal | 20 ScrollTrigger tweens, one per block (headings, paragraphs, lists, images), `from` state | `opacity 0 → 1`, `y 50 px → 0`, duration **1.15 s**, ease **power2.out**, delay **0.15 s**, start **"top 85%"**, toggleActions **"play"** (plays once, never reverses), no stagger, no scrub, no pin | TAKE (shorter, CSS + IntersectionObserver) |
| Slide-in from left | 1 tween on a section header | `opacity 0 → 1`, `x -50 px → 0`, same timing as above | ADAPT (use sparingly, one per page) |
| Smooth scroll | ScrollSmoother wraps the page in a fixed 1440x900 wrapper and transforms the content | `smooth 0.9` (s of lag), `smoothTouch 0.1`, `effects true`, `ignoreMobileResize true` | SKIP (scroll hijacking) |
| Parallax media bands | ScrollSmoother effects on 4 full-width wrappers | `data-speed 0.8` (moves at 80 % of scroll speed), `data-lag 0`; trigger "top bottom" → "bottom top" | ADAPT (CSS scroll-driven, no JS) |
| Scattered collage drift | 4 scrubbed tweens on one trigger | scrub **true**, start "top bottom", end "bottom center", custom ease; per image `xPercent -26`, `yPercent 10`, `xPercent 30`, `xPercent -172 / yPercent 34` | ADAPT (smaller offsets, CSS scroll-driven) |
| Pinning | none | — | — |
| Text splitting, counters, marquee | none on this page (libraries loaded but unused) | — | — |
| Nav link hover | CSS transition | colour dark → orange accent, `all 0.3s ease` (observed) | ADAPT (underline bar, contrast) |
| Desktop dropdown | CSS opacity/visibility | panel 250 px wide, bg #232529, padding 18 px 0, no radius, no shadow, items 16 px/500 light text with right chevrons and nested flyouts, transition **0.5 s** (observed) | SKIP unless our nav has children |
| Text link hover | CSS transition | colour #555555 → #111111, `all 0.3s ease` (observed) | TAKE |
| Arrow-swap on linked items | Icon inside an `overflow:hidden` box translates diagonally out (up-right) on hover | `transform: translate(103px, -103px)`, 0.3 s (observed); a second arrow entering from bottom-left is a (guess) | TAKE |
| Buttons (theme) | 44 elements share `background, border, box-shadow 0.3s, transform 0.4s ease` (observed) | measured hover only on consent buttons: `opacity 1 → 0.8` | ADAPT |
| Hover-media showcase | Hovering a column title activates that panel's video (accordion skin) | video playback could not be observed (media blocked) | ADAPT (tabs, no video autoplay) |
| Custom cursor | Fixed follower (z 150, pointer-events none) tracks the pointer with a transform; inner pill 80x30, radius 25 px, idle `scale(0.2)`, transition `transform 0.3s ease-in-out, opacity 0.1s`; adds a state class over links (observed); visible fill/colour could not be judged | — | SKIP |
| Mobile menu | Off-canvas panel (`transform` + `opacity` **0.45 s ease-in-out**) over a black backdrop (`opacity`, **0.5 s**) | toggle 50x50 circular, panel full width at 390 px (500 px wide on desktop), rows separated by hairlines, "+" toggles for sub-lists | ADAPT |
| Page / route transitions | none observed (no overlay fired on hover; navigation not exercised) | — | — |
| Reduced motion | **Not honoured**: with `prefers-reduced-motion: reduce` the same 25 triggers and the smoother were active (observed) | — | We must do better |

Per-scroll observation (400 px steps, `screenshots/scroll-00.png` … `scroll-24.png`): blocks appear as they cross 85 % of
the viewport and settle within ~1.3 s; media bands lag slightly behind the scroll; the collage images spread apart as the
section moves up; nothing pins, nothing loops.

### 4.3 How to re-create in React (frontend-2)
Performance budget: **≤ 30 KB gzip extra JS for motion on public pages** (target: ~1 KB, no library), no scroll event
handlers on the main thread, animate **only `transform` and `opacity`**, reserve all space up front (no layout shift),
`prefers-reduced-motion: reduce` turns every effect into an instant state.

1. **Reveal (TAKE).** One shared `IntersectionObserver` in a small `useReveal()` hook / `<Reveal>` wrapper
   (`rootMargin: "0px 0px -15% 0px"`, `threshold: 0`), which sets `data-revealed` and then unobserves (plays once, like the
   reference). CSS does the motion: hidden state `opacity: 0; transform: translateY(var(--reveal-distance))`, revealed state
   back to 0 with `transition: opacity var(--dur-reveal) var(--ease-out), transform var(--dur-reveal) var(--ease-out)`.
   Use 0.8 s instead of 1.15 s and 40 px instead of 50 px; optional stagger with `transition-delay: calc(var(--i) * 60ms)`
   capped at 4 items. SSR safety: only hide when `<html class="js">` is set by an inline script and motion is allowed, so
   server-rendered and no-JS content is never invisible.
2. **Smooth scroll (SKIP).** Native scrolling only. It keeps find-in-page, anchors, keyboard and screen-reader scrolling
   intact and costs no JS. If ever requested, Lenis (MIT, ~4 KB gzip) disabled on touch and under reduced motion.
3. **Parallax media bands and collage drift (ADAPT).** CSS scroll-driven animations, no JS:
   `@supports (animation-timeline: view()) { .parallax img { animation: drift linear both; animation-timeline: view(); } }`
   with `@keyframes drift { from { transform: translateY(-8%) } to { transform: translateY(8%) } }` on an image that is
   ~16 % taller than its `overflow: hidden` frame (frame keeps its aspect ratio, so no shift). Collage items use per-item
   custom properties (`--dx`, `--dy`, limited to about ±12 %) instead of the reference's very large offsets. Browsers without
   support show the static layout. Wrap in `@media (prefers-reduced-motion: no-preference)`.
4. **Arrow-swap hover (TAKE).** Two inline SVG arrows in an `overflow: hidden` box; on `:hover`/`:focus-visible` the first
   moves `translate(100%, -100%)` and the second moves in from `translate(-100%, 100%)` to 0, `var(--dur-base)`
   `var(--ease-out)`. Pure CSS.
5. **Nav hover (ADAPT).** Underline bar `transform: scaleX(0 → 1)` with `transform-origin: left`, `var(--dur-base)`, in
   `--color-primary` on dark surfaces; on cream use a dark bar (primary green fails as text/thin line on light, DES-013).
6. **Hover-media showcase (ADAPT).** A real tab list (`role="tablist"`, arrow-key navigation) of up to three items over one
   media frame; activate on hover, focus and tap; cross-fade images with `opacity var(--dur-slow)`. No autoplay rotation
   (or, if wanted, pausable and stopped under reduced motion, WCAG 2.2.2). Images from our API only.
7. **Mobile menu (ADAPT).** Full-screen panel `translateX(100% → 0)` `var(--dur-slow) var(--ease-in-out)` + backdrop opacity
   fade; focus moves into the panel, focus trap, `Esc` closes, `aria-expanded` on the toggle, background `inert`, body
   scroll lock. Reduced motion: no slide, instant show.
8. **Custom cursor (SKIP).** Needs a `pointermove` handler on every frame, adds nothing for content, and hurts users of
   assistive tech and touch devices.
9. **Library choice.** None needed for the above. If later wanted for route transitions or layout animations, Motion
   (motion.dev, MIT) with `LazyMotion` + `domAnimation` (~15 KB gzip, estimated from the vendor's docs, verify at build) fits
   the budget. GSAP core + ScrollTrigger is ~35-40 KB gzip (estimated) and exceeds the budget; its licence has been free
   for commercial use since 3.13 (including former bonus plugins such as ScrollSmoother and SplitText), but it is a
   proprietary "no charge" licence with usage restrictions, not open source; check the current terms before any use. Not
   recommended for this variant.

Proposed motion tokens (rounded from observed values):
| Token | Value | Basis |
|-------|-------|-------|
| `--dur-fast` | 150 ms | input transition 0.15 s (observed) |
| `--dur-base` | 300 ms | links, nav, arrow 0.3 s (observed) |
| `--dur-slow` | 450 ms | menu panel 0.45 s (observed) |
| `--dur-reveal` | 800 ms | reveal 1.15 s (observed), shortened |
| `--ease-out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | close to power2.out (observed ease) |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | menu ease-in-out (observed) |
| `--reveal-distance` | 40 px | 50 px (observed), reduced |

## 5. Design language (input for design-brief.md)
- Colour roles observed (primary page and context pages, computed styles):
  - Page background #FFFFFF; warm off-white tint #FCF7F3 on home/service heroes; light surface #F0F0F0 / #F8F8F8.
  - Headings #111111; body copy #555555 (secondary paragraphs), stronger text #212121; muted labels #999999.
  - Dark surfaces #111111 (most frequent dark), #000000 for media frames, #232529 for the dropdown panel.
  - Accent: a single saturated orange (logo, the consent "accept" button, nav hover); a blue (#204CE5) and a red (#C02B0A)
    appear only in a third-party form (submit button and required marker), not part of the design language.
  - Relationship: an almost monochrome neutral system (white → #F0F0F0 → #999999 → #555555 → #111111 → #000000) with the
    accent used on very few elements; colour in the page comes from the imagery, not from the UI.
- Typography: see 5a. Display: a licensed light grotesk at weight 300 with very tight negative tracking; body: DM Sans.
- Spacing rhythm, container widths, radii, shadows: near full-bleed content with ~15 px side gutters at 1440 (estimated from
  screenshots, content x = 15…1425); header content inset ~75 px; generous vertical gaps of ~80-120 px between blocks
  (estimated); 1 px light hairlines for structure; radii 8 px (most frequent, 32 uses), 20 px (media), 2-3 px (buttons,
  inputs), 50 % (round toggle) (observed); essentially no shadows on page content (only the consent bar and form inputs).
- Light/dark behaviour: no dark mode (observed); dark full-width bands and dark hero sections are used as contrast blocks.
- Responsive behaviour: see 5a item 4.

### 5a. Inspiration detail

#### 1. Typography (ADAPT)
Observed (primary page unless noted):
| Role | Family | Size / line height | Weight | Letter spacing | Case | Colour |
|------|--------|--------------------|--------|----------------|------|--------|
| h1 (case hero) | Sequel Sans Roman Body | 100 / 90 px (0.9) | 300 (face 310) | -7 px (-0.07 em) | sentence | #111111 |
| h1 (home) | Sequel Sans Roman Body | 140 / 119 px (0.85) | 310 | -12.6 px (-0.09 em) | uppercase | #111111 |
| h1 (services) | Thunder | 385 / 308 px (0.8) | 600 | -7.7 px (-0.02 em) | uppercase | #111111 |
| h2 | Sequel Sans Roman Body | 50 / 50 px (1.0); 36 / 41.8 on home | 300 | -3.5 px (-0.07 em) | sentence | #111111 |
| h3 / h4 (context pages) | Sequel Sans Roman/Medium Body | 30 / 30-36 px; 40 / 36 px | 300-400 | -2.1 to -3 px (-0.07 to -0.1 em) | mixed | #111111 / white |
| Body paragraphs | DM Sans | ~20 / 28 px (estimated from screenshots) | 400 | normal | sentence | #555555 |
| p (first measured) | DM Sans | 18 / 24 px | 700 | normal | — | #212121 |
| Links / list values | DM Sans | 20 px (observed link) | 400 | normal | — | #555555 → #111111 |
| Nav | DM Sans | 16 / 16 px | 400 | normal | title case | #111111 / #555555 |
| Dropdown items | DM Sans | 16 px | 500 | normal | — | light grey on #232529 |
| Buttons (consent only) | DM Sans | 14 px | 500 | normal | — | — |
| Small / labels | not measured; meta labels look ~18 px #555555-#999999 (estimated) | | | | | |

Licence status and alternatives:
| Observed family | Status | Use? | Free alternative (self-host via Fontsource) |
|-----------------|--------|------|---------------------------------------------|
| Sequel Sans (Roman/Medium Body) | Commercial (retail foundry licence) | **Do not use** | **Inter Tight** (SIL OFL 1.1, `@fontsource-variable/inter-tight`) weight 300; or **Hanken Grotesk** (OFL, `@fontsource-variable/hanken-grotesk`) |
| Thunder | Commercial / licence unknown | **Do not use** | **Anton** (OFL) or our **Antonio** (OFL) for condensed uppercase |
| BDO Grotesk | Licence not verified (believed free, unverified) | Do not use until verified | not needed |
| DM Sans | SIL OFL 1.1 | Usable, but only self-hosted from Fontsource (`@fontsource-variable/dm-sans`), never from the reference | — |
| Instrument Sans | SIL OFL 1.1 | Not needed (1 use) | — |
| Font Awesome Free (icons) | Fonts OFL, icons CC BY 4.0 | SKIP | our own inline SVG icons |

Recommendation for frontend-2: the reference's character is a **light, tightly tracked grotesk display** against a
neutral sans body; our Antonio is condensed bold uppercase, the opposite attitude. Options for the user (open question 1):
- (a) ADAPT, recommended: display **Inter Tight 300** (headings h1-h3) with `letter-spacing: -0.05em` at display sizes and
  line height 0.9-1.0; keep **Public Sans** (OFL) for body (same role as DM Sans, already in the project, no new body font);
  keep **Antonio** only for the wordmark and small uppercase labels so the brand link survives. Adds one font family
  (variable, latin subset, ~25-35 KB woff2, estimated).
- (b) Keep Antonio + Public Sans and borrow only the scale and spacing (zero new fonts; least like the reference).
Proposed scale tokens (desktop → mobile with `clamp()`): `--text-display` 100 → 40 px, lh 0.9; `--text-h2` 50 → 30 px,
lh 1.0; `--text-h3` 30 → 24 px, lh 1.15; `--text-body-lg` 20 px / 1.4; `--text-body` 16-18 px / 1.5; `--text-nav` 16 px;
`--text-label` 14 px. Tracking tokens: `--tracking-display -0.05em`, `--tracking-heading -0.03em`, body `normal`.
Mobile display sizes are (estimated) from the 390 px screenshot.

#### 2. Colour scheme (ADAPT, relationships only)
- TAKE the **relationship**: neutral-first UI, one accent used sparingly (one primary CTA per view, active/hover indicator,
  small marks), imagery carries the colour; dark full-bleed bands as rhythm breaks; hairline dividers instead of boxes.
- ADAPT to our brand: base surface cream #FFFDE9 (our warm tint plays the role of their #FCF7F3/#FFFFFF), text #030500,
  secondary text #63635A (their #555555 role), muted labels a lighter step of #63635A (their #999999 role; check 4.5:1 on
  cream before use, else keep #63635A), surface step a slightly darker cream (their #F0F0F0 role), dark bands #0F1C00 /
  #030500 (their #111111 / #000000 roles).
- Accent #70FF00 only as fills with dark text, as underline bars/indicators on dark surfaces, and in the footer CTA arrow on
  dark; never as text or thin lines on cream (fails contrast, DES-013). The reference's orange hue is not used.
- SKIP: the form's blue and red (third-party defaults).

#### 3. Styling and UI/UX feel
| Element | Observed | Grade |
|---------|----------|-------|
| Spacing rhythm | Large vertical gaps (~80-120 px, estimated) between blocks; tight 10 px gaps inside image rows; meta row gutters ~60 px (estimated) | TAKE (map to our `--space-*`) |
| Grid / container | Near full-bleed, ~15 px gutters at 1440; header inset ~75 px; text either 50/50 split or offset to start at ~37 % width; meta row = 4 equal columns | ADAPT (use a 12-col grid: offset blocks = columns 5-12, meta = 4 x 3 cols; gutters 16-24 px) |
| Buttons | Page itself uses text links and a giant underlined CTA, not boxed buttons; measured buttons belong to the consent bar: 44 px tall, 2 px solid border, 2 px radius, 14 px/500, padding 8 / 27 px, hover opacity 0.8 | ADAPT: outline button with 2 px border and near-square radius (`--radius-0` / 2 px), 44-48 px tall; primary = green fill + dark text; hover = underline/arrow motion, not opacity |
| Inputs | Third-party form: 38 px tall, 1 px #686E77 border, 3 px radius, faint shadow, `all 0.15s` | SKIP styling (keep ours); TAKE only the `--dur-fast` focus transition |
| Cards / linked items | No card chrome; linked items are image + text with an arrow icon that swaps on hover; text links darken on hover | TAKE (cardless, arrow swap) |
| Pop-ups / overlays | Only the consent modal (845x711, 6 px radius, large soft shadow) and the off-canvas menu with black backdrop | ADAPT the off-canvas menu only |
| Navigation | Transparent absolute header, not sticky; dark dropdown panels; mobile: circular toggle → off-canvas | ADAPT (keep our items; a non-sticky header is acceptable on long case pages, or sticky with reduced height: open question 3) |
| Footer | Giant two-line CTA with arrow and thick underline → hairline → big logo + statement + email → hairline → form + three link columns with grey labels | TAKE the structure with our content (our wordmark placeholder, no drawn logo) |
| Imagery | Rounded corners (~20 px, 8 px on small items), no captions, no hover zoom on gallery images, mixed aspect ratios (16:9 bands, ~2:1 + ~1:1 pairs, portrait collage pieces), dark frames for video | ADAPT: `--radius-media` 16 px, fixed `aspect-ratio` per slot to avoid shift, no captions unless our data has alt/caption |
| Borders / radii / shadows | 1 px light hairlines; radii 2/3/8/20 px and 50 %; no content shadows | TAKE: flat, hairline-structured; tokens `--radius-0` 0, `--radius-sm` 2 px, `--radius-md` 8 px, `--radius-media` 16 px, `--radius-full` |

#### 4. Responsive structure (TAKE the pattern)
- Breakpoints in the CSS (observed): Bootstrap set 576 / 768 / 992 / 1200 / 1400 px, plus page-builder 767 / 1024 px and
  large-screen steps 1600-1920 px. The point where the nav collapses to the toggle was not measured (collapsed at 390 px,
  observed; guess: below 1200 px).
- Reflow at 390 px (observed from the mobile screenshot): hero thumbnail goes full width above the headline; headline drops
  to roughly 40 px (estimated) on 4 lines; meta row stacks to one column; 50/50 and offset text blocks become one column;
  image pairs stack; collage becomes a vertical stack; footer stacks (logo, statement, link groups, form).
- Mobile navigation: logo left, 50x50 circular outlined toggle right (observed); full-screen white panel with logo and a
  circular close button, hairline-separated rows (~51 px tall, estimated), 20 px text, "+" expanders for sub-lists.
- Touch targets: toggle 50x50 and menu rows ~51 px pass 44 px; footer link spacing (~30 px, estimated) is below 44 px on
  mobile, so we raise it to ≥ 44 px.
- Proposed tokens: keep our breakpoints; if none, `--bp-sm 576`, `--bp-md 768`, `--bp-lg 1024`, `--bp-xl 1280`.

#### 5. Animation and motion
See section 4: TAKE reveal and arrow swap; ADAPT parallax, collage drift, nav hover, showcase tabs, mobile menu; SKIP smooth
scroll, custom cursor and dropdown styling.

## 6. Data the site shows (shapes only)
Not collected in inspiration mode.

## 7. Dummy data plan
Not collected in inspiration mode. (frontend-2 uses our existing API and seed data; no reference content.)

## 8. Draft requirements (untagged; `requirements` skill turns them into REQ items)
Not collected in inspiration mode.

## 9. Not observable, and open questions
Not observable:
- Video content and the hover-media showcase playback (media requests were blocked on purpose).
- Visual appearance of the custom cursor (its fill colour/border could not be judged from computed styles).
- Exact nav-collapse breakpoint, mobile type scale (estimated from a screenshot only), tablet layouts (no tablet capture).
- Route/page transitions (navigation not exercised), and any server, CMS or form behaviour (form never submitted).
- Whether SplitText, counters or sliders are used on other pages (libraries are loaded site-wide; unused on this page).
- Precise hairline colour and section paddings (sections are page-builder wrappers; values marked estimated).

Open questions for the user:
1. Typography for frontend-2: option (a) Inter Tight 300 display + Public Sans body + Antonio for wordmark/labels, or
   option (b) keep Antonio + Public Sans and borrow only scale and spacing?
2. Base surface for frontend-2: cream-first with dark bands (recommended), or keep the current dark/cream alternation?
3. Header: non-sticky like the reference, or sticky with a compact height on scroll?
4. Include the hover-media tab showcase on the case-study screen (only if a case study has ≥ 2 gallery images)?
5. Accept the motion plan without any animation library (CSS + one IntersectionObserver), keeping Motion as a later option?
