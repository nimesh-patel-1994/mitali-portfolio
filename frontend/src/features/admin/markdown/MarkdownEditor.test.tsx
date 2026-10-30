import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { apiError, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderWithAdminProviders, setupAdminServer } from "@/test/admin-render";
import { MarkdownEditor, PREVIEW_ERROR } from "./MarkdownEditor";

const server = setupAdminServer();

function Controlled({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <MarkdownEditor label="Body" value={value} onChange={setValue} required maxLength={100_000} />;
}

const previews = () => requestsTo("POST", "/api/admin/markdown/preview");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("UI-T-083 Markdown editor with live preview", () => {
  it("empty → 'Nothing to preview yet'; typing quickly sends one request after the 400 ms pause", async () => {
    const { user } = renderWithAdminProviders(<Controlled />);
    expect(screen.getByText("Nothing to preview yet")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /^Body/ }), "Hello world");
    expect(previews()).toHaveLength(0);
    expect(await screen.findByText("Hello world", { selector: "p" })).toBeInTheDocument();
    expect(previews()).toHaveLength(1);
    expect(previews()[0]!.body).toEqual({ markdown: "Hello world" });
    expect(screen.getByText("11 of 100,000 characters")).toBeInTheDocument();
  });

  it("slow first response then fast second → the latest text's preview wins", async () => {
    let call = 0;
    server.use(
      http.post("*/api/admin/markdown/preview", async ({ request }) => {
        call += 1;
        const { markdown } = (await request.json()) as { markdown: string };
        if (call === 1) await delay(700);
        return HttpResponse.json({ html: `<p>${markdown}</p>`, word_count: 1, reading_time_min: 1 });
      }),
    );
    const { user } = renderWithAdminProviders(<Controlled />);
    const box = screen.getByRole("textbox", { name: /^Body/ });
    await user.type(box, "first");
    await pause(450);
    await user.type(box, " second");
    expect(await screen.findByText("first second", { selector: "p" })).toBeInTheDocument();
    await pause(500);
    expect(screen.queryByText("first", { selector: "p" })).toBeNull();
    expect(screen.getByText("first second", { selector: "p" })).toBeInTheDocument();
  });

  it("500 → 'Preview unavailable…', text kept; Retry recovers", async () => {
    let fail = true;
    server.use(
      http.post("*/api/admin/markdown/preview", () =>
        fail ? apiError(500, "internal_error", "Boom") : HttpResponse.json({ html: "<p>Recovered</p>", word_count: 1, reading_time_min: 1 }),
      ),
    );
    const { user } = renderWithAdminProviders(<Controlled />);
    await user.type(screen.getByRole("textbox", { name: /^Body/ }), "Some text");
    await findInRegion(PREVIEW_ERROR);
    expect(screen.getByRole("textbox", { name: /^Body/ })).toHaveValue("Some text");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry preview" }));
    expect(await screen.findByText("Recovered")).toBeInTheDocument();
  });

  it("100 001 characters → limit error and no preview request for it", async () => {
    renderWithAdminProviders(<Controlled />);
    fireEvent.change(screen.getByRole("textbox", { name: /^Body/ }), { target: { value: "x".repeat(100_001) } });
    expect(screen.getByRole("textbox", { name: /^Body/ })).toHaveAccessibleDescription(/Keep this to 100,000 characters or fewer\./);
    expect(screen.getByText("100,001 of 100,000 characters")).toBeInTheDocument();
    await pause(500);
    expect(previews()).toHaveLength(0);
  });

  it("Write / Preview tabs below desktop (tablist, aria-selected, arrow keys)", async () => {
    const { user } = renderWithAdminProviders(<Controlled initial="Ready" />);
    const write = screen.getByRole("tab", { name: "Write" });
    const preview = screen.getByRole("tab", { name: "Preview" });
    expect(write).toHaveAttribute("aria-selected", "true");
    await user.click(preview);
    expect(preview).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Preview" })).toHaveAttribute("data-active");
    await user.keyboard("{ArrowLeft}");
    expect(write).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(document.activeElement).toBe(write));
  });
});

describe("UI-T-083 Markdown preview cache keys", () => {
  it("keys use the editor id + a revision (never the text); superseded previews are dropped from the cache", async () => {
    const { user, queryClient } = renderWithAdminProviders(<Controlled />);
    const box = screen.getByRole("textbox", { name: /^Body/ });
    await user.type(box, "secret one");
    expect(await screen.findByText("secret one", { selector: "p" })).toBeInTheDocument();
    await user.type(box, " two");
    expect(await screen.findByText("secret one two", { selector: "p" })).toBeInTheDocument();
    const keys = () => queryClient.getQueryCache().findAll({ queryKey: ["admin", "markdown-preview"] }).map((q) => q.queryKey);
    await waitFor(() => expect(keys()).toHaveLength(1));
    const [key] = keys();
    expect(key).toHaveLength(4);
    expect(typeof key![2]).toBe("string");
    expect(key![3]).toBe(2);
    expect(JSON.stringify(key)).not.toContain("secret");
  });
});
