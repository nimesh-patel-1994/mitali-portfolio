import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { caseStudies, writingSamples } from "@/test/fixtures";
import { renderWithRouter } from "@/test/render";
import { CardGrid, CaseStudyCard, WritingSampleCard } from "./Card";

describe("UI-T-022 cards", () => {
  it("case-study card: single link to the detail URL, chip, summary, image alt", () => {
    const cs = caseStudies[0]!;
    renderWithRouter(<CaseStudyCard caseStudy={cs} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", `/work/${cs.slug}`);
    expect(screen.getByRole("heading", { level: 3, name: cs.title })).toBeInTheDocument();
    expect(screen.getByText(cs.campaign_type)).toBeInTheDocument();
    expect(screen.getByText(cs.summary)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: cs.cover!.alt })).toHaveAttribute("sizes", "(min-width: 810px) 50vw, 100vw");
  });

  it("writing card shows the format label and 'Sample' only when flagged (UI-015)", () => {
    const flagged = writingSamples.find((s) => s.is_sample)!;
    const plain = writingSamples.find((s) => !s.is_sample)!;
    const { unmount } = renderWithRouter(<WritingSampleCard sample={flagged} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/writing/${flagged.slug}`);
    expect(screen.getByText("Blog")).toBeInTheDocument();
    expect(screen.getByText("Sample")).toBeInTheDocument();
    unmount();
    renderWithRouter(<WritingSampleCard sample={plain} />);
    expect(screen.queryByText("Sample")).toBeNull();
  });

  it("missing image renders a fallback block instead of an img", () => {
    const noThumb = writingSamples.find((s) => s.thumbnail === null)!;
    const { container } = renderWithRouter(<WritingSampleCard sample={noThumb} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-fallback='true']")).not.toBeNull();
  });

  it("CardGrid wraps each card in a list item, keeping order", () => {
    renderWithRouter(
      <CardGrid>
        {caseStudies.map((cs) => (
          <CaseStudyCard key={cs.slug} caseStudy={cs} />
        ))}
      </CardGrid>,
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(within(items[0]!).getByRole("link")).toHaveAttribute("href", "/work/case-study-1");
  });
});
