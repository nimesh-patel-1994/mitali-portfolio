/**
 * Contract-shaped admin fixtures (types from the generated schema), mirroring the seed shapes: 6 case studies
 * (3 results each, gallery images), 12 writing samples, 5 services, 3 engagement models, 5 testimonials, 4 FAQ
 * categories with 16 FAQs (6 in preview), 4 values, 4 process steps, profile, settings, enquiries and media.
 * All content is invented dummy text with example.com addresses.
 */
import type {
  AdminCaseStudy,
  AdminCaseStudyImage,
  AdminCaseStudyListItem,
  AdminCaseStudyResult,
  AdminCoreValue,
  AdminEngagementModel,
  AdminFaq,
  AdminFaqCategory,
  AdminProcessStep,
  AdminProfile,
  AdminService,
  AdminSession,
  AdminSettings,
  AdminTestimonial,
  AdminWritingSample,
  AdminWritingSampleListItem,
  Dashboard,
  Enquiry,
  EnquirySummary,
  ImageRef,
  MediaAsset,
  WritingFormat,
} from "@/features/admin/api/types";

export const T0 = "2026-10-29T10:00:00+00:00";

export const id = (prefix: number, n: number) => `${String(prefix).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const meta = (prefix: number, n: number) => ({ id: id(prefix, n), position: n - 1, created_at: T0, updated_at: T0 });

export const SESSION: AdminSession = {
  email: "admin@example.com",
  csrf_token: "csrf-token-1",
  idle_expires_at: "2026-10-29T18:00:00+00:00",
  absolute_expires_at: "2026-11-05T10:00:00+00:00",
};

export function imageRef(name: string, alt: string): ImageRef {
  return {
    url: `/media/uploads/2026/10/${name}-1600.webp`,
    alt,
    width: 1600,
    height: 900,
    mime: "image/webp",
    srcset: [480, 960, 1600].map((w) => ({ width: w, url: `/media/uploads/2026/10/${name}-${w}.webp` })),
  };
}

export function mediaAsset(n: number, overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: id(90, n),
    url: `/media/uploads/2026/10/asset-${n}-1600.webp`,
    mime: "image/webp",
    width: 1600,
    height: 900,
    bytes: 120_000,
    variants: [480, 960, 1600].map((w) => ({ width: w, url: `/media/uploads/2026/10/asset-${n}-${w}.webp` })),
    alt: null,
    original_filename: `asset-${n}.png`,
    source: "upload",
    created_at: T0,
    ...overrides,
  };
}

export function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    new_enquiries: 3,
    content_changed_at: "2026-10-29T12:30:00+00:00",
    last_build: { built_at: "2026-10-29T11:00:00+00:00", content_snapshot_at: "2026-10-29T11:00:00+00:00" },
    needs_rebuild: true,
    rebuild_command: "cd frontend; npm run build:site",
    content_counts: {
      case_studies: { total: 6, published: 6 },
      writing_samples: { total: 12, published: 12 },
      services: { total: 5, published: 5 },
      engagement_models: { total: 3, published: 3 },
      testimonials: { total: 5, published: 4 },
      faq_categories: { total: 4, published: 4 },
      faqs: { total: 16, published: 16 },
      values: { total: 4, published: 4 },
      process_steps: { total: 4, published: 4 },
    },
    ...overrides,
  };
}

/* ---------------------------------------------------------------- case studies */
const CLIENTS = ["Harbour Tea Co.", "Verdant Loop", "Northwind Cycles", "Quill & Ink", "Saltmarsh Studio", "Lumen Bakery"];

export function result(csN: number, n: number, overrides: Partial<AdminCaseStudyResult> = {}): AdminCaseStudyResult {
  return {
    ...meta(20 + csN, n),
    metric_label: `Metric ${n}`,
    value: `${n * 10}%`,
    before_value: null,
    change_text: n === 1 ? "+120 %" : null,
    period: null,
    is_sample: true,
    ...overrides,
  };
}

export function galleryImage(csN: number, n: number, overrides: Partial<AdminCaseStudyImage> = {}): AdminCaseStudyImage {
  return {
    ...meta(30 + csN, n),
    media_id: id(90, 100 + n),
    alt: `Gallery image ${n}`,
    caption: null,
    layout: n === 1 ? "full" : "half",
    image: imageRef(`gallery-${csN}-${n}`, `Gallery image ${n}`),
    ...overrides,
  };
}

export function adminCaseStudy(n: number, overrides: Partial<AdminCaseStudy> = {}): AdminCaseStudy {
  const title = `Case study ${n}: ${CLIENTS[(n - 1) % CLIENTS.length]}`;
  return {
    ...meta(10, n),
    slug: `case-study-${n}`,
    title,
    client_name: CLIENTS[(n - 1) % CLIENTS.length]!,
    client_industry: "Food and drink",
    campaign_type: "Content strategy",
    channels: ["Blog", "Email"],
    goals: ["Grow sign-ups"],
    summary: "A short invented summary of the project.",
    problem_md: "The **problem** in brief.",
    solution_md: "The solution in brief.",
    problem_html: "<p>The <strong>problem</strong> in brief.</p>",
    solution_html: "<p>The solution in brief.</p>",
    year: 2026,
    timeline: "3 months",
    cover_media_id: id(90, 1),
    cover_alt: "Cover illustration",
    cover: imageRef(`cover-${n}`, "Cover illustration"),
    is_featured: n <= 4,
    is_published: true,
    is_sample: true,
    results: [1, 2, 3].map((r) => result(n, r)),
    images: [1, 2, 3].map((i) => galleryImage(n, i)),
    ...overrides,
  };
}

export function caseStudyListItem(cs: AdminCaseStudy): AdminCaseStudyListItem {
  return {
    id: cs.id,
    slug: cs.slug,
    title: cs.title,
    campaign_type: cs.campaign_type,
    cover: cs.cover,
    is_featured: cs.is_featured,
    is_published: cs.is_published,
    is_sample: cs.is_sample,
    position: cs.position,
    updated_at: cs.updated_at,
  };
}

/* ---------------------------------------------------------------- writing */
const FORMATS: WritingFormat[] = ["blog", "web_copy", "email", "social", "landing_page", "newsletter"];

export function adminWritingSample(n: number, overrides: Partial<AdminWritingSample> = {}): AdminWritingSample {
  return {
    ...meta(40, n),
    slug: `writing-sample-${n}`,
    title: `Writing sample ${n}`,
    format: FORMATS[(n - 1) % FORMATS.length]!,
    client_name: null,
    industry: null,
    excerpt: "An invented excerpt.",
    body_md: "# Heading\n\nBody text.",
    body_html: "<h2>Heading</h2><p>Body text.</p>",
    published_on: "2026-01-15",
    tags: ["tone"],
    thumbnail_media_id: null,
    thumbnail_alt: null,
    thumbnail: null,
    is_featured: false,
    is_published: true,
    is_sample: n % 2 === 0,
    word_count: 640,
    reading_time_min: 4,
    ...overrides,
  };
}

export function writingListItem(ws: AdminWritingSample): AdminWritingSampleListItem {
  return {
    id: ws.id,
    slug: ws.slug,
    title: ws.title,
    format: ws.format,
    is_published: ws.is_published,
    is_sample: ws.is_sample,
    position: ws.position,
    updated_at: ws.updated_at,
  };
}

/* ---------------------------------------------------------------- small types */
export const services = (): AdminService[] =>
  [1, 2, 3, 4, 5].map((n) => ({ ...meta(50, n), name: `Service ${n}`, description: `Service ${n} description.`, deliverables: ["Plan"], is_published: true }));

export const engagementModels = (): AdminEngagementModel[] =>
  [1, 2, 3].map((n) => ({
    ...meta(51, n),
    name: `Model ${n}`,
    description: `Model ${n} description.`,
    features: ["Feature A"],
    cta_label: "Book a call",
    cta_target: n === 3 ? "contact" : "booking",
    is_published: true,
  }));

export const testimonials = (): AdminTestimonial[] =>
  [1, 2, 3, 4, 5].map((n) => ({
    ...meta(52, n),
    quote: `Invented quote number ${n}.`,
    author_name: `Author ${n}`,
    author_role: "Founder",
    company: `Company ${n}`,
    case_study_id: n === 1 ? id(10, 1) : null,
    is_published: n !== 5,
  }));

export const values = (): AdminCoreValue[] =>
  [1, 2, 3, 4].map((n) => ({ ...meta(53, n), title: `Value ${n}`, body: `Value ${n} body.`, is_published: true }));

export const processSteps = (): AdminProcessStep[] =>
  [1, 2, 3, 4].map((n) => ({ ...meta(54, n), title: `Step ${n}`, body: `Step ${n} body.`, is_published: true }));

export const faqCategories = (): AdminFaqCategory[] =>
  [1, 2, 3, 4].map((n) => ({ ...meta(55, n), name: `Category ${n}`, is_published: true, faq_count: 4 }));

export const faqs = (): AdminFaq[] =>
  Array.from({ length: 16 }, (_, i) => {
    const cat = Math.floor(i / 4) + 1;
    const n = (i % 4) + 1;
    return {
      ...meta(56, i + 1),
      position: n - 1,
      category_id: id(55, cat),
      question: `Question ${cat}.${n}?`,
      answer: "An invented answer.",
      show_in_preview: i < 6,
      is_published: true,
    };
  });

export const profile = (): AdminProfile => ({
  name: "Mitali",
  headline: "Content writer and marketing strategist",
  bio: ["First paragraph.", "Second paragraph."],
  skills: ["Content strategy", "Copywriting"],
  tools: ["Notion"],
  years_experience: 8,
  origin_statement: "An invented origin statement.",
  vision_blocks: [
    { heading: "Clarity", body: "Clear words." },
    { heading: "Craft", body: "Careful edits." },
  ],
  portrait_media_id: null,
  portrait_alt: null,
  portrait: null,
  updated_at: T0,
});

export const settings = (): AdminSettings => ({
  contact_email: "hello@example.com",
  booking_url: "https://booking.example.com/mitali",
  social_links: [{ label: "LinkedIn", url: "https://www.linkedin.example.com/in/mitali" }],
  footer_signoff: "Written with care.",
  contact_promise: "Tell me what you're working on. I reply to every enquiry within two working days.",
  footer_rights_line: "All rights reserved. Words, as always, are my own.",
  notification_email: null,
  content_changed_at: T0,
  updated_at: T0,
});

/* ---------------------------------------------------------------- enquiries */
export function enquiry(n: number, overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    id: id(60, n),
    name: `Sender ${n}`,
    email: `sender${n}@example.com`,
    company: n % 2 ? `Company ${n}` : null,
    enquiry_type: "copywriting",
    status: "new",
    created_at: `2026-10-${String(29 - n).padStart(2, "0")}T09:00:00+00:00`,
    budget_range: "1000_3000",
    message: `Hello,\nThis is invented message ${n}.`,
    status_changed_at: null,
    updated_at: T0,
    ...overrides,
  };
}

export function enquirySummary(e: Enquiry): EnquirySummary {
  return { id: e.id, name: e.name, email: e.email, company: e.company, enquiry_type: e.enquiry_type, status: e.status, created_at: e.created_at };
}
