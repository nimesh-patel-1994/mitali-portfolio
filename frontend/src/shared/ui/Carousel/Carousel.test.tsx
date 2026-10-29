import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testimonials } from "@/test/fixtures";
import { renderWithRouter } from "@/test/render";
import { Carousel } from "./Carousel";

function activeSlide() {
  const visible = screen.getAllByRole("group", { hidden: true }).filter((g) => !g.hasAttribute("hidden"));
  expect(visible).toHaveLength(1);
  return visible[0]!;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("UI-T-025 Carousel wraps", () => {
  it("next on the last slide goes to the first; previous on the first goes to the last", async () => {
    const user = userEvent.setup();
    renderWithRouter(<Carousel testimonials={testimonials} />);
    expect(activeSlide()).toHaveAttribute("aria-label", "1 of 5");
    await user.click(screen.getByRole("button", { name: "Previous testimonial" }));
    expect(activeSlide()).toHaveAttribute("aria-label", "5 of 5");
    await user.click(screen.getByRole("button", { name: "Next testimonial" }));
    expect(activeSlide()).toHaveAttribute("aria-label", "1 of 5");
  });

  it("renders every quote in the markup (inactive ones hidden)", () => {
    renderWithRouter(<Carousel testimonials={testimonials} />);
    expect(screen.getAllByRole("group", { hidden: true })).toHaveLength(5);
    expect(screen.getByRole("region", { name: "Client testimonials" })).toHaveAttribute("aria-roledescription", "carousel");
  });
});

describe("UI-T-026 Carousel keyboard and live region", () => {
  it("Enter/Space on Next changes slide and announces quote and author; silent on first render", async () => {
    const user = userEvent.setup();
    const { container } = renderWithRouter(<Carousel testimonials={testimonials} />);
    const live = container.querySelector("[aria-live='polite']")!;
    expect(live).toHaveTextContent("");
    screen.getByRole("button", { name: "Next testimonial" }).focus();
    await user.keyboard("{Enter}");
    expect(activeSlide()).toHaveAttribute("aria-label", "2 of 5");
    expect(live).toHaveTextContent(testimonials[1]!.quote);
    expect(live).toHaveTextContent(testimonials[1]!.author_name);
    await user.keyboard(" ");
    expect(activeSlide()).toHaveAttribute("aria-label", "3 of 5");
  });
});

describe("UI-T-027 Carousel indicators, no autoplay", () => {
  it("indicator 3 activates slide 3 with aria-current and nothing changes after 60 s", () => {
    vi.useFakeTimers();
    renderWithRouter(<Carousel testimonials={testimonials} />);
    fireEvent.click(screen.getByRole("button", { name: "Show testimonial 3 of 5" }));
    expect(screen.getByRole("button", { name: "Show testimonial 3 of 5" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Show testimonial 1 of 5" })).not.toHaveAttribute("aria-current");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(activeSlide()).toHaveAttribute("aria-label", "3 of 5");
  });
});

describe("UI-T-028 Carousel swipe and counts", () => {
  it("swiping left by 60 px shows the next slide; vertical drags do not", () => {
    const { container } = renderWithRouter(<Carousel testimonials={testimonials} />);
    const viewport = container.querySelector("[aria-roledescription='slide']")!.parentElement!;
    fireEvent.pointerDown(viewport, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(viewport, { clientX: 140, clientY: 104, pointerId: 1 });
    expect(activeSlide()).toHaveAttribute("aria-label", "2 of 5");
    fireEvent.pointerDown(viewport, { clientX: 200, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(viewport, { clientX: 150, clientY: 220, pointerId: 2 });
    expect(activeSlide()).toHaveAttribute("aria-label", "2 of 5");
    fireEvent.pointerDown(viewport, { clientX: 100, clientY: 100, pointerId: 3 });
    fireEvent.pointerUp(viewport, { clientX: 130, clientY: 100, pointerId: 3 });
    expect(activeSlide()).toHaveAttribute("aria-label", "2 of 5");
  });

  it("one testimonial: no controls", () => {
    renderWithRouter(<Carousel testimonials={testimonials.slice(0, 1)} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(testimonials[0]!.quote)).toBeVisible();
  });

  it("zero testimonials: nothing rendered", () => {
    const { container } = renderWithRouter(<Carousel testimonials={[]} />);
    expect(container.querySelector("section")).toBeNull();
  });

  it("shows the case-study link only for testimonials with a slug (UI-026)", () => {
    renderWithRouter(<Carousel testimonials={testimonials} />);
    const links = screen.getAllByRole("link", { name: "Read the case study", hidden: true });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/work/case-study-1");
  });
});
