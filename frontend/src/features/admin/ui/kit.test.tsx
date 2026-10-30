import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Link } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { z } from "@/shared/zod/classic";
import { renderWithAdminProviders } from "@/test/admin-render";
import { ApiError } from "../api/errors";
import { ConfirmDialog } from "./Dialog";
import { FormAlert, TextField } from "./fields";
import { FORM_ERROR_FALLBACK, useServerErrors } from "./server-errors";
import { SlugField, slugify } from "./SlugField";
import { StringListField } from "./StringListField";
import { useUnsavedChangesGuard } from "./UnsavedChangesGuard";

const schema = z.object({
  title: z.string().min(1, "Enter a title."),
  slug: z.string(),
  results: z.array(z.object({ value: z.string() })),
  tags: z.array(z.string().trim().min(1, "Fill in or remove this tag.")).max(3, "Too many."),
});
type Values = z.input<typeof schema>;
const FIELDS = ["title", "slug", "results", "tags"] as const;

function Harness({ error }: { error: unknown }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "Old title", slug: "old-title", results: [{ value: "10%" }], tags: ["a"] },
  });
  const server = useServerErrors(form, FIELDS);
  const guard = useUnsavedChangesGuard(form.formState.isDirty);
  return (
    <FormProvider {...form}>
      <form noValidate aria-label="Harness" onSubmit={form.handleSubmit(() => server.handle(error))}>
        <FormAlert message={server.formError} />
        <TextField name="title" label="Title" required counterMax={120} hint="A hint" />
        <SlugField follow={false} publicPrefix="/work/" />
        <TextField name="results.0.value" label="Result value" />
        <StringListField name="tags" label="Tags" itemLabel="Tag" maxItems={3} maxLength={60} />
        <button type="submit">Save</button>
      </form>
      <Link to="/elsewhere">Leave</Link>
      {guard.element}
    </FormProvider>
  );
}

describe("UI-T-081 form kit", () => {
  it("422 fields with dotted paths → field errors (aria-invalid + described), focus on the first in form order", async () => {
    const error = new ApiError(422, "validation_error", "Invalid", { "results.0.value": "Too long.", title: "Title taken." });
    const { user } = renderWithAdminProviders(<Harness error={error} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const title = screen.getByLabelText(/^Title/);
    await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"));
    expect(title).toHaveAccessibleDescription(/A hint.*9 of 120 characters.*Title taken\./);
    expect(screen.getByLabelText("Result value")).toHaveAccessibleDescription("Too long.");
    expect(document.activeElement).toBe(title);
  });

  it("409 slug_taken → error on the slug field with focus", async () => {
    const error = new ApiError(409, "slug_taken", "Slug taken", { slug: "This slug is already used." });
    const { user } = renderWithAdminProviders(<Harness error={error} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const slug = screen.getByLabelText(/^Slug/);
    await waitFor(() => expect(slug).toHaveAccessibleDescription(/This slug is already used\./));
    expect(document.activeElement).toBe(slug);
  });

  it("unknown code / unknown fields → form-level alert", async () => {
    const { user } = renderWithAdminProviders(<Harness error={new ApiError(422, "validation_error", "x", { nope: "?" })} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(FORM_ERROR_FALLBACK)).toHaveAttribute("role", "alert");
  });

  it("dirty form navigation asks for confirmation; Stay keeps the page, Leave proceeds", async () => {
    const { user, router } = renderWithAdminProviders(<Harness error={null} />);
    await user.type(screen.getByLabelText(/^Title/), " edited");
    await user.click(screen.getByRole("link", { name: "Leave" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    expect(router.state.location.pathname).toBe("/admin/test");
    await user.click(screen.getByRole("button", { name: "Stay on page" }));
    expect(dialog).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/admin/test");
    await user.click(screen.getByRole("link", { name: "Leave" }));
    await user.click(await screen.findByRole("button", { name: "Leave page" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
  });

  it("clean form navigates without a prompt", async () => {
    const { user, router } = renderWithAdminProviders(<Harness error={null} />);
    await user.click(screen.getByRole("link", { name: "Leave" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/elsewhere"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("StringListField: add up to the limit, blank rows rejected, reorder keeps values", async () => {
    const { user } = renderWithAdminProviders(<Harness error={null} />);
    const add = screen.getByRole("button", { name: "Add tag" });
    await user.click(add);
    await user.click(add);
    expect(add).toBeDisabled();
    expect(screen.getByText("You can add up to 3 tags.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tag 2"), "b");
    await user.click(screen.getByRole("button", { name: "Move Tag 2 up" }));
    expect(screen.getByLabelText("Tag 1")).toHaveValue("b");
    expect(screen.getByLabelText("Tag 2")).toHaveValue("a");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("Tag 3")).toHaveAccessibleDescription("Fill in or remove this tag.");
  });

  it("slugify suggests URL-safe slugs", () => {
    expect(slugify("Spring Launch Plan")).toBe("spring-launch-plan");
    expect(slugify("  Café — Brand Voice!! ")).toBe("cafe-brand-voice");
  });
});

function ConfirmHarness({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen(true)}>
        Delete thing
      </button>
      <button type="button">Other</button>
      {open && (
        <ConfirmDialog
          title="Delete this thing?"
          message="It will be gone."
          confirmLabel="Delete"
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe("UI-T-082 ConfirmDialog", () => {
  it("focus trapped; Escape cancels without calling delete; focus returns to the trigger", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Delete thing" });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "Delete this thing?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("It will be gone.");
    expect(document.activeElement).toHaveAccessibleName("Cancel");
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("Delete");
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("Cancel");
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveAccessibleName("Delete");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("Confirm calls the action once and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Delete thing" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });
});
