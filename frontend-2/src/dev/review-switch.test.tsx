/**
 * UI-T-132 (development part) and the P1 review aids: `?base=white` sets <html data-base="white"> and the dev-only
 * override swaps the base and band roles (no component changes, REQ-083); the panel toggles the base (mirrored in
 * the URL, no browser storage) and view transitions; `/__review/type` shows every text token with its computed size.
 * The production part (no review code in dist/) is scripts/check-dist.test.ts.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SRC_DIR } from "@/test/paths";
import { renderRoute } from "@/test/render";
import { ReviewPanel } from "./ReviewPanel";
import { getReviewState, resetReviewStateForTests } from "./review-state";
import { applyBase, baseFromSearch, installReviewTools } from "./review-switch";
import { SPECIMEN_TOKENS } from "./TypeSpecimen";

afterEach(() => {
  delete document.documentElement.dataset.base;
  resetReviewStateForTests();
  window.history.replaceState(null, "", "/");
  document.querySelectorAll("[data-review-panel]").forEach((n) => n.remove());
});

describe("UI-T-132 white-base review switch (development)", () => {
  it("?base=white → <html data-base=white>; anything else stays cream", () => {
    expect(baseFromSearch("?base=white")).toBe("white");
    expect(baseFromSearch("?base=cream")).toBe("cream");
    expect(baseFromSearch("")).toBe("cream");
    window.history.replaceState(null, "", "/?base=white&review=off");
    installReviewTools();
    expect(document.documentElement).toHaveAttribute("data-base", "white");
    expect(getReviewState().base).toBe("white");
    expect(document.querySelector("[data-review-panel]")).toBeNull();
  });

  it("the dev override swaps only the semantic base/band roles (surfaces swapped, no component change)", () => {
    const css = readFileSync(join(SRC_DIR, "dev", "review-base.css"), "utf8");
    expect(css).toMatch(/html\[data-base="white"\]\s*\{\s*--surface-base:\s*var\(--p-white\);\s*--surface-band:\s*var\(--p-cream\);\s*\}/);
    expect(readFileSync(join(SRC_DIR, "styles", "semantic.css"), "utf8")).not.toContain("data-base");
  });

  it("the panel toggles the base (URL mirrored, no storage) and view transitions", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const user = userEvent.setup();
    render(<ReviewPanel />);
    const panel = screen.getByRole("complementary", { name: /development only/ });
    await user.click(screen.getByRole("button", { name: /Base: cream/ }));
    expect(document.documentElement).toHaveAttribute("data-base", "white");
    expect(window.location.search).toBe("?base=white");
    await user.click(screen.getByRole("button", { name: /Base: white/ }));
    expect(document.documentElement).not.toHaveAttribute("data-base");
    expect(window.location.search).toBe("");

    const vt = screen.getByRole("button", { name: "View transitions: on" });
    expect(vt).toHaveAttribute("aria-pressed", "true");
    await user.click(vt);
    expect(getReviewState().viewTransitions).toBe(false);
    expect(screen.getByRole("button", { name: "View transitions: off" })).toHaveAttribute("aria-pressed", "false");
    expect(panel.querySelector("a")).toHaveAttribute("href", "/__review/type");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("applyBase without URL update leaves the address untouched", () => {
    act(() => applyBase("white"));
    expect(window.location.search).toBe("");
    expect(document.documentElement.dataset.base).toBe("white");
  });
});

describe("P1 type specimen route (development only)", () => {
  it("/__review/type lists every text token with its computed size", async () => {
    await renderRoute("/__review/type");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Type specimen");
    for (const token of SPECIMEN_TOKENS) {
      expect(screen.getByText(token.token)).toBeInTheDocument();
      // A browser shows computed px values; jsdom does not resolve var(), so only check the row is measured.
      expect(screen.getByTestId(`size-${token.token}`).textContent).toMatch(/ \/ line .* \/ tracking /);
    }
    expect(SPECIMEN_TOKENS.map((t) => t.token)).toEqual([
      "--text-display-xl",
      "--text-display",
      "--text-h2",
      "--text-h3",
      "--text-cta",
      "--text-lead",
      "--text-body",
      "--text-small",
      "--text-label",
      "--text-wordmark",
    ]);
  });
});
