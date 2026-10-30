/**
 * Small content-type screens built on `CollectionScreen` (UI-049 services, UI-050 engagement models, UI-051
 * testimonials, UI-053 values, UI-054 process steps). Zod schemas mirror the contract input schemas.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "@/shared/zod/classic";
import { ctaTargetLabels } from "@/shared/utils/labels";
import { caseStudyApi, engagementModelApi, processStepApi, serviceApi, testimonialApi, valueApi } from "../api/admin-api";
import { adminKeys } from "../api/query";
import type {
  AdminCoreValue,
  AdminEngagementModel,
  AdminProcessStep,
  AdminService,
  AdminTestimonial,
} from "../api/types";
import { CheckboxField, RadioGroupField, SelectField, TextAreaField, TextField } from "../ui/fields";
import { requiredText, stringList } from "../ui/schema";
import { StringListField } from "../ui/StringListField";
import kit from "../ui/Kit.module.css";
import { CollectionScreen } from "./CollectionScreen";

const published = { is_published: z.boolean() };

/* ---------------------------------------------------------------- services (UI-049) */
const serviceSchema = z.object({
  name: requiredText(80, "Enter the service name."),
  description: requiredText(600, "Describe the service."),
  deliverables: stringList(30, 60, 0, "deliverable"),
  ...published,
});

export function ServicesPage() {
  return (
    <CollectionScreen<AdminService, z.input<typeof serviceSchema>, z.output<typeof serviceSchema>>
      title="Services"
      noun="service"
      queryKey={adminKeys.services}
      api={serviceApi}
      schema={serviceSchema}
      fieldOrder={["name", "description", "deliverables", "is_published"]}
      toValues={(s) => ({ name: s?.name ?? "", description: s?.description ?? "", deliverables: s?.deliverables ?? [], is_published: s?.is_published ?? true })}
      getTitle={(s) => s.name}
      summary={(s) => `${s.deliverables.length} ${s.deliverables.length === 1 ? "deliverable" : "deliverables"}`}
      emptyBody="Add the services you offer; they appear on the home page."
      fields={
        <>
          <TextField name="name" label="Name" required counterMax={80} />
          <TextAreaField name="description" label="Description" required counterMax={600} />
          <StringListField name="deliverables" label="Deliverables" itemLabel="Deliverable" maxItems={30} maxLength={60} />
          <CheckboxField name="is_published" label="Published" />
        </>
      }
    />
  );
}

/* ---------------------------------------------------------------- engagement models (UI-050) */
const engagementSchema = z.object({
  name: requiredText(80, "Enter the model name."),
  description: requiredText(600, "Describe this way of working."),
  features: stringList(30, 60, 0, "feature"),
  cta_label: requiredText(40, "Enter the button label."),
  cta_target: z.enum(["booking", "contact"], "Choose where the button goes."),
  ...published,
});

const CTA_OPTIONS = (["booking", "contact"] as const).map((value) => ({ value, label: ctaTargetLabels[value] }));

export function EngagementModelsPage() {
  return (
    <CollectionScreen<AdminEngagementModel, z.input<typeof engagementSchema>, z.output<typeof engagementSchema>>
      title="Engagement models"
      noun="engagement model"
      queryKey={adminKeys.engagementModels}
      api={engagementModelApi}
      schema={engagementSchema}
      fieldOrder={["name", "description", "features", "cta_label", "cta_target", "is_published"]}
      toValues={(m) => ({
        name: m?.name ?? "",
        description: m?.description ?? "",
        features: m?.features ?? [],
        cta_label: m?.cta_label ?? "Book a call",
        cta_target: m?.cta_target ?? "booking",
        is_published: m?.is_published ?? true,
      })}
      getTitle={(m) => m.name}
      summary={(m) => `Button: ${m.cta_label} → ${ctaTargetLabels[m.cta_target]}`}
      fields={
        <>
          <TextField name="name" label="Name" required counterMax={80} />
          <TextAreaField name="description" label="Description" required counterMax={600} />
          <StringListField name="features" label="Features" itemLabel="Feature" maxItems={30} maxLength={60} />
          <TextField name="cta_label" label="Button label" required counterMax={40} />
          <RadioGroupField name="cta_target" label="Button target" required options={CTA_OPTIONS} />
          <CheckboxField name="is_published" label="Published" />
        </>
      }
    />
  );
}

/* ---------------------------------------------------------------- testimonials (UI-051) */
const testimonialSchema = z.object({
  quote: requiredText(600, "Enter the quote."),
  author_name: requiredText(80, "Enter the author's name."),
  author_role: requiredText(80, "Enter the author's role."),
  company: requiredText(120, "Enter the company."),
  case_study_id: z.string().transform((v) => (v === "" ? null : v)),
  ...published,
});

/** Case-study options for the "Linked case study" select (loading / error shown inside the field). */
function CaseStudySelect() {
  const options = useQuery({ queryKey: adminKeys.caseStudies, queryFn: caseStudyApi.listAdminCaseStudies });
  const { getValues, setValue } = useFormContext();
  const loaded = options.data !== undefined;
  // The select is uncontrolled: once its options exist, re-apply the form value so the saved link shows.
  useEffect(() => {
    if (loaded) setValue("case_study_id", getValues("case_study_id"));
  }, [loaded, getValues, setValue]);
  if (options.isPending) return <SelectField name="case_study_id" label="Linked case study" options={[]} placeholder="None" hint="Loading case studies…" />;
  if (options.isError) {
    return (
      <div className={kit.field}>
        <SelectField name="case_study_id" label="Linked case study" options={[]} placeholder="None" hint="Case studies could not be loaded." />
        <button type="button" className={kit.smallButton} onClick={() => void options.refetch()}>
          Retry loading case studies
        </button>
      </div>
    );
  }
  return (
    <SelectField
      name="case_study_id"
      label="Linked case study"
      placeholder="None"
      options={options.data.map((cs) => ({ value: cs.id, label: cs.title }))}
      hint="The quote links to this case study on the site when it is published."
    />
  );
}

export function TestimonialsPage() {
  return (
    <CollectionScreen<AdminTestimonial, z.input<typeof testimonialSchema>, z.output<typeof testimonialSchema>>
      title="Testimonials"
      noun="testimonial"
      queryKey={adminKeys.testimonials}
      api={testimonialApi}
      schema={testimonialSchema}
      fieldOrder={["quote", "author_name", "author_role", "company", "case_study_id", "is_published"]}
      toValues={(t) => ({
        quote: t?.quote ?? "",
        author_name: t?.author_name ?? "",
        author_role: t?.author_role ?? "",
        company: t?.company ?? "",
        case_study_id: t?.case_study_id ?? "",
        is_published: t?.is_published ?? true,
      })}
      getTitle={(t) => t.author_name}
      summary={(t) => (
        <>
          {t.company} — “{t.quote.length > 90 ? `${t.quote.slice(0, 90)}…` : t.quote}”
        </>
      )}
      fields={
        <>
          <TextAreaField name="quote" label="Quote" required counterMax={600} />
          <div className={kit.grid2}>
            <TextField name="author_name" label="Author name" required counterMax={80} />
            <TextField name="author_role" label="Author role" required counterMax={80} />
          </div>
          <TextField name="company" label="Company" required counterMax={120} />
          <CaseStudySelect />
          <CheckboxField name="is_published" label="Published" />
        </>
      }
    />
  );
}

/* ---------------------------------------------------------------- values + process steps (UI-053, UI-054) */
const titleBodySchema = z.object({
  title: requiredText(80, "Enter a title."),
  body: requiredText(600, "Write a short description."),
  ...published,
});

const titleBodyFields = (
  <>
    <TextField name="title" label="Title" required counterMax={80} />
    <TextAreaField name="body" label="Description" required counterMax={600} />
    <CheckboxField name="is_published" label="Published" />
  </>
);

type TitleBody = { title: string; body: string; is_published: boolean };
const titleBodyValues = (item?: TitleBody) => ({ title: item?.title ?? "", body: item?.body ?? "", is_published: item?.is_published ?? true });

export function ValuesPage() {
  return (
    <CollectionScreen<AdminCoreValue, z.input<typeof titleBodySchema>, z.output<typeof titleBodySchema>>
      title="Values"
      noun="value"
      queryKey={adminKeys.values}
      api={valueApi}
      schema={titleBodySchema}
      fieldOrder={["title", "body", "is_published"]}
      toValues={titleBodyValues}
      getTitle={(v) => v.title}
      intro="Shown on the About page in this order."
      fields={titleBodyFields}
    />
  );
}

export function ProcessStepsPage() {
  return (
    <CollectionScreen<AdminProcessStep, z.input<typeof titleBodySchema>, z.output<typeof titleBodySchema>>
      title="Process steps"
      noun="process step"
      queryKey={adminKeys.processSteps}
      api={processStepApi}
      schema={titleBodySchema}
      fieldOrder={["title", "body", "is_published"]}
      toValues={titleBodyValues}
      getTitle={(s) => s.title}
      intro="The site shows these as a staircase in this order."
      fields={titleBodyFields}
    />
  );
}
