import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Accordion, type AccordionItem } from "./Accordion";

const items: AccordionItem[] = [
  { id: "a", title: "First question?", content: <p>First answer</p> },
  { id: "b", title: "Second question?", content: <p>Second answer</p> },
  { id: "c", title: "Third question?", content: <p>Third answer</p> },
];

describe("UI-T-023 Accordion toggling", () => {
  it("starts collapsed with aria-controls pointing at a labelled region", () => {
    render(<Accordion items={items} />);
    const button = screen.getByRole("button", { name: "First question?" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(panel).toHaveAttribute("role", "region");
    expect(panel).toHaveAttribute("aria-labelledby", button.id);
    expect(panel).toHaveAttribute("hidden");
    expect(screen.getByRole("heading", { level: 3, name: "First question?" })).toContainElement(button);
  });

  it("toggles with click, Enter and Space", async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} />);
    const button = screen.getByRole("button", { name: "First question?" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "First question?" })).toHaveTextContent("First answer");
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});

describe("UI-T-024 Accordion independence and SSR ids", () => {
  it("keeps two items open at once", async () => {
    const user = userEvent.setup();
    render(<Accordion items={items} columns={2} />);
    await user.click(screen.getByRole("button", { name: "First question?" }));
    await user.click(screen.getByRole("button", { name: "Third question?" }));
    expect(screen.getByRole("button", { name: "First question?" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Third question?" })).toHaveAttribute("aria-expanded", "true");
  });

  it("two-column layout keeps DOM order column by column", () => {
    render(<Accordion items={items} columns={2} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "First question?",
      "Second question?",
      "Third question?",
    ]);
  });

  it("server markup ids equal the client render ids (useId)", () => {
    const html = renderToString(<Accordion items={items} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    const serverIds = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(serverIds.length).toBe(6);
    expect(container.querySelectorAll("[hidden]")).toHaveLength(3);
    const client = render(<Accordion items={items} />, { container, hydrate: true });
    const clientIds = [...client.container.querySelectorAll("[id]")].map((el) => el.id);
    expect(clientIds).toEqual(serverIds);
  });
});
