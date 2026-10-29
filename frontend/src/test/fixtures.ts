/**
 * Contract-shaped fixtures (types from the generated schema) mirroring the seed shapes in ui-scope section 6:
 * 6 published case studies (+1 unpublished, never returned by list endpoints), 12 writing samples, 5 services,
 * 3 engagement models, 5 testimonials, 16 FAQs in 4 categories with 6 in preview, 4 values, 4 steps.
 * All content is invented dummy text with example.com addresses.
 */
import type {
  CaseStudyDetailRaw,
  CaseStudySummary,
  CoreValue,
  EngagementModel,
  Faq,
  FaqGroup,
  ImageRef,
  ProcessStep,
  Service,
  SiteBundle,
  Testimonial,
  WritingFormat,
  WritingSampleDetailRaw,
  WritingSampleSummary,
} from "@/api/types";

export const GENERATED_AT = "2026-10-29T10:00:00+00:00";

const uuid = (prefix: number, n: number) =>
  `${String(prefix).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function imageRef(name: string, alt: string, width = 1600, height = 900): ImageRef {
  return {
    url: `/media/seed/${name}-1600.webp`,
    alt,
    width,
    height,
    mime: "image/webp",
    srcset: [480, 960, 1600].map((w) => ({ width: w, url: `/media/seed/${name}-${w}.webp` })),
  };
}

export function svgRef(name: string, alt: string): ImageRef {
  return { url: `/media/seed/${name}.svg`, alt, width: 1200, height: 675, mime: "image/svg+xml", srcset: [] };
}

export const site: SiteBundle = {
  generated_at: GENERATED_AT,
  settings: {
    contact_email: "hello@example.com",
    booking_url: "https://booking.example.com/mitali",
    social_links: [
      { label: "LinkedIn", url: "https://www.linkedin.example.com/in/mitali" },
      { label: "Instagram", url: "https://instagram.example.com/mitali" },
    ],
    footer_signoff: "Written with care, edited without mercy.",
  },
  profile: {
    name: "Mitali",
    headline: "Content writer and marketing strategist",
    bio: [
      "I started writing product pages for a tiny tea shop and never stopped asking why some words sell and others sit still.",
      "Today I help brands find a clear voice, plan content that compounds and write copy that earns the click.",
      "When I am not writing, I am reading terrible first drafts on purpose. They teach the most.",
    ],
    skills: ["Content strategy", "Copywriting", "SEO content"],
    tools: ["Docs", "Analytics"],
    years_experience: 7,
    origin_statement: "Good writing is a service to the reader first and the brand second.",
    vision_blocks: [
      { heading: "Clarity first", body: "Every piece starts with one sentence about who it is for." },
      { heading: "Measured work", body: "Content earns its place with numbers, not adjectives." },
    ],
    portrait: imageRef("portrait", "Portrait of Mitali", 1200, 1500),
  },
};

const campaignTypes = ["Brand launch", "SEO programme", "Email nurture", "Social campaign", "Website copy", "Newsletter"];

export const caseStudies: CaseStudySummary[] = campaignTypes.map((type, i) => ({
  slug: `case-study-${i + 1}`,
  title: `Case study ${i + 1}`,
  client_name: `Client ${i + 1} Ltd`,
  campaign_type: type,
  summary: `A ${type.toLowerCase()} for an invented client: the brief, the plan and the measured outcome.`,
  cover: imageRef(`cover-${i + 1}`, `Cover artwork for case study ${i + 1}`),
  is_featured: i < 5,
  is_sample: true,
  updated_at: `2026-10-${String(10 + i).padStart(2, "0")}T09:00:00+00:00`,
}));

export const unpublishedCaseStudySlug = "draft-case-study";

export function caseStudyDetail(slug: string): CaseStudyDetailRaw | undefined {
  const index = caseStudies.findIndex((cs) => cs.slug === slug);
  const summary = caseStudies[index];
  if (!summary) return undefined;
  return {
    ...summary,
    client_industry: "Retail",
    year: 2025,
    timeline: "8 weeks",
    channels: ["Blog", "Email"],
    goals: ["Grow organic traffic"],
    problem_html: "<p>The brand voice was <strong>inconsistent</strong>.</p>",
    solution_html: "<p>A tone guide and a three-month content plan.</p>",
    results: [
      {
        id: uuid(11, index * 10 + 1),
        metric_label: "Organic sessions",
        value: "+48%",
        before_value: "12,000",
        change_text: "+5,760",
        period: "3 months",
        is_sample: true,
      },
    ],
    images: [{ id: uuid(12, index), layout: "full", image: imageRef(`gallery-${index}`, "Gallery image"), caption: null }],
    more_work: caseStudies.filter((cs) => cs.slug !== slug).slice(0, 2),
  };
}

const formats: WritingFormat[] = ["blog", "web_copy", "email", "social", "landing_page", "newsletter"];

export const writingSamples: WritingSampleSummary[] = Array.from({ length: 12 }, (_, i) => ({
  slug: `writing-sample-${i + 1}`,
  title: `Writing sample ${i + 1}`,
  format: formats[i % formats.length] ?? "blog",
  excerpt: `An invented excerpt for writing sample ${i + 1}, written as dummy content.`,
  thumbnail: i % 4 === 3 ? null : imageRef(`thumb-${i + 1}`, `Thumbnail for writing sample ${i + 1}`),
  client_name: i % 2 === 0 ? `Client ${i + 1}` : null,
  published_on: "2026-03-01",
  reading_time_min: 3 + (i % 4),
  is_featured: i < 3,
  is_sample: i % 3 === 0,
  updated_at: `2026-09-${String(1 + i).padStart(2, "0")}T08:00:00+00:00`,
}));

export function writingSampleDetail(slug: string): WritingSampleDetailRaw | undefined {
  const summary = writingSamples.find((s) => s.slug === slug);
  if (!summary) return undefined;
  return {
    ...summary,
    industry: "Hospitality",
    tags: ["tone", "conversion"],
    body_html: "<h2>Opening</h2><p>Body text with a <a href=\"https://example.com\">link</a>.</p>",
    word_count: 820,
  };
}

export const services: Service[] = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(2, i + 1),
  name: `Service ${i + 1}`,
  description: `What service ${i + 1} covers, in plain words.`,
  deliverables: ["Plan", "Drafts", "Edits"],
}));

export const engagementModels: EngagementModel[] = [
  { id: uuid(3, 1), name: "Single project", description: "One brief.", features: ["Kick-off call"], cta_label: "Book a call", cta_target: "booking" },
  { id: uuid(3, 2), name: "Monthly retainer", description: "Steady output.", features: ["4 pieces"], cta_label: "Ask about retainers", cta_target: "contact" },
  { id: uuid(3, 3), name: "Workshop", description: "Train your team.", features: ["Half day"], cta_label: "Plan a workshop", cta_target: "booking" },
];

export const testimonials: Testimonial[] = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(4, i + 1),
  quote: `Invented testimonial quote number ${i + 1}.`,
  author_name: `Person ${i + 1}`,
  author_role: "Marketing lead",
  company: `Company ${i + 1}`,
  case_study_slug: i === 0 ? "case-study-1" : null,
}));

const groupSizes = [6, 5, 3, 2];
let faqCounter = 0;
export const faqGroups: FaqGroup[] = groupSizes.map((size, g) => ({
  id: uuid(5, g + 1),
  name: `Category ${g + 1}`,
  faqs: Array.from({ length: size }, (): Faq => {
    faqCounter += 1;
    return {
      id: uuid(6, faqCounter),
      question: `Question ${faqCounter}?`,
      answer: `First paragraph of answer ${faqCounter}.\n\nSecond paragraph of answer ${faqCounter}.`,
    };
  }),
}));

export const faqPreview: Faq[] = faqGroups.flatMap((g) => g.faqs).filter((_, i) => i % 3 === 0).slice(0, 6);

export const values: CoreValue[] = Array.from({ length: 4 }, (_, i) => ({
  id: uuid(7, i + 1),
  title: `Value ${i + 1}`,
  body: `Why value ${i + 1} matters.`,
}));

export const processSteps: ProcessStep[] = Array.from({ length: 4 }, (_, i) => ({
  id: uuid(8, i + 1),
  title: `Step ${i + 1}`,
  body: `What happens in step ${i + 1}.`,
}));
