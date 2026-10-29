/**
 * Static public copy (ui-scope 3.4, tech-spec open question 4). All wording is original (DES-003, SEC-007):
 * nothing here comes from the reference site. Tone: confident, punchy headings; plain, warm sentences.
 */

export const SITE_NAME = "Mitali";
/** DES-001 site title, used as the Home page title. */
export const SITE_TITLE = "Mitali — Content Writer & Marketing Strategist";

/** `<Page> — Mitali` pattern (UI-004). */
export function pageTitle(page: string): string {
  return `${page} — ${SITE_NAME}`;
}

export interface PageCopy {
  title: string;
  description: string;
}

export const pages = {
  home: {
    title: SITE_TITLE,
    description:
      "Mitali plans and writes content that gives brands a clear voice and gives readers a reason to act: strategy, copywriting, SEO content and campaigns.",
  },
  work: {
    title: pageTitle("Work"),
    description: "Selected content and marketing campaigns by Mitali: the brief, the thinking behind it and what changed.",
  },
  writing: {
    title: pageTitle("Writing"),
    description:
      "Writing samples by Mitali across blog posts, web copy, email, social, landing pages and newsletters.",
  },
  about: {
    title: pageTitle("About"),
    description:
      "How Mitali works: the story so far, the values behind every brief and a four-step process for content that earns attention.",
  },
  contact: {
    title: pageTitle("Contact"),
    description:
      "Tell Mitali about your project, from content strategy and copywriting to SEO content, brand messaging and campaign planning.",
  },
  faqs: {
    title: pageTitle("FAQs"),
    description:
      "Straight answers about working with Mitali: process, timelines, ways to work together and what you receive.",
  },
  notFound: {
    title: pageTitle("Page not found"),
    description: "This page does not exist or has moved.",
  },
  error: {
    title: pageTitle("Something went wrong"),
    description: "The page could not be loaded.",
  },
} satisfies Record<string, PageCopy>;

export const actions = {
  bookCall: "Book a call",
  contact: "Send a message",
  viewWork: "View work",
  viewAllWork: "View all work",
  seeAllFaqs: "See all FAQs",
  backHome: "Back to home",
  tryAgain: "Try again",
  readCaseStudy: "Read the case study",
} as const;

export const a11y = {
  skipToContent: "Skip to content",
  opensInNewTab: "(opens in a new tab)",
  wordmarkHome: "Mitali, home",
  previousTestimonial: "Previous testimonial",
  nextTestimonial: "Next testimonial",
  testimonialsLabel: "Client testimonials",
  showTestimonial: (n: number, total: number) => `Show testimonial ${n} of ${total}`,
  slideLabel: (n: number, total: number) => `${n} of ${total}`,
} as const;

export const ctaBand = {
  lines: ["Got something to say?", "Let's make it land."],
} as const;

export const faqPreview = {
  heading: "Good questions",
} as const;

export const story = {
  heading: "The person behind the words",
} as const;

export const sampleNotes = {
  data: "Sample data",
  caseStudy: "Sample case study",
  sample: "Sample",
} as const;

export const errorPage = {
  heading: "Something went wrong",
  body: "This page could not be loaded just now. Please try again in a moment.",
} as const;

export const notFoundPage = {
  heading: "This page took a day off",
  body: "The page you are looking for does not exist, or it has moved somewhere new.",
} as const;

/* ---------------------------------------------------------------- Layout (UI-019, UI-020, UI-021) */

export const nav = {
  mainLabel: "Main",
  menu: "Menu",
  closeMenu: "Close menu",
  menuLabel: "Menu",
  home: "Home",
  work: "Work",
  writing: "Writing",
  about: "About",
  contact: "Contact",
  faqs: "FAQs",
} as const;

export const footer = {
  subLabel: "Content & strategy",
  quickLinksLabel: "Explore",
  socialLabel: "Follow along",
  emailLabel: "Say hello",
  navLabel: "Footer",
  builtLabel: "Edition",
  copyright: (year: string) => `© ${year} Mitali`,
  rights: "All rights reserved. Words, as always, are my own.",
} as const;

/* ---------------------------------------------------------------- Home (UI-022..UI-026) */

export const homeHero = {
  lines: ["Words with", "a job to do"],
  intro:
    "I'm Mitali, a content writer and marketing strategist. I plan and write content that helps brands sound like themselves and gives every reader a clear next step.",
  tagline: "Strategy first. Sentences that earn their place.",
} as const;

export const homeSections = {
  featuredWork: "Selected work",
  services: "What I do",
  servicesIntro: "Pick one or combine a few. Every service starts with the reader you need to reach.",
  deliverablesLabel: "What you get",
  engagement: "Ways to work together",
  engagementIntro: "No price lists here: we agree the scope first, then I quote for the work it really needs.",
  testimonials: "What clients say",
} as const;

/* ---------------------------------------------------------------- Work and case study (UI-027, UI-028) */

export const workPage = {
  heading: "Work",
  intro: "Campaigns, content programmes and launches: what the brief asked for, how I approached it and what moved.",
  emptyHeading: "New case studies are on the way",
  emptyBody: "I'm writing up recent projects now. In the meantime, ask me about the work that fits your brief.",
  emptyAction: "Get in touch",
} as const;

export const caseStudyPage = {
  detailsLabel: "Project details",
  client: "Client",
  year: "Year",
  industry: "Industry",
  timeline: "Timeline",
  campaignType: "Campaign type",
  channels: "Channels",
  problem: "The problem",
  solution: "The solution",
  results: "Results",
  before: "Before",
  change: "Change",
  period: "Period",
  gallery: "Gallery",
  moreWork: "More work",
} as const;

/* ---------------------------------------------------------------- Writing (UI-029, UI-030) */

export const writingPage = {
  heading: "Writing",
  intro: "A shelf of samples across formats. Filter by the kind of writing you need and read the full pieces.",
  filterLabel: "Filter by format",
  all: "All",
  emptyList: "Writing samples coming soon",
  emptyListBody: "New pieces are being edited. Check back shortly, or ask for samples in your format.",
  emptyFilter: "No samples in this format yet",
  showAll: "Show all",
  showing: (count: number, format: string | null) =>
    format === null
      ? `Showing all ${count} ${count === 1 ? "sample" : "samples"}`
      : `Showing ${count} ${format.toLowerCase()} ${count === 1 ? "sample" : "samples"}`,
} as const;

export const writingSamplePage = {
  metaLabel: "About this piece",
  client: "Client",
  published: "Published",
  readingTimeLabel: "Reading time",
  readingTime: (minutes: number) => `${minutes} min read`,
  tagsLabel: "Tags",
  backToWriting: "Back to writing",
  closing: "Need writing like this?",
} as const;

/* ---------------------------------------------------------------- About (UI-031) */

export const aboutPage = {
  heroLines: ["Clear words,", "measured results"],
  intro:
    "Strategy and writing under one roof. I work with small teams and busy founders who want content that is planned with intent and written to be read.",
  originLabel: "Where it starts",
  visionHeading: "What I believe",
  valuesLabel: "What I value",
  processHeading: "How we'll work",
} as const;

/* ---------------------------------------------------------------- FAQs (UI-032) */

export const faqsPage = {
  heading: "FAQs",
  intro: "Straight answers about process, timelines and what you receive. Anything missing? Just ask.",
  empty: "No questions published yet",
  emptyBody: "Questions and answers are being written. Send me yours in the meantime.",
} as const;

/* ---------------------------------------------------------------- Contact (UI-033) */

export const contactPage = {
  headingLines: ["Let's talk", "words"],
  promise: "Tell me what you're working on. I reply to every enquiry within two working days.",
  emailLabel: "Prefer email?",
} as const;

export const enquiryForm = {
  name: "Name",
  email: "Email",
  enquiryType: "Enquiry type",
  budgetRange: "Budget range",
  budgetNone: "Prefer not to say",
  company: "Company",
  message: "Message",
  optional: "(optional)",
  required: "(required)",
  honeypot: "Leave this field empty",
  formLabel: "Enquiry form",
  noscriptLine: "This form needs JavaScript. You can email me instead at",
  submit: "Send enquiry",
  submitting: "Sending…",
  counter: (used: number, max: number) => `${used} of ${max} characters`,
  privacy:
    "I use your details only to reply to this enquiry. They are never shared, sold or added to a mailing list.",
  errors: {
    nameRequired: "Enter your name.",
    nameTooLong: "Keep your name to 120 characters or fewer.",
    emailRequired: "Enter your email address.",
    emailInvalid: "Enter an email address like name@example.com.",
    emailTooLong: "Keep your email address to 254 characters or fewer.",
    enquiryType: "Choose what your enquiry is about.",
    budgetRange: "Choose a budget range from the list.",
    companyTooLong: "Keep the company name to 120 characters or fewer.",
    messageRequired: "Write a short message about your project.",
    messageTooLong: "Keep your message to 5,000 characters or fewer.",
    serverField: "Check this field.",
  },
  successHeading: "Message received",
  successBody: "Thank you for getting in touch. I'll read your note and reply within two working days.",
  rateLimited: "You've sent several messages in a short time. Please try again later.",
  serverError: "Your message didn't send. Please try again in a moment.",
  serverErrorEmail: "If it keeps failing, email me at",
  invalidSummary: "Some details need another look. Check the highlighted fields.",
} as const;
