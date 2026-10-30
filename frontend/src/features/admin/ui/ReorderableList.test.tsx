import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiError, db, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderAdminPage, setupAdminServer } from "@/test/admin-render";
import { moveItem, movedMessage } from "./ReorderableList";

const server = setupAdminServer();

const list = () => screen.getByRole("list", { name: "Case studies in display order" });
const titles = () => within(list()).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);

describe("UI-T-079 ReorderableList: keyboard move", () => {
  it("move item 2 down: order updated, full id list sent, announcement, focus kept; first 'Move up' disabled", async () => {
    const { user } = await renderAdminPage("/admin/case-studies", "Case studies");
    await screen.findByRole("list", { name: "Case studies in display order" });
    const [first, second, third] = db.caseStudies;
    expect(within(list()).getByRole("button", { name: `Move ${first!.title} up` })).toBeDisabled();
    const last = db.caseStudies[db.caseStudies.length - 1]!;
    expect(within(list()).getByRole("button", { name: `Move ${last.title} down` })).toBeDisabled();

    const down = within(list()).getByRole("button", { name: `Move ${second!.title} down` });
    await user.click(down);
    expect(titles().slice(0, 3)).toEqual([first!.title, third!.title, second!.title]);
    expect(screen.getByText(movedMessage(second!.title, 3, 6))).toHaveAttribute("role", "status");
    await waitFor(() => expect(requestsTo("PUT", "/api/admin/case-studies/order")).toHaveLength(1));
    const sent = requestsTo("PUT", "/api/admin/case-studies/order")[0]!.body as { ids: string[] };
    expect(sent.ids).toHaveLength(6);
    expect(sent.ids).toEqual([first!.id, third!.id, second!.id, ...db.caseStudies.slice(3).map((c) => c.id)]);
    await waitFor(() => expect(document.activeElement).toHaveAccessibleName(`Move ${second!.title} down`));
  });

  it("moves made while saving are queued and sent in order", async () => {
    server.use(
      http.put("*/api/admin/case-studies/order", async () => {
        await delay(100);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = await renderAdminPage("/admin/case-studies", "Case studies");
    await screen.findByRole("list", { name: "Case studies in display order" });
    const [a, b] = db.caseStudies;
    await user.click(within(list()).getByRole("button", { name: `Move ${a!.title} down` }));
    expect(screen.getByText(/Saving order/)).toBeInTheDocument();
    await user.click(within(list()).getByRole("button", { name: `Move ${a!.title} down` }));
    expect(titles().slice(0, 3)).toEqual([b!.title, db.caseStudies[2]!.title, a!.title]);
    await waitFor(() => expect(screen.queryByText(/Saving order/)).toBeNull());
  });

  it("moveItem helper", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
});

describe("UI-T-080 ReorderableList: failures", () => {
  it("500 → rollback + error toast", async () => {
    server.use(http.put("*/api/admin/case-studies/order", () => apiError(500, "internal_error", "Boom")));
    const { user } = await renderAdminPage("/admin/case-studies", "Case studies");
    await screen.findByRole("list", { name: "Case studies in display order" });
    const original = titles();
    await user.click(within(list()).getByRole("button", { name: `Move ${db.caseStudies[0]!.title} down` }));
    await findInRegion("The new order could not be saved. The previous order has been restored.");
    await waitFor(() => expect(titles()).toEqual(original));
  });

  it("422 order_mismatch → refetch + 'The list changed elsewhere and has been reloaded.'", async () => {
    server.use(http.put("*/api/admin/case-studies/order", () => apiError(422, "order_mismatch", "Mismatch")));
    const { user } = await renderAdminPage("/admin/case-studies", "Case studies");
    await screen.findByRole("list", { name: "Case studies in display order" });
    const before = requestsTo("GET", "/api/admin/case-studies").length;
    await user.click(within(list()).getByRole("button", { name: `Move ${db.caseStudies[0]!.title} down` }));
    await findInRegion("The list changed elsewhere and has been reloaded.");
    await waitFor(() => expect(requestsTo("GET", "/api/admin/case-studies").length).toBeGreaterThan(before));
  });
});

describe("UI-T-079 / UI-REV-016 ReorderableList: optimistic order vs an in-flight refetch", () => {
  it("cancels a pending list fetch before the optimistic write, so its late response cannot restore the old order", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    let puts = 0;
    server.use(
      // The order PUT succeeds without touching the store, so a late GET would still return the old order.
      http.put("*/api/admin/case-studies/order", () => {
        puts += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, queryClient } = await renderAdminPage("/admin/case-studies", "Case studies");
    await screen.findByRole("list", { name: "Case studies in display order" });
    server.use(
      http.get("*/api/admin/case-studies", async () => {
        if (held) return undefined;
        held = true;
        await gate;
        return undefined; // falls through to the contract handler (old order)
      }),
    );
    const [a, b] = db.caseStudies;
    void queryClient.invalidateQueries({ queryKey: ["admin", "case-studies"], exact: true });
    await waitFor(() => expect(queryClient.isFetching({ queryKey: ["admin", "case-studies"], exact: true })).toBe(1));

    await user.click(within(list()).getByRole("button", { name: `Move ${a!.title} down` }));
    await waitFor(() => expect(titles().slice(0, 2)).toEqual([b!.title, a!.title]));
    expect(queryClient.isFetching({ queryKey: ["admin", "case-studies"], exact: true })).toBe(0);
    await waitFor(() => expect(puts).toBe(1));

    release();
    await new Promise((r) => setTimeout(r, 50));
    expect(titles().slice(0, 2)).toEqual([b!.title, a!.title]);
  });
});
