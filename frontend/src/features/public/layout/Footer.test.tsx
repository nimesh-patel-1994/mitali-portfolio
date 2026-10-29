import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SiteBundle } from "@/api/types";
import * as fx from "@/test/fixtures";
import { renderWithRouter } from "@/test/render";
import { Footer } from "./Footer";

function withSettings(settings: Partial<SiteBundle["settings"]>, generatedAt = fx.GENERATED_AT): SiteBundle {
  return { ...fx.site, generated_at: generatedAt, settings: { ...fx.site.settings, ...settings } };
}

function footer(): HTMLElement {
  return screen.getByRole("contentinfo");
}

describe("UI-T-039 Footer", () => {
  it("quick links, social links in a new tab, mailto email, build year and sign-off", () => {
    renderWithRouter(<Footer site={fx.site} />);
    const quick = within(footer()).getByRole("navigation", { name: "Footer" });
    expect(within(quick).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Work", "/work"],
      ["Writing", "/writing"],
      ["About", "/about"],
      ["Contact", "/contact"],
      ["FAQs", "/faqs"],
    ]);

    const linkedIn = within(footer()).getByRole("link", { name: "LinkedIn (opens in a new tab)" });
    expect(linkedIn).toHaveAttribute("href", "https://www.linkedin.example.com/in/mitali");
    expect(linkedIn).toHaveAttribute("target", "_blank");
    expect(linkedIn).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(footer()).getByRole("link", { name: "Instagram (opens in a new tab)" })).toBeInTheDocument();

    expect(within(footer()).getByRole("link", { name: "hello@example.com" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com",
    );
    expect(within(footer()).getByText("© 2026 Mitali")).toBeInTheDocument();
    expect(within(footer()).getByText((_, el) => el?.tagName === "P" && el.textContent === "Edition 2026")).toBeInTheDocument();
    expect(within(footer()).getByText(fx.site.settings.footer_signoff)).toBeInTheDocument();
    expect(within(footer()).getByText("Content & strategy")).toBeInTheDocument();
    expect(within(footer()).getByRole("img", { name: "Mitali" })).toHaveTextContent("MITALI");
    expect(footer()).toHaveAttribute("data-surface", "dark");
  });

  it("year comes from site.generated_at (UTC), not the clock", () => {
    renderWithRouter(<Footer site={withSettings({}, "2031-12-31T23:30:00-05:00")} />);
    expect(within(footer()).getByText("© 2032 Mitali")).toBeInTheDocument();
  });

  it("SEC-UI-004: a javascript: social link is not rendered as a link", () => {
    renderWithRouter(
      <Footer
        site={withSettings({
          social_links: [
            { label: "Bad", url: "javascript:alert(1)" },
            { label: "LinkedIn", url: "https://www.linkedin.example.com/in/mitali" },
          ],
        })}
      />,
    );
    expect(within(footer()).queryByText("Bad")).toBeNull();
    expect(within(footer()).getByRole("link", { name: /LinkedIn/ })).toBeInTheDocument();
  });

  it("no site data (root error): quick links and rights line only", () => {
    renderWithRouter(<Footer site={undefined} />);
    expect(within(footer()).getAllByRole("link")).toHaveLength(5);
    expect(within(footer()).queryByText(/©/)).toBeNull();
  });
});

describe("UI-T-040 Footer without social links", () => {
  it("omits the social group entirely", () => {
    renderWithRouter(<Footer site={withSettings({ social_links: [] })} />);
    expect(within(footer()).queryByRole("heading", { name: "Follow along" })).toBeNull();
    expect(within(footer()).getAllByRole("list")).toHaveLength(2);
    for (const list of within(footer()).getAllByRole("list")) {
      expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(0);
    }
  });

  it("only unsafe social links → group omitted", () => {
    renderWithRouter(<Footer site={withSettings({ social_links: [{ label: "X", url: "ftp://x.example" }] })} />);
    expect(within(footer()).queryByRole("heading", { name: "Follow along" })).toBeNull();
  });
});
