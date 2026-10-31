/**
 * UI-T-138 / UI-107 / REQ-004: the giant "let's talk" call-to-action to /contact; quick links incl. FAQs; only
 * http(s) social links, with target/rel; the year of generated_at; the rights line as literal text.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SiteBundle } from "@/api/types";
import * as fx from "@/test/fixtures";
import { renderWithRouter } from "@/test/render";
import { buildYear, Footer, safeSocialLinks } from "./Footer";

function site(overrides: Partial<SiteBundle["settings"]> = {}, generatedAt = "2026-03-01T10:00:00+00:00"): SiteBundle {
  return { ...fx.site, generated_at: generatedAt, settings: { ...fx.site.settings, ...overrides } };
}

describe("UI-T-138 Footer", () => {
  it("let's talk → /contact, quick links, safe social links, year, literal rights line", () => {
    renderWithRouter(
      <Footer
        site={site({
          social_links: [
            { label: "LinkedIn", url: "https://www.linkedin.example.com/in/mitali" },
            { label: "Evil", url: "javascript:alert(1)" },
          ],
          footer_rights_line: "All <b>words</b> mine",
        })}
      />,
    );
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveAttribute("data-surface", "deep");

    const cta = within(footer).getByRole("link", { name: "let's talk: contact Mitali" });
    expect(cta).toHaveAttribute("href", "/contact");
    expect(cta.querySelectorAll('[aria-hidden="true"] svg')).toHaveLength(2);

    const quick = within(footer).getByRole("navigation", { name: "Explore" });
    expect(within(quick).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Work", "/work"],
      ["Writing", "/writing"],
      ["About", "/about"],
      ["Contact", "/contact"],
      ["FAQs", "/faqs"],
    ]);

    const social = within(footer).getByRole("link", { name: "LinkedIn (opens in a new tab)" });
    expect(social).toHaveAttribute("target", "_blank");
    expect(social).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(footer).queryByText(/Evil/)).toBeNull();
    expect(footer.innerHTML).not.toContain("javascript:");

    expect(within(footer).getByText("© 2026 Mitali")).toBeInTheDocument();
    expect(within(footer).getByText("All <b>words</b> mine")).toBeInTheDocument();
    expect(footer.querySelector("b")).toBeNull();
    expect(within(footer).getByText(fx.site.settings.footer_signoff)).toBeInTheDocument();

    const mail = within(footer).getAllByRole("link").filter((l) => l.getAttribute("href") === "mailto:hello@example.com");
    expect(mail.length).toBeGreaterThan(0);
    expect(within(footer).getByRole("img", { name: "Mitali" })).toHaveTextContent("MITALI");
  });

  it("no valid social links → group omitted; invalid email → no mailto", () => {
    renderWithRouter(<Footer site={site({ social_links: [{ label: "x", url: "ftp://x" }], contact_email: "not an email" })} />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByText("Follow along")).toBeNull();
    expect(footer.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("year comes from the snapshot, never the clock", () => {
    expect(buildYear(site({}, "2031-12-31T23:30:00+00:00"))).toBe("2031");
    expect(buildYear(undefined)).toBeNull();
    expect(safeSocialLinks([{ label: " ", url: "https://x.example" }])).toEqual([]);
  });
});

describe("WCAG 2.5.3 label in name (axe label-content-name-mismatch)", () => {
  it("the footer CTA's visible text is \"let's talk\" and its accessible name starts with it", () => {
    renderWithRouter(<Footer site={site()} />);
    const cta = within(screen.getByRole("contentinfo")).getByRole("link", { name: /contact Mitali/ });
    const visible = (cta.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(visible).toBe("let's talk");
    const name = cta.getAttribute("aria-label") ?? "";
    expect(name.toLowerCase().startsWith(visible.toLowerCase())).toBe(true);
  });

  it("every link with an aria-label in the layout contains its visible text", async () => {
    const { renderRoute } = await import("@/test/render");
    await renderRoute("/");
    for (const link of document.querySelectorAll<HTMLElement>("a[aria-label]")) {
      const visible = (link.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      expect(link.getAttribute("aria-label")!.toLowerCase(), link.getAttribute("href") ?? "").toContain(visible);
    }
  });
});
