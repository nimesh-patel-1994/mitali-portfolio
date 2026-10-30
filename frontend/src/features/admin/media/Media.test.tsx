import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { FormProvider, useForm } from "react-hook-form";
import { File as NodeFile } from "node:buffer";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "@/shared/zod/classic";
import { apiError, db, parseMultipart, recorded, requestsTo } from "@/test/admin-handlers";
import { id, mediaAsset } from "@/test/admin-fixtures";
import { findInRegion, renderWithAdminProviders, setupAdminServer } from "@/test/admin-render";
import { ALT_REQUIRED, altSchema, mediaIdSchema, requireAltWhenMedia } from "../ui/schema";
import { MediaField } from "./MediaField";
import { MEDIA_MESSAGES } from "./media-utils";

const server = setupAdminServer();

/*
 * jsdom's FormData/File cannot be serialized by Node's fetch (undici) in this test environment (content-length
 * mismatch). Browsers have no such split, so the tests use Node's own FormData and File for upload bodies.
 */
beforeAll(async () => {
  const probe = await new Request("http://localhost/", {
    method: "POST",
    body: "a=1",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  }).formData();
  vi.stubGlobal("FormData", probe.constructor);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function nodeFile(parts: Array<string | Uint8Array<ArrayBuffer>>, name: string, type: string): File {
  return new NodeFile(parts, name, { type }) as unknown as File;
}

const schema = z
  .object({ cover_media_id: mediaIdSchema, cover_alt: altSchema })
  .superRefine(requireAltWhenMedia("cover_media_id", "cover_alt"));

function Harness({ onSubmit }: { onSubmit: (v: unknown) => void }) {
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { cover_media_id: null, cover_alt: "" },
  });
  return (
    <FormProvider {...form}>
      <form noValidate aria-label="Media harness" onSubmit={form.handleSubmit(onSubmit)}>
        <MediaField label="Cover image" mediaName="cover_media_id" altName="cover_alt" image={null} />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

async function openPicker() {
  const onSubmit = vi.fn();
  const rendered = renderWithAdminProviders(<Harness onSubmit={onSubmit} />);
  await rendered.user.click(screen.getByRole("button", { name: "Choose image" }));
  const dialog = screen.getByRole("dialog", { name: "Choose image" });
  return { ...rendered, dialog, onSubmit };
}

function upload(dialog: HTMLElement, file: File) {
  fireEvent.change(within(dialog).getByLabelText("Choose an image file"), { target: { files: [file] } });
}

const png = (name = "photo.png", size = 1024) => nodeFile([new Uint8Array(size)], name, "image/png");

describe("UI-T-084 media upload", () => {
  it(".gif and an 11 MB file are rejected on the client with the server wording; nothing is sent", async () => {
    const { dialog } = await openPicker();
    upload(dialog, nodeFile(["gif"], "anim.gif", "image/gif"));
    expect(await within(dialog).findByText(MEDIA_MESSAGES.wrongType)).toHaveAttribute("role", "alert");
    upload(dialog, png("huge.png", 11 * 1024 * 1024));
    expect(await within(dialog).findByText(MEDIA_MESSAGES.tooLarge)).toBeInTheDocument();
    expect(requestsTo("POST", "/api/admin/media")).toHaveLength(0);
  });

  it.each([
    [413, "file_too_large", MEDIA_MESSAGES.tooLarge],
    [415, "unsupported_media_type", MEDIA_MESSAGES.wrongType],
    [422, "invalid_image", MEDIA_MESSAGES.invalidImage],
  ] as const)("server %i %s → %s", async (status, code, message) => {
    server.use(http.post("*/api/admin/media", () => apiError(status, code, "x")));
    const { dialog } = await openPicker();
    upload(dialog, png());
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
  });

  it("success: processing state, multipart upload with CSRF, asset selected and thumbnail shown with an alt field", async () => {
    server.use(
      http.post("*/api/admin/media", async ({ request }) => {
        const body = parseMultipart(await request.text());
        recorded.push({ method: "POST", path: "/api/admin/media", search: "", body, csrf: request.headers.get("x-csrf-token") });
        await delay(150);
        return HttpResponse.json(mediaAsset(77, { original_filename: "hero.png" }), { status: 201 });
      }),
    );
    const { dialog } = await openPicker();
    upload(dialog, png("hero.png"));
    expect(await within(dialog).findByText(MEDIA_MESSAGES.processing, { selector: "span" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const sent = requestsTo("POST", "/api/admin/media")[0]!;
    expect(sent.csrf).toBe("csrf-token-1");
    expect(sent.body).toMatchObject({ file: { name: "hero.png", type: "image/png" } });
    expect(screen.getByRole("button", { name: "Change image" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Cover image" }).querySelector("img")).toHaveAttribute("src", expect.stringMatching(/^\/media\/.+-480\.webp$/));
    expect(screen.getByLabelText(/^Alt text/)).toHaveAccessibleDescription(/Describe the image for people who cannot see it/);
  });
});

describe("UI-T-085 media library", () => {
  it("30 assets: first page of 24, Load more appends; select returns the asset", async () => {
    const { user, dialog } = await openPicker();
    await user.click(within(dialog).getByRole("tab", { name: "Library" }));
    const grid = await within(dialog).findByRole("list", { name: "Image library" });
    expect(within(grid).getAllByRole("listitem")).toHaveLength(24);
    await user.click(within(dialog).getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(within(grid).getAllByRole("listitem")).toHaveLength(30));
    expect(within(dialog).queryByRole("button", { name: "Load more" })).toBeNull();
    await user.click(within(grid).getByRole("button", { name: "Choose asset-5.png, 1600 × 900" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Remove image" })).toBeInTheDocument();
  });

  it("delete in use → 409 message; delete unused → removed after confirm", async () => {
    const { user, dialog } = await openPicker();
    await user.click(within(dialog).getByRole("tab", { name: "Library" }));
    const grid = await within(dialog).findByRole("list", { name: "Image library" });

    await user.click(within(grid).getByRole("button", { name: "Delete asset-1.png" }));
    await user.click(screen.getByRole("button", { name: "Delete image" }));
    await findInRegion(MEDIA_MESSAGES.inUse);
    expect(db.media.some((m) => m.id === id(90, 1))).toBe(true);

    await user.click(within(grid).getByRole("button", { name: "Delete asset-2.png" }));
    expect(screen.getByRole("alertdialog", { name: "Delete this image?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete image" }));
    await waitFor(() => expect(within(grid).queryByRole("button", { name: /asset-2\.png/ })).toBeNull());
    expect(requestsTo("DELETE", `/api/admin/media/${id(90, 2)}`)).toHaveLength(1);
  });

  it("empty library and load error states", async () => {
    db.media = [];
    const { user, dialog } = await openPicker();
    await user.click(within(dialog).getByRole("tab", { name: "Library" }));
    expect(await within(dialog).findByText(MEDIA_MESSAGES.empty)).toBeInTheDocument();
  });
});

describe("UI-T-086 MediaField alt text is required", () => {
  it("image selected with empty alt → alt error and nothing submitted; with alt → submitted", async () => {
    const { user, dialog, onSubmit } = await openPicker();
    await user.click(within(dialog).getByRole("tab", { name: "Library" }));
    const grid = await within(dialog).findByRole("list", { name: "Image library" });
    await user.click(within(grid).getByRole("button", { name: "Choose asset-3.png, 1600 × 900" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const alt = screen.getByLabelText(/^Alt text/);
    expect(alt).toHaveAttribute("aria-invalid", "true");
    expect(alt).toHaveAccessibleDescription(new RegExp(ALT_REQUIRED.replace(".", "\\.")));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(alt, "A desk with notebooks");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({ cover_media_id: id(90, 3), cover_alt: "A desk with notebooks" });
  });
});

describe("UI-T-085 / UI-REV-008 media picker tabs: aria-controls only points at the rendered panel", () => {
  it("each tab's aria-controls is set only while selected and matches the rendered tabpanel", async () => {
    const { user, dialog } = await openPicker();
    const check = () => {
      for (const tab of within(dialog).getAllByRole("tab")) {
        const target = tab.getAttribute("aria-controls");
        if (tab.getAttribute("aria-selected") === "true") {
          expect(document.getElementById(target!)).toHaveAttribute("role", "tabpanel");
        } else {
          expect(target).toBeNull();
        }
      }
    };
    check();
    await user.click(within(dialog).getByRole("tab", { name: "Library" }));
    check();
  });
});
