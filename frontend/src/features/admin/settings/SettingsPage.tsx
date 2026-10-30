/**
 * Site settings `/admin/settings` (UI-056, REQ-065, REQ-002, REQ-004, REQ-042, TS-013, CHG-005).
 * Fields: contact email; booking URL (empty, "#" or an absolute http(s) URL ≤ 500); social links (≤ 8 rows of
 * label ≤ 40 + http(s) URL); footer sign-off (≤ 120); contact promise line and footer rights line (required, trimmed,
 * 1..200, plain text, with counters); notification email (optional, stored only).
 * Invalid values → field errors and nothing sent; server 422 `fields.*` mapped onto the fields.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { z } from "@/shared/zod/classic";
import { Button } from "@/shared/ui/Button/Button";
import { siteApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminSettings } from "../api/types";
import { FormAlert, TextField } from "../ui/fields";
import { emailSchema, httpUrlSchema, isHttpUrl, requiredText, tooLong } from "../ui/schema";
import { useServerErrors } from "../ui/server-errors";
import { AdminPage, ErrorState, LoadingState } from "../ui/states";
import { useToast } from "../ui/Toast";
import { useUnsavedChangesGuard } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";

export const SOCIAL_LINKS_MAX = 8;
export const TEXT_LINE_MAX = 200;

export const settingsSchema = z.object({
  contact_email: emailSchema,
  booking_url: z
    .string()
    .trim()
    .max(500, tooLong(500))
    .refine((v) => v === "" || v === "#" || isHttpUrl(v), "Leave empty, use #, or enter a full web address starting with https:// or http://.")
    .transform((v) => (v === "" ? null : v)),
  social_links: z
    .array(z.object({ label: requiredText(40, "Enter a label."), url: httpUrlSchema }))
    .max(SOCIAL_LINKS_MAX, `Add up to ${SOCIAL_LINKS_MAX} social links.`),
  footer_signoff: requiredText(120, "Enter the footer sign-off."),
  contact_promise: requiredText(TEXT_LINE_MAX, "Enter the promise line for the Contact page."),
  footer_rights_line: requiredText(TEXT_LINE_MAX, "Enter the rights line for the footer."),
  notification_email: z
    .string()
    .trim()
    .max(254, tooLong(254))
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter an email address like name@example.com, or leave it empty.")
    .transform((v) => (v === "" ? null : v)),
});

type Values = z.input<typeof settingsSchema>;
type Output = z.output<typeof settingsSchema>;

const FIELDS = [
  "contact_email",
  "booking_url",
  "social_links",
  "footer_signoff",
  "contact_promise",
  "footer_rights_line",
  "notification_email",
] as const;

function formValues(s: AdminSettings): Values {
  return {
    contact_email: s.contact_email,
    booking_url: s.booking_url ?? "",
    social_links: s.social_links.map((l) => ({ label: l.label, url: l.url })),
    footer_signoff: s.footer_signoff,
    contact_promise: s.contact_promise,
    footer_rights_line: s.footer_rights_line,
    notification_email: s.notification_email ?? "",
  };
}

function SocialLinks() {
  const { control } = useFormContext<Values>();
  const { fields, append, remove } = useFieldArray({ control, name: "social_links" });
  const atMax = fields.length >= SOCIAL_LINKS_MAX;
  return (
    <fieldset className={kit.fieldset}>
      <legend className={kit.legend}>Social links</legend>
      {fields.length === 0 && <p className={kit.muted}>No social links. The footer hides this group.</p>}
      <ul className={kit.list}>
        {fields.map((field, index) => (
          <li key={field.id} className={kit.panel}>
            <div className={kit.grid2}>
              <TextField name={`social_links.${index}.label`} label={`Link ${index + 1} label`} required counterMax={40} />
              <TextField name={`social_links.${index}.url`} label={`Link ${index + 1} address`} required type="url" inputMode="url" />
            </div>
            <div>
              <button type="button" className={`${kit.smallButton} ${kit.dangerButton}`} onClick={() => remove(index)} aria-label={`Remove link ${index + 1}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div>
        <button type="button" className={kit.smallButton} onClick={() => append({ label: "", url: "" })} disabled={atMax}>
          Add social link
        </button>
      </div>
      {atMax && <p className={kit.hint}>You can add up to {SOCIAL_LINKS_MAX} social links.</p>}
    </fieldset>
  );
}

function SettingsForm({ settings }: { settings: AdminSettings }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(settingsSchema), defaultValues: formValues(settings) });
  const serverErrors = useServerErrors(form, FIELDS);
  const guard = useUnsavedChangesGuard(form.formState.isDirty);
  const save = useMutation({
    mutationFn: (body: Output) => siteApi.updateAdminSettings(body),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.settings, saved);
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      form.reset(formValues(saved));
      toast.success("Settings saved.");
    },
    onError: (error) => serverErrors.handle(error),
  });

  return (
    <FormProvider {...form}>
      <form
        className={kit.form}
        noValidate
        aria-label="Site settings"
        onSubmit={form.handleSubmit((values) => {
          serverErrors.clear();
          save.mutate(values);
        })}
      >
        <FormAlert message={serverErrors.formError} />
        <TextField name="contact_email" label="Contact email" type="email" required autoComplete="email" inputMode="email" />
        <TextField
          name="booking_url"
          label="Booking URL"
          type="url"
          inputMode="url"
          hint="Leave empty or use # to send visitors to the Contact page"
        />
        <SocialLinks />
        <TextField name="footer_signoff" label="Footer sign-off" required counterMax={120} />
        <TextField
          name="contact_promise"
          label="Contact promise line"
          required
          counterMax={TEXT_LINE_MAX}
          hint="Shown under the heading on the Contact page"
        />
        <TextField
          name="footer_rights_line"
          label="Footer rights line"
          required
          counterMax={TEXT_LINE_MAX}
          hint="Shown in the footer's bottom line"
        />
        <TextField
          name="notification_email"
          label="Notification email"
          type="email"
          inputMode="email"
          hint="Stored only. Email notifications are not built yet."
        />
        <div className={kit.formFooter}>
          <Button type="submit" loading={save.isPending}>
            Save settings
          </Button>
          <p className={kit.muted}>Visible on the site after the next rebuild.</p>
        </div>
      </form>
      {guard.element}
    </FormProvider>
  );
}

export function SettingsPage() {
  const query = useQuery({ queryKey: adminKeys.settings, queryFn: siteApi.getAdminSettings });
  return (
    <AdminPage title="Settings">
      {query.isPending && <LoadingState />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && <SettingsForm key={query.data.updated_at} settings={query.data} />}
    </AdminPage>
  );
}
