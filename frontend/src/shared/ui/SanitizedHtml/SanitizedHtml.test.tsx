import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { trustApiSanitizedHtml, type SanitizedHtmlString } from "@/api/sanitized";
import { SRC_DIR } from "@/test/paths";
import { SanitizedHtml, type SanitizedHtmlProps } from "./SanitizedHtml";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("UI-T-030 SanitizedHtml (SEC-UI-001)", () => {
  it("renders branded HTML inside the prose container", () => {
    const html = trustApiSanitizedHtml('<h2>Heading</h2><ul><li>One</li></ul><p><a href="https://example.com">Link</a></p>');
    const { container } = render(<SanitizedHtml html={html} />);
    const prose = container.firstElementChild!;
    expect(prose.className).toContain("prose");
    expect(screen.getByRole("heading", { level: 2, name: "Heading" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("One");
    expect(screen.getByRole("link", { name: "Link" })).toHaveAttribute("href", "https://example.com");
  });

  it("accepts only the branded type (a plain string does not type-check)", () => {
    expectTypeOf<SanitizedHtmlProps["html"]>().toEqualTypeOf<SanitizedHtmlString>();
    expectTypeOf<string>().not.toExtend<SanitizedHtmlProps["html"]>();
    // @ts-expect-error a plain string is not SanitizedHtmlString
    const props: SanitizedHtmlProps = { html: "<p>raw</p>" };
    expect(props).toBeDefined();
  });

  it("dangerouslySetInnerHTML appears in SanitizedHtml.tsx only", () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter((file) => readFileSync(file, "utf8").includes("dangerouslySetInnerHTML"))
      .map((file) => relative(SRC_DIR, file).split(sep).join("/"));
    expect(offenders).toEqual(["shared/ui/SanitizedHtml/SanitizedHtml.tsx"]);
  });

  it("trustApiSanitizedHtml is imported only by the typed mappers", () => {
    const users = sourceFiles(SRC_DIR)
      .filter((file) => /^import\s[^;]*\btrustApiSanitizedHtml\b/m.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC_DIR, file).split(sep).join("/"));
    expect(users).toEqual(["app/content-mappers.ts"]);
  });
});
