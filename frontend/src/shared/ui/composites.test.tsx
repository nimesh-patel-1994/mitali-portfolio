import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { faqPreview, site } from "@/test/fixtures";
import { renderWithRouter } from "@/test/render";
import { CtaBand } from "./CtaBand/CtaBand";
import { FaqPreview } from "./FaqPreview/FaqPreview";
import { SampleDataNote } from "./SampleDataNote/SampleDataNote";
import { StoryBlock } from "./StoryBlock/StoryBlock";

describe("UI-T-031 SampleDataNote", () => {
  it("flag true shows 'Sample data'", () => {
    renderWithRouter(<SampleDataNote show />);
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });

  it("variants show their labels", () => {
    renderWithRouter(
      <>
        <SampleDataNote show variant="caseStudy" />
        <SampleDataNote show variant="sample" />
      </>,
    );
    expect(screen.getByText("Sample case study")).toBeInTheDocument();
    expect(screen.getByText("Sample")).toBeInTheDocument();
  });

  it("flag false renders nothing", () => {
    const { container } = renderWithRouter(<SampleDataNote show={false} />);
    expect(container.querySelector("p")).toBeNull();
  });
});

describe("UI-T-032 CtaBand", () => {
  it("booking URL set: h2 statement, external Book a call, Contact link", () => {
    renderWithRouter(<CtaBand bookingUrl="https://booking.example.com/mitali" />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Got something to say?");
    expect(heading).toHaveTextContent("Let's make it land.");
    const book = screen.getByRole("link", { name: /Book a call/ });
    expect(book).toHaveAttribute("href", "https://booking.example.com/mitali");
    expect(book).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Send a message" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("region")).toHaveAttribute("data-surface", "dark");
  });

  it("booking URL empty: Book a call links to /contact", () => {
    renderWithRouter(<CtaBand bookingUrl="" />);
    expect(screen.getByRole("link", { name: "Book a call" })).toHaveAttribute("href", "/contact");
  });
});

describe("UI-T-033 FaqPreview", () => {
  it("6 preview FAQs: collapsed items in order and a link to /faqs", async () => {
    renderWithRouter(<FaqPreview faqs={faqPreview} />);
    expect(faqPreview).toHaveLength(6);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(faqPreview.map((f) => f.question));
    for (const b of buttons) expect(b).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "See all FAQs" })).toHaveAttribute("href", "/faqs");
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    // Blank lines become paragraphs.
    await userEvent.setup().click(buttons[0]!);
    const region = screen.getByRole("region", { name: faqPreview[0]!.question });
    expect(within(region).getAllByText(/paragraph of answer/)).toHaveLength(2);
  });

  it("0 FAQs: nothing rendered", () => {
    const { container } = renderWithRouter(<FaqPreview faqs={[]} />);
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("UI-T-034 StoryBlock", () => {
  it("portrait with alt and 3 paragraphs plus sign-off", () => {
    renderWithRouter(<StoryBlock profile={site.profile} />);
    expect(screen.getByRole("img", { name: "Portrait of Mitali" })).toBeInTheDocument();
    for (const paragraph of site.profile.bio) expect(screen.getByText(paragraph)).toBeInTheDocument();
    expect(screen.getByText("— Mitali")).toBeInTheDocument();
    expect(screen.getByRole("region")).toHaveAttribute("data-surface", "cream");
  });

  it("no portrait: fallback block with the paragraphs", () => {
    const { container } = renderWithRouter(<StoryBlock profile={{ ...site.profile, portrait: null }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-fallback='true']")).not.toBeNull();
    expect(screen.getByText(site.profile.bio[0]!)).toBeInTheDocument();
  });

  it("empty bio: section hidden", () => {
    const { container } = renderWithRouter(<StoryBlock profile={{ ...site.profile, bio: ["  "] }} />);
    expect(container.querySelector("section")).toBeNull();
  });
});
