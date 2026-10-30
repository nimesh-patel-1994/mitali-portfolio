"""Original dummy content for the seed command (BE-023, TS-017, REQ-070, SEC-007).

Theme: the work of a content writer and marketing strategist. Every client, person, number and sentence below is
fictional and written for this project; nothing comes from the reference site. Email addresses use ``example.com``
only and links point to ``example.com`` or ``#``. Metrics are illustrative and seeded with ``is_sample = true``.

Every record has a stable ``seed_key`` so re-runs never duplicate rows (TS-017 step 2).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Final

from app.models.singletons import CONTACT_PROMISE_DEFAULT, FOOTER_RIGHTS_LINE_DEFAULT


@dataclass(frozen=True)
class SeedResult:
    metric_label: str
    value: str
    before_value: str | None
    change_text: str | None
    period: str | None
    chart_value: float  # bar height for the generated "Sample data" chart


@dataclass(frozen=True)
class SeedCaseStudy:
    slug: str
    title: str
    client_name: str
    client_industry: str
    campaign_type: str
    channels: tuple[str, ...]
    goals: tuple[str, ...]
    summary: str
    problem_md: str
    solution_md: str
    year: int
    timeline: str
    is_featured: bool
    palette: tuple[str, str]
    tagline: str
    pillars: tuple[str, str, str]
    gallery: tuple[str, ...]  # image kinds, 6-8 per case study
    results: tuple[SeedResult, SeedResult, SeedResult]

    @property
    def seed_key(self) -> str:
        return f"cs:{self.slug}"


@dataclass(frozen=True)
class SeedWritingSample:
    slug: str
    title: str
    format: str
    client_name: str | None
    industry: str | None
    excerpt: str
    body_md: str
    published_on: date
    tags: tuple[str, ...]
    is_featured: bool = False

    @property
    def seed_key(self) -> str:
        return f"ws:{self.slug}"


@dataclass(frozen=True)
class SeedFaqCategory:
    key: str
    name: str
    faqs: tuple[tuple[str, str, bool], ...]  # (question, answer, show_in_preview)


@dataclass(frozen=True)
class SeedTestimonial:
    key: str
    quote: str
    author_name: str
    author_role: str
    company: str
    case_study_slug: str | None


@dataclass(frozen=True)
class SeedEnquiry:
    key: str
    name: str
    email: str
    company: str | None
    enquiry_type: str
    budget_range: str | None
    message: str
    status: str


@dataclass(frozen=True)
class SeedProfile:
    name: str
    headline: str
    bio: tuple[str, ...]
    skills: tuple[str, ...]
    tools: tuple[str, ...]
    years_experience: int
    origin_statement: str
    vision_blocks: tuple[tuple[str, str], tuple[str, str]]
    portrait_alt: str


@dataclass(frozen=True)
class SeedSettings:
    contact_email: str
    booking_url: str
    social_links: tuple[tuple[str, str], ...]
    footer_signoff: str
    contact_promise: str
    footer_rights_line: str
    notification_email: str | None = None


@dataclass(frozen=True)
class SeedSimple:
    key: str
    fields: dict[str, object] = field(default_factory=dict)


# ---------------------------------------------------------------------------------------------- case studies

CASE_STUDIES: Final[tuple[SeedCaseStudy, ...]] = (
    SeedCaseStudy(
        slug="verdant-loop",
        title="A waitlist that grew before the first pot shipped",
        client_name="Verdant Loop",
        client_industry="D2C plant care",
        campaign_type="Product launch",
        channels=("Email", "Instagram", "Blog"),
        goals=("Build a pre-launch waitlist", "Explain self-watering simply"),
        summary=(
            "Verdant Loop was about to launch a self-watering planter and had a product nobody could picture yet. "
            "We built a launch story around one promise, wrote a six-email warm-up sequence and turned care questions "
            "into short posts that pointed back to the waitlist."
        ),
        problem_md=(
            "The founders had spent two years on the planter and could describe every valve. Prospective buyers, "
            "though, only wanted to know one thing: *will my plants stay alive while I travel?*\n\n"
            "Early drafts led with engineering detail, the waitlist page converted poorly and the Instagram account "
            "posted pretty photos without a reason to sign up."
        ),
        solution_md=(
            "## One promise, repeated everywhere\n\n"
            "We framed the launch around **two weeks without watering** and tested three headlines on the waitlist "
            "page.\n\n"
            "- A six-email warm-up sequence answering one care question each\n"
            "- Short Instagram captions ending in a single clear invitation\n"
            "- Two blog guides that ranked for travel-and-plants searches"
        ),
        year=2025,
        timeline="10 weeks",
        is_featured=True,
        palette=("#1F4D2B", "#A7D46F"),
        tagline="Two weeks. Zero watering.",
        pillars=("Calm care", "Proof before promise", "Plants first"),
        gallery=("key-visual", "email", "social", "blog", "chart", "pillars", "landing", "social-alt"),
        results=(
            SeedResult("Waitlist sign-ups", "3,200", "0", None, "8 weeks before launch", 3200),
            SeedResult("Warm-up email open rate", "41 %", "24 %", "+17 pts", "6-email sequence", 41),
            SeedResult("Launch-week conversion", "4.1 %", "1.9 %", "+116 %", "Launch week", 4.1),
        ),
    ),
    SeedCaseStudy(
        slug="northpeak-ledger",
        title="Turning invoicing questions into organic sign-ups",
        client_name="Northpeak Ledger",
        client_industry="B2B fintech SaaS",
        campaign_type="SEO content programme",
        channels=("Blog", "LinkedIn"),
        goals=("Grow organic trial sign-ups", "Rank for invoicing questions"),
        summary=(
            "Northpeak Ledger sells invoicing software to small agencies. Its blog published product news nobody "
            "searched for. A keyword map built from support tickets and a steady publishing rhythm turned the blog "
            "into the largest source of trial sign-ups."
        ),
        problem_md=(
            "The blog had forty posts and almost no search traffic. Most articles announced features, and the few "
            "helpful ones were buried without internal links.\n\n"
            "Sales calls kept hearing the same questions about late payments and tax fields, yet none of them had an "
            "answer on the site."
        ),
        solution_md=(
            "We mapped **sixty real customer questions** from support tickets to search terms and grouped them into "
            "four topic clusters.\n\n"
            "1. Two in-depth guides a month, each answering one cluster question\n"
            "2. A LinkedIn series that turned every guide into five short lessons\n"
            "3. Internal links from every guide to a matching free template"
        ),
        year=2024,
        timeline="16 weeks",
        is_featured=True,
        palette=("#14213D", "#7FB7FF"),
        tagline="Answers first. Software second.",
        pillars=("Useful over clever", "One question per page", "Templates that travel"),
        gallery=("key-visual", "blog", "social", "chart", "pillars", "landing"),
        results=(
            SeedResult("Organic traffic", "+164 %", None, "+164 %", "6 months", 164),
            SeedResult("Trial sign-ups from the blog", "310 / month", "95 / month", "+226 %", "Month 6", 310),
            SeedResult("Keywords in the top 10", "48", "6", "+42", "6 months", 48),
        ),
    ),
    SeedCaseStudy(
        slug="kesar-and-clay",
        title="A festive season told one handmade story at a time",
        client_name="Kesar and Clay",
        client_industry="Artisan homeware",
        campaign_type="Festive-season campaign",
        channels=("Email", "Instagram", "WhatsApp"),
        goals=("Lift festive revenue from email", "Introduce the makers"),
        summary=(
            "Kesar and Clay works with small pottery studios. Its festive emails looked like every other sale. "
            "We replaced discount banners with short maker stories, a gift guide by recipient and a WhatsApp "
            "reminder flow for last-minute shoppers."
        ),
        problem_md=(
            "Every festive season the brand sent the same countdown emails with a percentage in the subject line. "
            "Open rates held, but clicks fell each year and unsubscribes rose in the busiest week.\n\n"
            "The makers behind the products, the brand's real difference, never appeared in the campaign."
        ),
        solution_md=(
            "## Stories instead of discounts\n\n"
            "Each email introduced **one maker and one object**, with a gift idea for a specific person.\n\n"
            "- A gift guide sorted by recipient rather than by product type\n"
            "- Instagram carousels showing an object from clay to kiln\n"
            "- An opt-in WhatsApp reminder two days before the last shipping date"
        ),
        year=2023,
        timeline="6 weeks",
        is_featured=True,
        palette=("#7A2E1F", "#F2B36B"),
        tagline="Made by hand. Chosen with care.",
        pillars=("Meet the maker", "Gifts by person", "Unhurried warmth"),
        gallery=("key-visual", "email", "social", "chart", "pillars", "social-alt", "landing"),
        results=(
            SeedResult("Email click-through rate", "5.8 %", "2.6 %", "+3.2 pts", "Festive season", 5.8),
            SeedResult("Social engagement rate", "+118 %", None, "+118 %", "Campaign weeks", 118),
            SeedResult("Festive revenue from email", "+46 %", None, "+46 %", "Year on year", 46),
        ),
    ),
    SeedCaseStudy(
        slug="brightpath-tutors",
        title="Homepage copy that books more demo lessons",
        client_name="Brightpath Tutors",
        client_industry="Edtech",
        campaign_type="Website copy rewrite",
        channels=("Website",),
        goals=("Increase demo bookings", "Speak to parents, not search engines"),
        summary=(
            "Brightpath Tutors offers online maths tutoring. Its website spoke in teaching jargon and buried the free "
            "demo lesson. A rewrite of five key pages around parents' worries doubled the share of visitors who "
            "booked a demo."
        ),
        problem_md=(
            "Parents arrived worried about a test in three weeks. The homepage greeted them with a methodology "
            "diagram and four paragraphs about pedagogy.\n\n"
            "The free demo lesson, the offer most likely to convert, appeared only in the footer."
        ),
        solution_md=(
            "We interviewed six parents and rewrote the homepage, pricing, about and two subject pages.\n\n"
            "- A headline that names the worry and the next step\n"
            "- The demo lesson as the single primary action on every page\n"
            "- Tutor profiles written as short, human introductions"
        ),
        year=2025,
        timeline="5 weeks",
        is_featured=True,
        palette=("#2B2D6E", "#FFD166"),
        tagline="Confidence before the next test.",
        pillars=("Parents first", "One clear next step", "Warm expertise"),
        gallery=("key-visual", "landing", "blog", "chart", "pillars", "email"),
        results=(
            SeedResult("Demo booking rate", "2.9 %", "1.1 %", "+164 %", "8 weeks after launch", 2.9),
            SeedResult("Homepage bounce rate", "38 %", "61 %", "-23 pts", "8 weeks after launch", 38),
            SeedResult("Average time on page", "2 min 40 s", "1 min 05 s", "+146 %", "Homepage", 160),
        ),
    ),
    SeedCaseStudy(
        slug="harbour-wellness-clinic",
        title="A patient-education hub people actually read",
        client_name="Harbour Wellness Clinic",
        client_industry="Healthcare",
        campaign_type="Patient-education content hub",
        channels=("Blog", "Newsletter"),
        goals=("Answer common patient questions", "Grow the newsletter"),
        summary=(
            "Harbour Wellness Clinic wanted fewer repeated phone questions and more informed patients. We planned a "
            "content hub of plain-language articles reviewed by clinicians and a monthly newsletter that grew "
            "fourfold in a year."
        ),
        problem_md=(
            "Reception staff answered the same questions about preparation, recovery and referrals dozens of times "
            "a week. Existing leaflets were long PDFs written for other clinicians.\n\n"
            "The clinic's newsletter went out irregularly and mostly announced staff changes."
        ),
        solution_md=(
            "## Plain language, clinically reviewed\n\n"
            "We built an editorial calendar of **thirty articles**, each reviewed by a clinician before publishing.\n\n"
            "1. A reading-age check on every article\n"
            "2. One practical checklist per topic, printable at reception\n"
            "3. A monthly newsletter featuring one question patients asked that month"
        ),
        year=2024,
        timeline="12 weeks",
        is_featured=False,
        palette=("#0E4D5C", "#9ADBC5"),
        tagline="Clear answers, calmer visits.",
        pillars=("Plain words", "Clinician checked", "One step at a time"),
        gallery=("key-visual", "blog", "email", "chart", "pillars", "landing", "social"),
        results=(
            SeedResult("Newsletter subscribers", "2,450", "600", "+308 %", "12 months", 2450),
            SeedResult("Returning readers", "34 %", "12 %", "+22 pts", "Month 9", 34),
            SeedResult("Enquiries from articles", "+72 %", None, "+72 %", "12 months", 72),
        ),
    ),
    SeedCaseStudy(
        slug="trailmix-travel-co",
        title="A brand voice for small-group adventures",
        client_name="Trailmix Travel Co.",
        client_industry="Travel",
        campaign_type="Brand-messaging refresh",
        channels=("Website", "Social"),
        goals=("Clarify what makes the trips different", "Unify the tone across channels"),
        summary=(
            "Trailmix Travel Co. runs small-group hiking trips. Three people wrote its copy in three different "
            "voices. A messaging framework, a short tone guide and rewritten trip pages gave the brand one "
            "recognisable way of speaking."
        ),
        problem_md=(
            "Trip pages listed distances and altitudes but never said who the trips were for. Social posts swung "
            "between jokes and formal notices.\n\n"
            "In a customer survey, fewer than a third of past travellers could say what made the company different."
        ),
        solution_md=(
            "We ran two workshops with the guides and wrote a **one-page messaging framework**.\n\n"
            "- Three brand pillars with proof points from real trips\n"
            "- A tone guide with do and don't examples for each channel\n"
            "- Rewritten pages for the eight most-booked trips"
        ),
        year=2022,
        timeline="8 weeks",
        is_featured=False,
        palette=("#3B2F1E", "#E8A33D"),
        tagline="Small groups. Big quiet places.",
        pillars=("Small by design", "Guides who know the trail", "Leave it better"),
        gallery=("key-visual", "landing", "social", "chart", "pillars", "social-alt"),
        results=(
            SeedResult("Brand recall in survey", "52 %", "31 %", "+21 pts", "Post-campaign survey", 52),
            SeedResult("Social engagement rate", "6.4 %", "2.9 %", "+3.5 pts", "3 months", 6.4),
            SeedResult("Newsletter sign-ups", "+88 %", None, "+88 %", "3 months", 88),
        ),
    ),
)

# ---------------------------------------------------------------------------------------------- writing samples

WRITING_SAMPLES: Final[tuple[SeedWritingSample, ...]] = (
    SeedWritingSample(
        slug="content-calendar-for-small-brands",
        title="How to build a content calendar a small team can keep",
        format="blog",
        client_name="Northpeak Ledger",
        industry="B2B fintech SaaS",
        excerpt=(
            "Most content calendars fail in week three. This guide shows a small team how to plan a quarter of "
            "content around real customer questions, a realistic rhythm and one hour of review each Friday."
        ),
        body_md=(
            "# Start with questions, not dates\n\n"
            "A calendar full of dates and no ideas is a promise you will break. Begin with a list of the questions "
            "your customers ask in sales calls, support tickets and comments. Each good question is one piece.\n\n"
            "## Pick a rhythm you can keep for twelve weeks\n\n"
            "Two strong articles a month beat eight rushed ones. Decide what you can publish when things get busy, "
            "not when everything goes well.\n\n"
            "- One cornerstone guide a month\n"
            "- One shorter answer post a month\n"
            "- Five social posts drawn from each guide\n\n"
            "## Give every piece a single job\n\n"
            "Before writing, finish this sentence: *after reading, the reader will…* If you cannot, the piece is not "
            "ready.\n\n"
            "## Review on Fridays\n\n"
            "Spend one hour each Friday checking what was published, what slipped and what you learned. Move pieces "
            "rather than cramming them in. A calendar is a plan, not a contract."
        ),
        published_on=date(2025, 3, 12),
        tags=("Content strategy", "Planning", "Small teams"),
        is_featured=True,
    ),
    SeedWritingSample(
        slug="product-pages-that-convert",
        title="Writing product pages that answer the question behind the click",
        format="blog",
        client_name="Verdant Loop",
        industry="D2C plant care",
        excerpt=(
            "Shoppers rarely read a product page from top to bottom. They scan for the answer to one worry. This "
            "article walks through finding that worry and writing the page around it."
        ),
        body_md=(
            "# Find the worry\n\n"
            "Every product page visit carries a quiet question: *will this work for me?* Read reviews, returns notes "
            "and customer emails until the same worry appears three times. That is your headline.\n\n"
            "## Lead with the outcome\n\n"
            "Describe what life looks like after the purchase before you describe the product. Features earn their "
            "place only when they prove the outcome.\n\n"
            "## Make proof easy to find\n\n"
            "1. One short customer quote near the top\n"
            "2. A plain answer to the most common objection\n"
            "3. Care, delivery and returns in three short lines\n\n"
            "## End with one clear action\n\n"
            "Two buttons split attention. Choose the action that matters and make everything else a link."
        ),
        published_on=date(2024, 9, 4),
        tags=("Copywriting", "E-commerce", "Conversion"),
    ),
    SeedWritingSample(
        slug="brightpath-homepage-rewrite",
        title="Homepage rewrite: Brightpath Tutors",
        format="web_copy",
        client_name="Brightpath Tutors",
        industry="Edtech",
        excerpt=(
            "A homepage rewrite for an online maths tutoring service, written for parents a few weeks before an "
            "important test. Sample copy with the structure and the reasoning behind each section."
        ),
        body_md=(
            "# Maths confidence before the next test\n\n"
            "One-to-one online lessons with patient tutors who explain things until they click. Book a free "
            "30-minute demo lesson and see the difference in one session.\n\n"
            "## How it works\n\n"
            "1. Tell us the topic and the test date\n"
            "2. Meet your tutor in a free demo lesson\n"
            "3. Choose a weekly plan that fits your calendar\n\n"
            "## Why parents choose us\n\n"
            "- Tutors who teach the way your child learns\n"
            "- A short progress note after every lesson\n"
            "- No contracts: pause or stop at any time\n\n"
            "**Book a free demo lesson.** It takes two minutes and there is nothing to pay."
        ),
        published_on=date(2025, 6, 18),
        tags=("Web copy", "Education", "Homepage"),
        is_featured=True,
    ),
    SeedWritingSample(
        slug="trailmix-about-page",
        title="About page: Trailmix Travel Co.",
        format="web_copy",
        client_name="Trailmix Travel Co.",
        industry="Travel",
        excerpt=(
            "An about page for a small-group hiking company, written to show who the trips are for and why the "
            "groups stay small. Sample copy written in the brand's refreshed voice."
        ),
        body_md=(
            "# Small groups. Big quiet places.\n\n"
            "We started Trailmix because the best days on a trail are the quiet ones: a shared lunch on a ridge, a "
            "guide who knows which bend hides the view, a group small enough that everyone talks.\n\n"
            "## Who we walk with\n\n"
            "Our trips suit people who like a full day outdoors and a good conversation at dinner. You do not need "
            "to be fast. You need to be curious.\n\n"
            "## How we travel\n\n"
            "- Never more than twelve walkers on a trip\n"
            "- Local guides who live near the trail\n"
            "- Routes that leave paths in better shape than we found them"
        ),
        published_on=date(2023, 4, 2),
        tags=("Web copy", "Brand voice", "Travel"),
    ),
    SeedWritingSample(
        slug="verdant-loop-welcome-sequence",
        title="Welcome sequence, email 1: Two weeks without watering",
        format="email",
        client_name="Verdant Loop",
        industry="D2C plant care",
        excerpt=(
            "The first email of a six-part warm-up sequence for a self-watering planter launch. It thanks new "
            "subscribers, sets expectations and answers the one question everybody asks first."
        ),
        body_md=(
            "**Subject:** Your plants, two weeks from now\n\n"
            "Hi there,\n\n"
            "Thanks for joining the Verdant Loop waitlist. Over the next few weeks we will send one short email "
            "every few days, each answering a question about keeping plants happy while life gets busy.\n\n"
            "Today's question is the big one: *how long can a plant really go without you?* With our planter, two "
            "weeks. The reservoir holds enough water for most leafy plants, and a small window shows when it is "
            "time to refill.\n\n"
            "Next time: which plants love self-watering, and which ones would rather you didn't.\n\n"
            "Talk soon,\nThe Verdant Loop team"
        ),
        published_on=date(2025, 2, 10),
        tags=("Email", "Welcome sequence", "Launch"),
    ),
    SeedWritingSample(
        slug="kesar-and-clay-last-shipping-day",
        title="Reminder email: the last festive shipping day",
        format="email",
        client_name="Kesar and Clay",
        industry="Artisan homeware",
        excerpt=(
            "A short reminder email for an artisan homeware shop, sent two days before the last festive shipping "
            "date. Warm, unhurried and built around one maker's story."
        ),
        body_md=(
            "**Subject:** Two days left to send something handmade\n\n"
            "Hello,\n\n"
            "Every bowl in this week's collection was thrown by Asha in her studio by the river. She leaves a thumb "
            "print near the base of each one, so no two are the same.\n\n"
            "If you would like one to arrive before the festival, order by Thursday evening. After that, we will "
            "still wrap it with care, it will simply arrive a little later.\n\n"
            "With warm wishes,\nKesar and Clay"
        ),
        published_on=date(2023, 10, 24),
        tags=("Email", "Retail", "Seasonal"),
    ),
    SeedWritingSample(
        slug="northpeak-linkedin-series",
        title="LinkedIn series: five invoicing lessons for agency owners",
        format="social",
        client_name="Northpeak Ledger",
        industry="B2B fintech SaaS",
        excerpt=(
            "A five-post LinkedIn series that turns one long invoicing guide into short, practical lessons. Each "
            "post stands on its own and ends with one question for the reader."
        ),
        body_md=(
            "**Post 1.** Late invoices are rarely about money. They are about clarity. Name the work, the date and "
            "the amount in the first line. What does your first line say today?\n\n"
            "**Post 2.** Send the invoice the day the work ends, not at the end of the month. Memory fades faster "
            "than gratitude.\n\n"
            "**Post 3.** Payment terms are a conversation, not a footnote. Agree them before you start.\n\n"
            "**Post 4.** A friendly reminder three days before the due date saves an awkward one three days after.\n\n"
            "**Post 5.** Track who pays late and why. Patterns tell you which clients need a different arrangement."
        ),
        published_on=date(2024, 11, 6),
        tags=("Social", "LinkedIn", "B2B"),
    ),
    SeedWritingSample(
        slug="verdant-loop-instagram-captions",
        title="Instagram caption set: plant care in under fifty words",
        format="social",
        client_name="Verdant Loop",
        industry="D2C plant care",
        excerpt=(
            "Six short Instagram captions that answer one plant-care question each and end with a single, gentle "
            "invitation to join the launch waitlist."
        ),
        body_md=(
            "1. Yellow leaves? Usually too much love, not too little. Let the top centimetre of soil dry out first.\n"
            "2. Going away for a long weekend? Group your plants together. They keep each other humid.\n"
            "3. Bright, indirect light means near a window but out of the midday sun.\n"
            "4. Repot in spring, when roots are ready to grow into new space.\n"
            "5. Dust on leaves blocks light. A damp cloth once a month helps more than any fertiliser.\n"
            "6. Two weeks without watering is possible. Join the waitlist to see how."
        ),
        published_on=date(2025, 1, 20),
        tags=("Social", "Instagram", "Launch"),
    ),
    SeedWritingSample(
        slug="harbour-clinic-referral-landing-page",
        title="Landing page: preparing for your first physiotherapy visit",
        format="landing_page",
        client_name="Harbour Wellness Clinic",
        industry="Healthcare",
        excerpt=(
            "A landing page for patients referred to physiotherapy, written in plain language: what to bring, what "
            "happens and how to book. Sample copy checked for a low reading age."
        ),
        body_md=(
            "# Your first physiotherapy visit\n\n"
            "Your doctor has referred you to us. Here is what to expect, so you can arrive relaxed.\n\n"
            "## What to bring\n\n"
            "- Your referral letter\n"
            "- A list of any medicines you take\n"
            "- Comfortable clothes you can move in\n\n"
            "## What happens\n\n"
            "Your physiotherapist will ask about your pain and how it affects your day. They will look at how you "
            "move and agree a simple plan with you. The first visit takes about 45 minutes.\n\n"
            "## Book your visit\n\n"
            "Call reception or use the booking form. If you need to change the time, let us know a day before."
        ),
        published_on=date(2024, 5, 15),
        tags=("Landing page", "Healthcare", "Plain language"),
        is_featured=True,
    ),
    SeedWritingSample(
        slug="kesar-and-clay-gift-guide",
        title="Landing page: festive gifts by the person you are buying for",
        format="landing_page",
        client_name="Kesar and Clay",
        industry="Artisan homeware",
        excerpt=(
            "A gift-guide landing page that sorts handmade homeware by recipient instead of product type, with "
            "short notes on each maker and clear shipping dates."
        ),
        body_md=(
            "# Gifts that someone made by hand\n\n"
            "Choose the person, and we will show you something they will keep for years.\n\n"
            "## For the friend who hosts every dinner\n\n"
            "A set of serving bowls, glazed in deep saffron and fired twice for strength.\n\n"
            "## For the colleague with a desk full of plants\n\n"
            "A small planter with a drainage dish, made in a studio of three potters.\n\n"
            "## For yourself\n\n"
            "A single mug that fits your hand. You have earned it.\n\n"
            "**Order by the 18th** for delivery before the festival."
        ),
        published_on=date(2023, 10, 2),
        tags=("Landing page", "Retail", "Gift guide"),
    ),
    SeedWritingSample(
        slug="harbour-clinic-monthly-newsletter",
        title="Newsletter: the question patients asked most this month",
        format="newsletter",
        client_name="Harbour Wellness Clinic",
        industry="Healthcare",
        excerpt=(
            "A monthly patient newsletter built around one real question from the reception desk, one practical "
            "checklist and one short clinic update."
        ),
        body_md=(
            "# This month's question: should I rest or keep moving?\n\n"
            "For most everyday aches, gentle movement helps more than complete rest. Short walks keep joints supple "
            "and help you notice what makes the pain better or worse.\n\n"
            "## A simple checklist\n\n"
            "- Move a little every hour\n"
            "- Stop if the pain becomes sharp\n"
            "- Write down what you did and how you felt\n\n"
            "## From the clinic\n\n"
            "Our new evening appointments start next month on Tuesdays and Thursdays.\n\n"
            "*This newsletter shares general information. Please speak to your clinician about your own care.*"
        ),
        published_on=date(2024, 8, 1),
        tags=("Newsletter", "Healthcare", "Patient education"),
    ),
    SeedWritingSample(
        slug="writers-notebook-newsletter",
        title="Newsletter: notes from a writer's desk, issue 12",
        format="newsletter",
        client_name=None,
        industry=None,
        excerpt=(
            "A personal newsletter issue for marketing teams: one writing habit, one useful question to ask a "
            "client and one recommended exercise, all in a five-minute read."
        ),
        body_md=(
            "# Notes from the desk\n\n"
            "Hello again. This month I have been thinking about first drafts and why we judge them too early.\n\n"
            "## One habit\n\n"
            "Write the draft in one sitting and edit it the next day. Distance turns a critic into an editor.\n\n"
            "## One question to ask a client\n\n"
            "*What should a reader do in the minute after they finish?* The answer shapes the whole piece.\n\n"
            "## One exercise\n\n"
            "Take a paragraph you wrote last week and cut it by a third without losing the meaning. Notice which "
            "words you did not miss.\n\n"
            "Until next month, happy writing."
        ),
        published_on=date(2026, 2, 3),
        tags=("Newsletter", "Writing craft"),
    ),
)

# ---------------------------------------------------------------------------------------------- simple content

SERVICES: Final[tuple[SeedSimple, ...]] = (
    SeedSimple(
        "service:content-strategy",
        {
            "name": "Content strategy",
            "description": "A clear plan for what to publish, for whom and why, so every piece has a job to do.",
            "deliverables": ["Content audit", "Audience question map", "Editorial calendar", "Measurement plan"],
        },
    ),
    SeedSimple(
        "service:copywriting",
        {
            "name": "Copywriting",
            "description": "Website pages, product copy and emails written to be understood quickly and acted on.",
            "deliverables": ["Website pages", "Product descriptions", "Email sequences", "Two rounds of edits"],
        },
    ),
    SeedSimple(
        "service:seo-content",
        {
            "name": "SEO content",
            "description": "Helpful articles built around real search questions, structured so readers and search "
            "engines find the answer.",
            "deliverables": ["Keyword map", "Article briefs", "Long-form guides", "Internal linking plan"],
        },
    ),
    SeedSimple(
        "service:brand-messaging",
        {
            "name": "Brand messaging",
            "description": "One recognisable way of speaking across every channel, written down so the whole team "
            "can use it.",
            "deliverables": ["Messaging framework", "Tone of voice guide", "Proof points", "Example rewrites"],
        },
    ),
    SeedSimple(
        "service:campaign-planning",
        {
            "name": "Campaign planning",
            "description": "Launches and seasonal campaigns planned from the first teaser to the final reminder.",
            "deliverables": ["Campaign brief", "Channel plan", "Message sequence", "Results summary"],
        },
    ),
)

ENGAGEMENT_MODELS: Final[tuple[SeedSimple, ...]] = (
    SeedSimple(
        "engagement:project",
        {
            "name": "Project",
            "description": "One campaign, launch or content programme with a clear start, finish and brief.",
            "features": [
                "Discovery call and written brief",
                "Fixed scope and timeline",
                "Two rounds of revisions",
                "Hand-over notes for your team",
                "Results summary at the end",
            ],
            "cta_label": "Book a call",
            "cta_target": "booking",
        },
    ),
    SeedSimple(
        "engagement:retainer",
        {
            "name": "Monthly retainer",
            "description": "A steady rhythm of content each month, planned together and delivered on time.",
            "features": [
                "Agreed number of pieces per month",
                "Monthly planning session",
                "Priority turnaround",
                "Quarterly performance review",
                "Flexible topics within the plan",
                "Cancel with one month's notice",
            ],
            "cta_label": "Book a call",
            "cta_target": "booking",
        },
    ),
    SeedSimple(
        "engagement:one-off",
        {
            "name": "One-off piece",
            "description": "A single article, landing page or email sequence when you need one thing done well.",
            "features": [
                "Short brief by email",
                "One focused deliverable",
                "One round of revisions",
                "Ready-to-publish formatting",
                "Delivery within two weeks",
            ],
            "cta_label": "Send a brief",
            "cta_target": "contact",
        },
    ),
)

TESTIMONIALS: Final[tuple[SeedTestimonial, ...]] = (
    SeedTestimonial(
        "testimonial:verdant-loop",
        "We knew our product inside out but could not explain it simply. The launch emails finally sounded like us "
        "on a good day, and the waitlist grew faster than we had planned for.",
        "Priya Example",
        "Co-founder",
        "Verdant Loop",
        "verdant-loop",
    ),
    SeedTestimonial(
        "testimonial:northpeak-ledger",
        "Every guide answered a question our sales team heard weekly. Six months later the blog is our best source "
        "of trial sign-ups, and the deadlines were never missed.",
        "Daniel Sample",
        "Head of marketing",
        "Northpeak Ledger",
        "northpeak-ledger",
    ),
    SeedTestimonial(
        "testimonial:kesar-and-clay",
        "Our makers finally appeared in our own emails. Customers replied to tell us which story they loved, which "
        "had never happened during a sale before.",
        "Meera Placeholder",
        "Owner",
        "Kesar and Clay",
        "kesar-and-clay",
    ),
    SeedTestimonial(
        "testimonial:brightpath-tutors",
        "The new homepage speaks to worried parents the way our tutors do on a call. Demo bookings doubled and the "
        "copy took less than six weeks.",
        "Tom Fictional",
        "Growth lead",
        "Brightpath Tutors",
        "brightpath-tutors",
    ),
    SeedTestimonial(
        "testimonial:trailmix-travel",
        "Three of us used to write in three different voices. Now we have one, written down, and new guides pick it "
        "up in a single afternoon.",
        "Lena Imaginary",
        "Operations manager",
        "Trailmix Travel Co.",
        None,
    ),
)

FAQ_CATEGORIES: Final[tuple[SeedFaqCategory, ...]] = (
    SeedFaqCategory(
        "working-together",
        "Working together",
        (
            (
                "Which industries do you write for?",
                "Mostly consumer brands, B2B software, education and healthcare. What matters more than the "
                "industry is a clear audience and a team willing to share what its customers really ask.",
                True,
            ),
            (
                "Do you work remotely?",
                "Yes. Briefs, interviews and reviews happen over video calls and shared documents, so location is "
                "never a barrier. In-person workshops can be arranged for larger projects.",
                False,
            ),
            (
                "Which time zones can you work with?",
                "Most of my clients are within a few hours of my own time zone, but a weekly overlap of two hours "
                "is usually enough for any team.",
                False,
            ),
            (
                "Can you work with our existing writers?",
                "Gladly. Many projects include a tone guide and short editing sessions so your team can keep the "
                "voice consistent after the project ends.",
                True,
            ),
        ),
    ),
    SeedFaqCategory(
        "process-and-timelines",
        "Process and timelines",
        (
            (
                "What does a brief need to include?",
                "Who the piece is for, what the reader should do afterwards, any facts that must appear and a "
                "deadline. A short call can fill in the rest.",
                True,
            ),
            (
                "How many revisions are included?",
                "Two rounds of revisions are included in every project. Most pieces need only one when the brief "
                "is clear.",
                False,
            ),
            (
                "How long does a typical article take?",
                "About two weeks from brief to final draft for a long-form guide, including research and one "
                "interview if needed.",
                False,
            ),
            (
                "Can you work to an urgent deadline?",
                "Sometimes. Urgent work depends on the current schedule and is quoted separately, so ask early and "
                "I will tell you honestly what is possible.",
                False,
            ),
        ),
    ),
    SeedFaqCategory(
        "pricing",
        "Pricing",
        (
            (
                "How do you price projects?",
                "Projects are priced per deliverable after a short discovery call. Retainers are a fixed monthly "
                "fee for an agreed number of pieces.",
                True,
            ),
            (
                "Do you charge per word?",
                "No. Pricing per word rewards length, not clarity. Each quote is based on the research, interviews "
                "and editing the piece needs.",
                False,
            ),
            (
                "Is there a minimum budget?",
                "Small one-off pieces are welcome. The contact form has a budget field so I can suggest the right "
                "kind of engagement.",
                False,
            ),
            (
                "When do you invoice?",
                "Half at the start of a project and half on delivery. Retainers are invoiced at the start of each "
                "month.",
                False,
            ),
        ),
    ),
    SeedFaqCategory(
        "results-and-ownership",
        "Results and ownership",
        (
            (
                "How do you report on results?",
                "Each project ends with a short summary of what was published and how it performed against the "
                "goals we agreed at the start.",
                True,
            ),
            (
                "Who owns the copy?",
                "You do. Once the final invoice is paid, all rights to the delivered copy transfer to you.",
                True,
            ),
            (
                "Can you guarantee search rankings?",
                "No honest writer can. What I can promise is content built around real questions, structured well "
                "and measured over time.",
                False,
            ),
            (
                "Will you share the examples in your portfolio?",
                "Only with permission. Portfolio pieces marked as samples are written for demonstration and do not "
                "describe real clients.",
                False,
            ),
        ),
    ),
)

VALUES: Final[tuple[SeedSimple, ...]] = (
    SeedSimple(
        "value:clarity",
        {
            "title": "Clarity over cleverness",
            "body": "A sentence that is understood beats one that is admired. Clever lines earn their place only "
            "when they make the meaning clearer.",
        },
    ),
    SeedSimple(
        "value:research",
        {
            "title": "Research first",
            "body": "Good writing starts with listening: to customers, to sales calls and to the questions people "
            "type into search boxes late at night.",
        },
    ),
    SeedSimple(
        "value:measured",
        {
            "title": "Writing that can be measured",
            "body": "Every piece has a goal agreed before the first draft. Afterwards we look at what happened and "
            "keep what worked.",
        },
    ),
    SeedSimple(
        "value:respect",
        {
            "title": "Respect for the reader's time",
            "body": "Readers are busy. Short paragraphs, honest headings and a clear next step are a form of courtesy.",
        },
    ),
)

PROCESS_STEPS: Final[tuple[SeedSimple, ...]] = (
    SeedSimple(
        "step:listen",
        {
            "title": "Listen",
            "body": "A discovery call, a written brief and audience research, so we agree who we are writing for "
            "and why.",
        },
    ),
    SeedSimple(
        "step:plan",
        {
            "title": "Plan",
            "body": "A strategy and calendar that fits your team's rhythm, with one clear job for every piece.",
        },
    ),
    SeedSimple(
        "step:write",
        {
            "title": "Write",
            "body": "Drafts shared early, two rounds of revisions and copy that is ready to publish.",
        },
    ),
    SeedSimple(
        "step:measure",
        {
            "title": "Measure",
            "body": "A short report on what was published and how it performed, plus ideas for the next round.",
        },
    ),
)

PROFILE: Final = SeedProfile(
    name="Mitali",
    headline="Content writer and marketing strategist for brands that want to be understood",
    bio=(
        "[Placeholder bio, replace in the admin] I help brands say what they mean, clearly and in their own voice.",
        "For the past few years I have planned content programmes, written launch campaigns and rewritten "
        "websites for consumer brands, software companies and clinics.",
        "When I am not writing for clients, I am reading other people's newsletters and collecting good first "
        "sentences.",
    ),
    skills=(
        "Content strategy",
        "Long-form writing",
        "SEO",
        "Brand voice",
        "Email marketing",
        "Campaign planning",
        "Editing",
    ),
    tools=(
        "Google Analytics",
        "Google Search Console",
        "Semrush",
        "Ahrefs",
        "Notion",
        "Canva",
        "Mailchimp",
        "HubSpot",
        "WordPress",
    ),
    years_experience=8,
    origin_statement=(
        "I started out writing product descriptions for a small online shop and discovered that the best-selling "
        "pages were the ones that answered a customer's real question. I have been chasing that question ever since."
    ),
    vision_blocks=(
        ("Vision", "A web where brand writing is as clear and useful as a good conversation with a friend."),
        ("Mission", "Help teams find their voice, plan content they can keep up with and measure what it achieves."),
    ),
    portrait_alt="Placeholder portrait: a neutral head-and-shoulders silhouette",
)

SETTINGS: Final = SeedSettings(
    contact_email="hello@example.com",
    booking_url="#",
    social_links=(("LinkedIn", "https://example.com/linkedin"), ("Instagram", "https://example.com/instagram")),
    footer_signoff="Words that work, written with care.",
    contact_promise=CONTACT_PROMISE_DEFAULT,
    footer_rights_line=FOOTER_RIGHTS_LINE_DEFAULT,
)

# Development only (TS-017 step 1): fictional senders with example.com addresses.
ENQUIRIES: Final[tuple[SeedEnquiry, ...]] = (
    SeedEnquiry(
        "enquiry:1",
        "Sam Example",
        "sam@example.com",
        "Example Bakery",
        "copywriting",
        "1000_3000",
        "Hello, we are opening a second shop and need our website pages rewritten before the opening in spring.",
        "new",
    ),
    SeedEnquiry(
        "enquiry:2",
        "Ana Sample",
        "ana@example.com",
        None,
        "content_strategy",
        "3000_7500",
        "Our blog has plenty of posts but little traffic. Could you help us plan the next six months?",
        "new",
    ),
    SeedEnquiry(
        "enquiry:3",
        "Ravi Placeholder",
        "ravi@example.com",
        "Example Studio",
        "brand_messaging",
        "not_sure",
        "We are a small design studio and every team member describes us differently. Looking for help with a "
        "messaging framework.",
        "replied",
    ),
    SeedEnquiry(
        "enquiry:4",
        "Jo Fictional",
        "jo@example.com",
        "Example Outdoors",
        "campaign_planning",
        "over_15000",
        "Planning a product launch for next autumn and would like to discuss a campaign plan across email and social.",
        "archived",
    ),
)

EXPECTED_COUNTS: Final[dict[str, int]] = {
    "case_studies": len(CASE_STUDIES),
    "case_study_results": sum(len(cs.results) for cs in CASE_STUDIES),
    "case_study_images": sum(len(cs.gallery) for cs in CASE_STUDIES),
    "writing_samples": len(WRITING_SAMPLES),
    "services": len(SERVICES),
    "engagement_models": len(ENGAGEMENT_MODELS),
    "testimonials": len(TESTIMONIALS),
    "faq_categories": len(FAQ_CATEGORIES),
    "faqs": sum(len(category.faqs) for category in FAQ_CATEGORIES),
    "core_values": len(VALUES),
    "process_steps": len(PROCESS_STEPS),
}
