/**
 * Typed response mappers: the only place where API `*_html` fields become `SanitizedHtmlString`
 * (UI-014, SEC-UI-001). The HTML was rendered from Markdown and sanitized by the backend (TS-012).
 */
import { trustApiSanitizedHtml } from "@/api/sanitized";
import type { CaseStudyDetailRaw, WritingSampleDetailRaw } from "@/api/types";
import type { CaseStudyDetail, WritingSampleDetail } from "./content-types";

export function mapCaseStudyDetail(raw: CaseStudyDetailRaw): CaseStudyDetail {
  return {
    ...raw,
    problem_html: trustApiSanitizedHtml(raw.problem_html),
    solution_html: trustApiSanitizedHtml(raw.solution_html),
  };
}

export function mapWritingSampleDetail(raw: WritingSampleDetailRaw): WritingSampleDetail {
  return { ...raw, body_html: trustApiSanitizedHtml(raw.body_html) };
}
