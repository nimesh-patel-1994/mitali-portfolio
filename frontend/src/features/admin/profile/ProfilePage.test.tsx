import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { apiError, db, requestsTo } from "@/test/admin-handlers";
import { findInRegion, renderAdminPage, setupAdminServer } from "@/test/admin-render";
import { ALT_REQUIRED } from "../ui/schema";

const server = setupAdminServer();

async function openForm() {
  const rendered = await renderAdminPage("/admin/profile", "Profile");
  await screen.findByRole("form", { name: "Profile" });
  return rendered;
}

describe("UI-T-099 profile", () => {
  it("cannot remove the last bio paragraph or add a 7th", async () => {
    db.profile = { ...db.profile, bio: ["Only paragraph."] };
    const { user } = await openForm();
    const bio = screen.getByRole("group", { name: /^Bio paragraphs/ });
    expect(within(bio).getByRole("button", { name: "Remove Paragraph 1" })).toBeDisabled();
    expect(within(bio).getByText("Keep at least 1 paragraph.")).toBeInTheDocument();
    for (let i = 0; i < 5; i += 1) await user.click(within(bio).getByRole("button", { name: "Add paragraph" }));
    expect(within(bio).getAllByRole("textbox")).toHaveLength(6);
    expect(within(bio).getByRole("button", { name: "Add paragraph" })).toBeDisabled();
    expect(within(bio).getByText("You can add up to 6 paragraphs.")).toBeInTheDocument();
  });

  it("skills limited to 30", async () => {
    db.profile = { ...db.profile, skills: Array.from({ length: 30 }, (_, i) => `Skill ${i + 1}`) };
    await openForm();
    const skills = screen.getByRole("group", { name: "Skills" });
    expect(within(skills).getByRole("button", { name: "Add skill" })).toBeDisabled();
    expect(within(skills).getByText("You can add up to 30 skills.")).toBeInTheDocument();
  });

  it("portrait without alt → alt error; with alt → PUT with exactly 2 vision blocks", async () => {
    const { user } = await openForm();
    await user.click(screen.getByRole("button", { name: "Choose image" }));
    const dialog = screen.getByRole("dialog", { name: "Choose image" });
    await user.click(within(dialog).getByRole("tab", { name: "Library" }));
    await user.click(await within(dialog).findByRole("button", { name: "Choose asset-6.png, 1600 × 900" }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByLabelText(/^Alt text/)).toHaveAccessibleDescription(new RegExp(ALT_REQUIRED.replace(".", "\\.")));
    expect(requestsTo("PUT", "/api/admin/profile")).toHaveLength(0);

    await user.type(screen.getByLabelText(/^Alt text/), "Mitali at her desk");
    await user.clear(screen.getByLabelText(/^Vision block 1 heading/));
    await user.type(screen.getByLabelText(/^Vision block 1 heading/), "Clarity first");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await findInRegion("Profile saved.", "status");
    const body = requestsTo("PUT", "/api/admin/profile")[0]!.body as Record<string, unknown>;
    expect(body.vision_blocks).toEqual([
      { heading: "Clarity first", body: "Clear words." },
      { heading: "Craft", body: "Careful edits." },
    ]);
    expect(body).toMatchObject({ portrait_alt: "Mitali at her desk", years_experience: 8, bio: ["First paragraph.", "Second paragraph."] });
  });

  it("load error → Retry", async () => {
    let fail = true;
    server.use(http.get("*/api/admin/profile", () => (fail ? apiError(404, "not_found", "Gone") : HttpResponse.json(db.profile))));
    const { user } = await renderAdminPage("/admin/profile", "Profile");
    const retry = await screen.findByRole("button", { name: "Retry" });
    fail = false;
    await user.click(retry);
    await waitFor(() => expect(screen.getByLabelText(/^Headline/)).toHaveValue(db.profile.headline));
  });
});
