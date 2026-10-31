/**
 * UI-T-143 / UI-110: ports of frontend/ UI-T-031, 033, 034 (SampleDataNote, FaqPreview, StoryBlock) plus MetaRow,
 * OffsetText, IntroSplit and the cardless CaseStudyUnit. Accordion (UI-T-023/024), Carousel (UI-T-025..028) and
 * SanitizedHtml (UI-T-030) keep their ported test files next to the components.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { trustApiSanitizedHtml } from "@/api/sanitized";
import { faqPreview, site, caseStudies } from "@/test/fixtures";
import { renderWithRouter } from "@/test/render";
import { FaqPreview } from "./FaqPreview/FaqPreview";
import { IntroSplit } from "./IntroSplit/IntroSplit";
import { MetaRow } from "./MetaRow/MetaRow";
import { OffsetText } from "./OffsetText/OffsetText";
import { SampleDataNote } from "./SampleDataNote/SampleDataNote";
import { SanitizedHtml } from "./SanitizedHtml/SanitizedHtml";
import { StoryBlock } from "./StoryBlock/StoryBlock";
import { CaseStudyUnit, UnitGrid } from "./WorkUnit/WorkUnit";

describe("UI-T-143 SampleDataNote (port of UI-T-031)", () => {
  it("variants show their labels; false renders nothing", () => {
    const { container } = renderWithRouter(
      <>
        <SampleDataNote show />
        <SampleDataNote show variant="caseStudy" />
        <SampleDataNote show variant="sample" />
        <SampleDataNote show={false} variant="caseStudy" />
      </>,
    );
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(screen.getByText("Sample case study")).toBeInTheDocument();
    expect(screen.getByText("Sample")).toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(3);
  });
});

describe("UI-T-143 FaqPreview (port of UI-T-033)", () => {
  it("6 preview FAQs collapsed in order, a link to /faqs, blank lines become paragraphs", async () => {
    renderWithRouter(<FaqPreview faqs={faqPreview} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(faqPreview.map((f) => f.question));
    for (const b of buttons) expect(b).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "See all FAQs" })).toHaveAttribute("href", "/faqs");
    expect(screen.getByRole("region", { name: "Good questions" })).toHaveAttribute("data-surface", "base");
    await userEvent.setup().click(buttons[0]!);
    const region = screen.getByRole("region", { name: faqPreview[0]!.question });
    expect(within(region).getAllByText(/paragraph of answer/)).toHaveLength(2);
  });

  it("0 FAQs: nothing rendered", () => {
    const { container } = renderWithRouter(<FaqPreview faqs={[]} />);
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("UI-T-143 StoryBlock (port of UI-T-034)", () => {
  it("portrait with alt in a 5:6 frame, 3 paragraphs and the sign-off", () => {
    renderWithRouter(<StoryBlock profile={site.profile} />);
    expect(screen.getByRole("img", { name: "Portrait of Mitali" })).toBeInTheDocument();
    for (const paragraph of site.profile.bio) expect(screen.getByText(paragraph)).toBeInTheDocument();
    expect(screen.getByText("— Mitali")).toBeInTheDocument();
    expect(document.querySelector('[data-ratio="5x6"]')).not.toBeNull();
  });

  it("no portrait: fallback block; empty bio: hidden", () => {
    const { container, unmount } = renderWithRouter(<StoryBlock profile={{ ...site.profile, portrait: null }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-fallback='true']")).not.toBeNull();
    unmount();
    const empty = renderWithRouter(<StoryBlock profile={{ ...site.profile, bio: ["  "] }} />);
    expect(empty.container.querySelector("section")).toBeNull();
  });
});

describe("UI-T-143 MetaRow, OffsetText, IntroSplit", () => {
  it("MetaRow with 6 fields renders a <dl> in field order and skips empty values", () => {
    const fields = [
      { label: "Client", value: "Client 1 Ltd" },
      { label: "Year", value: "2025" },
      { label: "Industry", value: "Retail" },
      { label: "Timeline", value: "8 weeks" },
      { label: "Campaign type", value: "Brand launch" },
      { label: "Channels", value: "Blog, Email" },
    ];
    const { container } = renderWithRouter(<MetaRow fields={fields} label="Project details" />);
    const dl = container.querySelector("dl")!;
    expect(dl).toHaveAttribute("aria-label", "Project details");
    expect([...dl.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(fields.map((f) => f.label));
    expect([...dl.querySelectorAll("dd")].map((d) => d.textContent)).toEqual(fields.map((f) => f.value));

    const { container: partial } = renderWithRouter(<MetaRow fields={[{ label: "Client", value: " " }, { label: "Year", value: "2025" }]} label="x" />);
    expect(partial.querySelectorAll("dt")).toHaveLength(1);
  });

  it("OffsetText: h2 + content in the offset column of the 12-column grid", () => {
    renderWithRouter(
      <OffsetText heading="The problem" headingId="p">
        <SanitizedHtml html={trustApiSanitizedHtml("<p>Body</p>")} />
      </OffsetText>,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "The problem" });
    expect(heading.parentElement).toHaveClass("offset");
    expect(heading.parentElement!.parentElement).toHaveClass("grid12");
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("IntroSplit renders aside and body", () => {
    renderWithRouter(<IntroSplit aside={<p>Overview</p>}>{<p>Summary text</p>}</IntroSplit>);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Summary text")).toBeInTheDocument();
  });
});

describe("UI-T-143 cardless case-study unit (port of UI-T-019/020 behaviour)", () => {
  it("image, chip, title as the single link to the case study, summary; units in a hairline grid", () => {
    renderWithRouter(
      <UnitGrid>
        {caseStudies.slice(0, 2).map((cs) => (
          <CaseStudyUnit key={cs.slug} caseStudy={cs} />
        ))}
      </UnitGrid>,
    );
    const units = screen.getAllByRole("article");
    expect(units).toHaveLength(2);
    const first = units[0]!;
    const links = within(first).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/work/case-study-1");
    expect(links[0]).toHaveAccessibleName("Case study 1");
    expect(within(first).getByRole("heading", { level: 3 })).toHaveTextContent("Case study 1");
    expect(within(first).getByText("Brand launch")).toBeInTheDocument();
    expect(within(first).getByRole("img", { name: "Cover artwork for case study 1" })).toHaveAttribute("loading", "lazy");
    expect(screen.getAllByRole("listitem").every((li) => li.hasAttribute("data-reveal"))).toBe(true);
  });
});
