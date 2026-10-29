import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "@/test/render";
import { BookCallLink } from "./BookCallLink";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";

describe("UI-T-017 Button and ButtonLink", () => {
  it.each(["primary", "secondary", "ghost"] as const)("applies the %s variant class", (variant) => {
    renderWithRouter(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain(variant);
  });

  it("loading disables the button, sets aria-busy and keeps the label", () => {
    renderWithRouter(<Button loading>Send enquiry</Button>);
    const button = screen.getByRole("button", { name: "Send enquiry" });
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

describe("UI-T-018 BookCallLink", () => {
  it("valid https URL opens externally in a new tab", () => {
    renderWithRouter(<BookCallLink bookingUrl="https://booking.example.com/mitali" />);
    const link = screen.getByRole("link", { name: /Book a call/ });
    expect(link).toHaveAttribute("href", "https://booking.example.com/mitali");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each([null, undefined, "", "#", "javascript:alert(1)", "ftp://x", "/relative", " https://example.com"])(
    "%s falls back to /contact",
    (bookingUrl) => {
      renderWithRouter(<BookCallLink bookingUrl={bookingUrl} />);
      const link = screen.getByRole("link", { name: "Book a call" });
      expect(link).toHaveAttribute("href", "/contact");
      expect(link).not.toHaveAttribute("target");
    },
  );
});
