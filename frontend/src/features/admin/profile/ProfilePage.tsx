/**
 * Profile `/admin/profile` (UI-055, REQ-065, REQ-014, REQ-040). Fields: name, headline (≤ 160), bio paragraphs
 * (1..6, each ≤ 1200; cannot remove the last, cannot add a seventh), skills and tools (≤ 30 items, ≤ 60 chars),
 * years of experience (0..60 or empty), origin statement (≤ 600), exactly two vision blocks (fixed), portrait + alt.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "@/shared/zod/classic";
import { Button } from "@/shared/ui/Button/Button";
import { siteApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminProfile } from "../api/types";
import { MediaField } from "../media/MediaField";
import { FormAlert, TextAreaField, TextField } from "../ui/fields";
import { altSchema, mediaIdSchema, requireAltWhenMedia, requiredText, stringList } from "../ui/schema";
import { useServerErrors } from "../ui/server-errors";
import { AdminPage, ErrorState, LoadingState } from "../ui/states";
import { StringListField } from "../ui/StringListField";
import { useToast } from "../ui/Toast";
import { useUnsavedChangesGuard } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";

const visionBlock = z.object({
  heading: requiredText(80, "Enter a heading."),
  body: requiredText(600, "Write the text for this block."),
});

export const profileSchema = z
  .object({
    name: requiredText(80, "Enter your name."),
    headline: requiredText(160, "Enter a headline."),
    bio: stringList(6, 1200, 1, "paragraph"),
    skills: stringList(30, 60, 0, "skill"),
    tools: stringList(30, 60, 0, "tool"),
    years_experience: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{1,2}$/.test(v), "Enter a whole number from 0 to 60, or leave it empty.")
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (v >= 0 && v <= 60), "Enter a whole number from 0 to 60, or leave it empty."),
    origin_statement: requiredText(600, "Write the origin statement."),
    vision_blocks: z.tuple([visionBlock, visionBlock]),
    portrait_media_id: mediaIdSchema,
    portrait_alt: altSchema,
  })
  .superRefine(requireAltWhenMedia("portrait_media_id", "portrait_alt"));

type Values = z.input<typeof profileSchema>;
type Output = z.output<typeof profileSchema>;

const FIELDS = [
  "name",
  "headline",
  "bio",
  "skills",
  "tools",
  "years_experience",
  "origin_statement",
  "vision_blocks",
  "portrait_media_id",
  "portrait_alt",
] as const;

function formValues(p: AdminProfile): Values {
  const [first, second] = p.vision_blocks;
  return {
    name: p.name,
    headline: p.headline,
    bio: p.bio.length > 0 ? p.bio : [""],
    skills: p.skills,
    tools: p.tools,
    years_experience: p.years_experience === null ? "" : String(p.years_experience),
    origin_statement: p.origin_statement,
    vision_blocks: [first ?? { heading: "", body: "" }, second ?? { heading: "", body: "" }],
    portrait_media_id: p.portrait_media_id,
    portrait_alt: p.portrait_alt ?? "",
  };
}

function ProfileForm({ profile }: { profile: AdminProfile }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(profileSchema), defaultValues: formValues(profile) });
  const serverErrors = useServerErrors(form, FIELDS);
  const guard = useUnsavedChangesGuard(form.formState.isDirty);
  const save = useMutation({
    mutationFn: (body: Output) => siteApi.updateAdminProfile(body),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.profile, saved);
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      form.reset(formValues(saved));
      toast.success("Profile saved.");
    },
    onError: (error) => serverErrors.handle(error),
  });

  return (
    <FormProvider {...form}>
      <form
        className={kit.form}
        noValidate
        aria-label="Profile"
        onSubmit={form.handleSubmit((values) => {
          serverErrors.clear();
          save.mutate(values);
        })}
      >
        <FormAlert message={serverErrors.formError} />
        <div className={kit.grid2}>
          <TextField name="name" label="Name" required counterMax={80} />
          <TextField name="years_experience" label="Years of experience" inputMode="numeric" hint="0 to 60, or leave empty" />
        </div>
        <TextField name="headline" label="Headline" required counterMax={160} />
        <StringListField name="bio" label="Bio paragraphs" itemLabel="Paragraph" multiline required minItems={1} maxItems={6} maxLength={1200} />
        <div className={kit.grid2}>
          <StringListField name="skills" label="Skills" itemLabel="Skill" maxItems={30} maxLength={60} />
          <StringListField name="tools" label="Tools" itemLabel="Tool" maxItems={30} maxLength={60} />
        </div>
        <TextAreaField name="origin_statement" label="Origin statement" required counterMax={600} />
        <fieldset className={kit.fieldset}>
          <legend className={kit.legend}>Vision blocks (two, shown side by side on the About page)</legend>
          {[0, 1].map((index) => (
            <div key={index} className={kit.panel}>
              <TextField name={`vision_blocks.${index}.heading`} label={`Vision block ${index + 1} heading`} required counterMax={80} />
              <TextAreaField name={`vision_blocks.${index}.body`} label={`Vision block ${index + 1} text`} required counterMax={600} />
            </div>
          ))}
        </fieldset>
        <MediaField label="Portrait" mediaName="portrait_media_id" altName="portrait_alt" image={profile.portrait} />
        <div className={kit.formFooter}>
          <Button type="submit" loading={save.isPending}>
            Save profile
          </Button>
          <p className={kit.muted}>Visible on the site after the next rebuild.</p>
        </div>
      </form>
      {guard.element}
    </FormProvider>
  );
}

export function ProfilePage() {
  const query = useQuery({ queryKey: adminKeys.profile, queryFn: siteApi.getAdminProfile });
  return (
    <AdminPage title="Profile">
      {query.isPending && <LoadingState />}
      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && <ProfileForm key={query.data.updated_at} profile={query.data} />}
    </AdminPage>
  );
}
