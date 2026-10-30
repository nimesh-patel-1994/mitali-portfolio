/**
 * Writing-sample editor `/admin/writing/new`, `/:id` (UI-048, REQ-064, REQ-067, REQ-031). Form = `WritingSampleInput`:
 * title, slug, format (6 options), client name and industry (optional), excerpt (counter 600), body (Markdown),
 * published on (date), tags, thumbnail + alt, Featured / Published / Sample data. Read-only word count and reading
 * time come from the last saved response.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "@/shared/zod/classic";
import { Button } from "@/shared/ui/Button/Button";
import { writingFormatLabels, writingFormats } from "@/shared/utils/labels";
import { writingApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type { AdminWritingSample } from "../api/types";
import { MarkdownField } from "../markdown/MarkdownField";
import { MediaField } from "../media/MediaField";
import { CheckboxField, FormAlert, SelectField, TextAreaField, TextField } from "../ui/fields";
import { altSchema, mediaIdSchema, optionalText, requireAltWhenMedia, requiredText, slugSchema, stringList } from "../ui/schema";
import { useServerErrors } from "../ui/server-errors";
import { SlugField } from "../ui/SlugField";
import { AdminPage, ErrorState, isNotFound, LoadingState, NotFoundState } from "../ui/states";
import { StringListField } from "../ui/StringListField";
import { useToast } from "../ui/Toast";
import { useUnsavedChangesGuard } from "../ui/UnsavedChangesGuard";
import kit from "../ui/Kit.module.css";

export const writingSchema = z
  .object({
    title: requiredText(120, "Enter a title."),
    slug: slugSchema,
    format: z.enum(writingFormats as [string, ...string[]], "Choose a format.").transform((v) => v as AdminWritingSample["format"]),
    client_name: optionalText(120),
    industry: optionalText(80),
    excerpt: requiredText(600, "Write a short excerpt."),
    body_md: requiredText(100_000, "Write the body text."),
    published_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the publication date."),
    tags: stringList(30, 60, 0, "tag"),
    thumbnail_media_id: mediaIdSchema,
    thumbnail_alt: altSchema,
    is_featured: z.boolean(),
    is_published: z.boolean(),
    is_sample: z.boolean(),
  })
  .superRefine(requireAltWhenMedia("thumbnail_media_id", "thumbnail_alt"));

type Values = z.input<typeof writingSchema>;
type Output = z.output<typeof writingSchema>;

const FIELDS = [
  "title",
  "slug",
  "format",
  "client_name",
  "industry",
  "excerpt",
  "body_md",
  "published_on",
  "tags",
  "thumbnail_media_id",
  "thumbnail_alt",
  "is_featured",
  "is_published",
  "is_sample",
] as const;

const FORMAT_OPTIONS = writingFormats.map((value) => ({ value, label: writingFormatLabels[value] }));

function formValues(ws?: AdminWritingSample): Values {
  return {
    title: ws?.title ?? "",
    slug: ws?.slug ?? "",
    format: ws?.format ?? "",
    client_name: ws?.client_name ?? "",
    industry: ws?.industry ?? "",
    excerpt: ws?.excerpt ?? "",
    body_md: ws?.body_md ?? "",
    published_on: ws?.published_on ?? "",
    tags: ws?.tags ?? [],
    thumbnail_media_id: ws?.thumbnail_media_id ?? null,
    thumbnail_alt: ws?.thumbnail_alt ?? "",
    is_featured: ws?.is_featured ?? false,
    is_published: ws?.is_published ?? false,
    is_sample: ws?.is_sample ?? false,
  };
}

function WritingForm({ sample }: { sample?: AdminWritingSample }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = sample === undefined;
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(writingSchema), defaultValues: formValues(sample) });
  const serverErrors = useServerErrors(form, FIELDS);
  const guard = useUnsavedChangesGuard(form.formState.isDirty);

  const save = useMutation({
    mutationFn: (body: Output) => (sample ? writingApi.updateAdminWritingSample(sample.id, body) : writingApi.createAdminWritingSample(body)),
    onSuccess: (saved) => {
      queryClient.setQueryData(adminKeys.writingSample(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: adminKeys.writingSamples });
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard });
      form.reset(formValues(saved));
      toast.success(isNew ? `Created “${saved.title}”.` : "Changes saved.");
      if (isNew) {
        guard.bypass();
        navigate(`/admin/writing/${saved.id}`, { replace: true });
      }
    },
    onError: (error) => serverErrors.handle(error),
  });

  return (
    <FormProvider {...form}>
      <form
        className={kit.form}
        noValidate
        aria-label="Writing sample"
        onSubmit={form.handleSubmit((values) => {
          serverErrors.clear();
          save.mutate(values);
        })}
      >
        <FormAlert message={serverErrors.formError} />
        <TextField name="title" label="Title" required counterMax={120} />
        <SlugField follow={isNew} publicPrefix="/writing/" />
        <div className={kit.grid2}>
          <SelectField name="format" label="Format" required options={FORMAT_OPTIONS} placeholder="Choose a format…" />
          <TextField name="published_on" label="Published on" type="date" required />
          <TextField name="client_name" label="Client name" counterMax={120} />
          <TextField name="industry" label="Client industry" counterMax={80} />
        </div>
        <TextAreaField name="excerpt" label="Excerpt" required counterMax={600} />
        <MarkdownField name="body_md" label="Body" required maxLength={100_000} />
        {sample && (
          <p className={kit.muted}>
            Last saved: {sample.word_count.toLocaleString("en")} words, {sample.reading_time_min} min read.
          </p>
        )}
        <StringListField name="tags" label="Tags" itemLabel="Tag" maxItems={30} maxLength={60} />
        <MediaField label="Thumbnail" mediaName="thumbnail_media_id" altName="thumbnail_alt" image={sample?.thumbnail} />
        <fieldset className={kit.fieldset}>
          <legend className={kit.legend}>Visibility</legend>
          <div className={kit.checks}>
            <CheckboxField name="is_published" label="Published" />
            <CheckboxField name="is_featured" label="Featured" />
            <CheckboxField name="is_sample" label="Sample data" />
          </div>
        </fieldset>
        <div className={kit.formFooter}>
          <Button type="submit" loading={save.isPending}>
            {isNew ? "Create writing sample" : "Save"}
          </Button>
          <p className={kit.muted}>Visible on the site after the next rebuild.</p>
        </div>
      </form>
      {guard.element}
    </FormProvider>
  );
}

export function WritingEditorPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const query = useQuery({
    queryKey: adminKeys.writingSample(id ?? "new"),
    queryFn: () => writingApi.getAdminWritingSample(id!),
    enabled: !isNew,
  });
  const back = (
    <Link to="/admin/writing" className={kit.link}>
      Back to writing samples
    </Link>
  );
  const title = isNew ? "New writing sample" : "Edit writing sample";

  if (!isNew && query.isPending) {
    return (
      <AdminPage title={title} actions={back}>
        <LoadingState />
      </AdminPage>
    );
  }
  if (!isNew && query.isError) {
    return (
      <AdminPage title={title} actions={back}>
        {isNotFound(query.error) ? (
          <NotFoundState backTo="/admin/writing" backLabel="Back to writing samples" />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </AdminPage>
    );
  }
  const sample = isNew ? undefined : query.data;
  return (
    <AdminPage title={title} heading={sample?.title ?? title} actions={back}>
      <WritingForm key={sample?.id ?? "new"} sample={sample} />
    </AdminPage>
  );
}
