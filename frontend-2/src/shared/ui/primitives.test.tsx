/**
 * UI-T-142 / UI-108: Button variants and loading, ButtonLink internal/external/unsafe, BookCallLink fallbacks,
 * ArrowLink (two aria-hidden arrows, one accessible name), Chip / FilterChip active, Wordmark (ports of
 * frontend/ UI-T-016..018, UI-T-021).
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { ArrowLink } from "./ArrowLink/ArrowLink";
import { BookCallLink } from "./Button/BookCallLink";
import { Button } from "./Button/Button";
import { ButtonLink } from "./Button/ButtonLink";
import { Chip, FilterChip } from "./Chip/Chip";
import { HairlineList } from "./HairlineList/HairlineList";
import { Wordmark } from "./Wordmark/Wordmark";

describe("UI-T-142 Button and ButtonLink", () => {
  it.each(["primary", "secondary"] as const)("applies the %s variant class", (variant) => {
    renderWithRouter(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain(variant);
  });

  it("loading disables the button, sets aria-busy and keeps the label", () => {
    renderWithRouter(<Button loading>Sending…</Button>);
    const button = screen.getByRole("button", { name: "Sending…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("disabled without loading has no aria-busy", () => {
    renderWithRouter(<Button disabled>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("aria-busy");
  });

  it("internal href renders a router link without target", () => {
    renderWithRouter(<ButtonLink href="/work">View work</ButtonLink>);
    const link = screen.getByRole("link", { name: "View work" });
    expect(link).toHaveAttribute("href", "/work");
    expect(link).not.toHaveAttribute("target");
  });

  it("external href opens in a new tab with rel and a hidden notice (SEC-UI-004)", () => {
    renderWithRouter(<ButtonLink href="https://example.com/x">Visit</ButtonLink>);
    const link = screen.getByRole("link", { name: "Visit (opens in a new tab)" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each(["javascript:alert(1)", "//evil.example", "data:text/html,x", "ftp://x"])("unsafe href %s renders nothing", (href) => {
    renderWithRouter(<ButtonLink href={href}>Bad</ButtonLink>);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("UI-T-142 BookCallLink", () => {
  it("valid https URL opens externally in a new tab", () => {
    renderWithRouter(<BookCallLink bookingUrl="https://booking.example.com/mitali" />);
    const link = screen.getByRole("link", { name: /Book a call/ });
    expect(link).toHaveAttribute("href", "https://booking.example.com/mitali");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each([null, undefined, "", "#", "javascript:alert(1)", "ftp://x", "/relative"])("%s falls back to /contact", (bookingUrl) => {
    renderWithRouter(<BookCallLink bookingUrl={bookingUrl} />);
    const link = screen.getByRole("link", { name: "Book a call" });
    expect(link).toHaveAttribute("href", "/contact");
    expect(link).not.toHaveAttribute("target");
  });
});

describe("UI-T-142 ArrowLink, Chip, Wordmark, HairlineList", () => {
  it("ArrowLink: one accessible name and two aria-hidden arrows", () => {
    renderWithRouter(<ArrowLink to="/work">View all work</ArrowLink>);
    const link = screen.getByRole("link", { name: "View all work" });
    expect(link).toHaveAttribute("href", "/work");
    const hidden = link.querySelector('[aria-hidden="true"]')!;
    expect(hidden.querySelectorAll("svg")).toHaveLength(2);
    expect(link.querySelectorAll("svg")).toHaveLength(2);
  });

  it("ArrowLink label overrides the visible text for the accessible name", () => {
    renderWithRouter(
      <ArrowLink to="/contact" label="Let's talk: contact Mitali" size="cta">
        let's talk
      </ArrowLink>,
    );
    expect(screen.getByRole("link", { name: "Let's talk: contact Mitali" })).toHaveAttribute("href", "/contact");
  });

  it("Chip renders text; FilterChip marks the active one with aria-current and the active class", () => {
    renderWithRouter(
      <>
        <Chip>Brand launch</Chip>
        <FilterChip to="/writing?format=blog" active>
          Blog
        </FilterChip>
        <FilterChip to="/writing?format=email" active={false}>
          Email
        </FilterChip>
      </>,
    );
    expect(screen.getByText("Brand launch")).toBeInTheDocument();
    const blog = screen.getByRole("link", { name: "Blog" });
    expect(blog).toHaveAttribute("aria-current", "true");
    expect(blog.className).toMatch(/active/);
    expect(screen.getByRole("link", { name: "Email" })).not.toHaveAttribute("aria-current");
  });

  it("Wordmark: MITALI text; as a link its accessible name is 'Mitali, home'", () => {
    renderWithRouter(
      <>
        <Wordmark to="/" />
        <Wordmark size="footer" />
      </>,
    );
    expect(screen.getByRole("link", { name: "Mitali, home" })).toHaveTextContent("MITALI");
    expect(screen.getByRole("img", { name: "Mitali" })).toHaveTextContent("MITALI");
  });

  it("HairlineList renders a list of items", () => {
    renderWithRouter(
      <HairlineList columns={3} rule="vertical" aria-label="Units">
        <li>a</li>
        <li>b</li>
      </HairlineList>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
