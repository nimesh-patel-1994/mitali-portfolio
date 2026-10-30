/**
 * Enquiry form (UI-033, REQ-042, REQ-043, TS-007, SEC-UI-007).
 * States: idle · client validation error (field errors, focus first invalid, nothing sent) · submitting (button
 * loading "Sending…", fields read-only, no double submit) · success (confirmation replaces the form and takes
 * focus; identical for honeypot hits) · server validation error (422 `fields` mapped onto fields, focus first) ·
 * rate limited (429 alert, input kept) · server/network error (alert with the contact email, input kept, retry).
 * Validation runs on submit, then on change for fields once a submit was attempted.
 * The form is `method="post"` + `noValidate`; the submit button stays disabled until hydration and a `<noscript>`
 * line offers the email address, so form data never lands in a URL. Values never go to the console.
 * React Hook Form is deliberately not used here: it must not ship in the public bundle (UI-REV-015).
 */
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { enquiryForm } from "@/features/public/content/copy";
import { useHydrated } from "@/shared/hooks/useHydrated";
import { Button } from "@/shared/ui/Button/Button";
import { budgetRangeLabels, enquiryTypeLabels } from "@/shared/utils/labels";
import { cx } from "@/shared/utils/cx";
import {
  budgetRanges,
  enquiryTypes,
  FIELD_ORDER,
  firstInvalid,
  initialValues,
  LIMITS,
  validateEnquiry,
  type EnquiryField,
  type EnquiryFormValues,
  type FieldErrors,
} from "./enquiry-schema";
import styles from "./EnquiryForm.module.css";
import { submitEnquiry, type SubmitOutcome } from "./submit-enquiry";

type Status = "idle" | "submitting" | "success";
type Banner = "rate_limited" | "error" | "invalid" | null;
type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface EnquiryFormProps {
  /** Validated contact email for the fallback line (null hides it). */
  contactEmail: string | null;
  /** Injected in tests; defaults to the generated-client call. */
  submit?: (body: Parameters<typeof submitEnquiry>[0]) => Promise<SubmitOutcome>;
}

function mapServerFields(fields: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [path, message] of Object.entries(fields)) {
    const field = path.split(".")[0];
    if (field && (FIELD_ORDER as string[]).includes(field)) {
      errors[field as EnquiryField] ??= message || enquiryForm.errors.serverField;
    }
  }
  return errors;
}

export function EnquiryForm({ contactEmail, submit = submitEnquiry }: EnquiryFormProps) {
  const baseId = useId();
  const hydrated = useHydrated();
  const [values, setValues] = useState<EnquiryFormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [banner, setBanner] = useState<Banner>(null);
  const inFlight = useRef(false);
  const fieldRefs = useRef<Partial<Record<EnquiryField, FieldElement | null>>>({});
  const successRef = useRef<HTMLHeadingElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const id = (name: string) => `${baseId}-${name}`;
  const submitting = status === "submitting";

  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  const focusField = (field: EnquiryField | undefined) => {
    if (field) fieldRefs.current[field]?.focus();
  };

  const onChange = (event: ChangeEvent<FieldElement>) => {
    const name = event.target.name as keyof EnquiryFormValues;
    const next = { ...values, [name]: event.target.value };
    setValues(next);
    if (attempted && name !== "website") {
      const result = validateEnquiry(next);
      const message = result.ok ? undefined : result.errors[name];
      setErrors((current) => ({ ...current, [name]: message }));
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    setAttempted(true);
    setBanner(null);
    const result = validateEnquiry(values);
    if (!result.ok) {
      setErrors(result.errors);
      focusField(firstInvalid(result.errors));
      return;
    }
    setErrors({});
    inFlight.current = true;
    setStatus("submitting");
    const outcome = await submit(result.data);
    inFlight.current = false;
    switch (outcome.kind) {
      case "success":
        setStatus("success");
        return;
      case "validation": {
        const mapped = mapServerFields(outcome.fields);
        setStatus("idle");
        setErrors(mapped);
        const first = firstInvalid(mapped);
        if (first) {
          focusField(first);
        } else {
          setBanner("invalid");
        }
        return;
      }
      case "rate_limited":
        setStatus("idle");
        setBanner(outcome.kind);
        return;
      default:
        setStatus("idle");
        setBanner("error");
    }
  };

  // Move focus to the alert so keyboard and screen-reader users land on the message.
  useEffect(() => {
    if (banner !== null) bannerRef.current?.focus();
  }, [banner]);

  if (status === "success") {
    return (
      <div className={styles.success} role="status">
        <h2 ref={successRef} tabIndex={-1} className={styles.successHeading}>
          {enquiryForm.successHeading}
        </h2>
        <p>{enquiryForm.successBody}</p>
      </div>
    );
  }

  const describedBy = (field: EnquiryField, ...extra: string[]) => {
    const ids = [...extra, errors[field] ? id(`${field}-error`) : null].filter(Boolean);
    return ids.length > 0 ? ids.join(" ") : undefined;
  };

  const label = (field: EnquiryField, text: string, required: boolean): ReactNode => (
    <label htmlFor={id(field)} className={styles.label}>
      {text}
      {required ? (
        <>
          <span className={styles.asterisk} aria-hidden="true">
            {" *"}
          </span>
          {" "}
          <span className="visually-hidden">{enquiryForm.required}</span>
        </>
      ) : (
        <span className={styles.optional}> {enquiryForm.optional}</span>
      )}
    </label>
  );

  const fieldError = (field: EnquiryField) =>
    errors[field] ? (
      <p id={id(`${field}-error`)} className={styles.error}>
        {errors[field]}
      </p>
    ) : null;

  const register = (field: EnquiryField) => ({
    id: id(field),
    name: field,
    value: values[field],
    onChange,
    "aria-invalid": errors[field] ? true : undefined,
    ref: (node: FieldElement | null) => {
      fieldRefs.current[field] = node;
    },
  });

  return (
    <form method="post" noValidate className={styles.form} aria-label={enquiryForm.formLabel} onSubmit={onSubmit}>
      {banner !== null && (
        <div ref={bannerRef} tabIndex={-1} role="alert" className={styles.banner}>
          {banner === "rate_limited" && <p>{enquiryForm.rateLimited}</p>}
          {banner === "invalid" && <p>{enquiryForm.invalidSummary}</p>}
          {banner === "error" && (
            <>
              <p>{enquiryForm.serverError}</p>
              {contactEmail && (
                <p>
                  {enquiryForm.serverErrorEmail} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          {label("name", enquiryForm.name, true)}
          <input
            {...register("name")}
            type="text"
            autoComplete="name"
            readOnly={submitting}
            aria-required="true"
            aria-describedby={describedBy("name")}
            className={styles.input}
          />
          {fieldError("name")}
        </div>
        <div className={styles.field}>
          {label("email", enquiryForm.email, true)}
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            readOnly={submitting}
            aria-required="true"
            aria-describedby={describedBy("email")}
            className={styles.input}
          />
          {fieldError("email")}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          {label("enquiry_type", enquiryForm.enquiryType, true)}
          <select
            {...register("enquiry_type")}
            disabled={submitting}
            required
            aria-required="true"
            aria-describedby={describedBy("enquiry_type")}
            className={cx(styles.input, styles.select)}
          >
            <option value="">{enquiryForm.enquiryTypePlaceholder}</option>
            {enquiryTypes.map((value) => (
              <option key={value} value={value}>
                {enquiryTypeLabels[value]}
              </option>
            ))}
          </select>
          {fieldError("enquiry_type")}
        </div>
        <div className={styles.field}>
          {label("budget_range", enquiryForm.budgetRange, false)}
          <select
            {...register("budget_range")}
            disabled={submitting}
            aria-describedby={describedBy("budget_range")}
            className={cx(styles.input, styles.select)}
          >
            <option value="">{enquiryForm.budgetNone}</option>
            {budgetRanges.map((value) => (
              <option key={value} value={value}>
                {budgetRangeLabels[value]}
              </option>
            ))}
          </select>
          {fieldError("budget_range")}
        </div>
      </div>

      <div className={styles.field}>
        {label("company", enquiryForm.company, false)}
        <input
          {...register("company")}
          type="text"
          autoComplete="organization"
          readOnly={submitting}
          aria-describedby={describedBy("company")}
          className={styles.input}
        />
        {fieldError("company")}
      </div>

      <div className={styles.field}>
        {label("message", enquiryForm.message, true)}
        <textarea
          {...register("message")}
          rows={6}
          readOnly={submitting}
          aria-required="true"
          aria-describedby={describedBy("message", id("message-count"))}
          className={cx(styles.input, styles.textarea)}
        />
        <p
          id={id("message-count")}
          className={cx(styles.counter, values.message.length > LIMITS.message && styles.counterOver)}
        >
          {enquiryForm.counter(values.message.length, LIMITS.message)}
        </p>
        {fieldError("message")}
      </div>

      {/* Honeypot (SEC-UI-007): off-screen, out of the tab order and hidden from assistive tech. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={id("website")}>{enquiryForm.honeypot}</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={values.website}
          onChange={onChange}
        />
      </div>

      <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={!hydrated}>
        {submitting ? enquiryForm.submitting : enquiryForm.submit}
      </Button>
      {contactEmail && (
        <noscript>
          <p className={styles.note}>
            {`${enquiryForm.noscriptLine} `}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        </noscript>
      )}
      <p className={styles.note}>{enquiryForm.privacy}</p>
    </form>
  );
}
