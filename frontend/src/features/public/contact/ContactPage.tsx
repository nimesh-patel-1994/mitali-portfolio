/**
 * Contact page (UI-033, REQ-042, REQ-006). Dark-olive two-column block: giant h1, promise line (settings
 * `contact_promise`, plain text, CHG-005) and the contact
 * email (`mailto:`, mail icon) on the left; the enquiry form on the right (below on mobile). Then the FAQ preview.
 */
import { useId } from "react";
import { useLoaderData } from "react-router";
import type { ContactData } from "@/app/content-types";
import { contactPage } from "@/features/public/content/copy";
import { useSiteData } from "@/features/public/layout/RootLayout";
import { FaqPreview } from "@/shared/ui/FaqPreview/FaqPreview";
import { MailIcon } from "@/shared/ui/Icon/Icon";
import { Section } from "@/shared/ui/Section/Section";
import { TapeDivider } from "@/shared/ui/TapeDivider/TapeDivider";
import { safeEmail } from "@/shared/utils/url";
import styles from "./ContactPage.module.css";
import { EnquiryForm } from "./EnquiryForm";

export function ContactPage() {
  const data = useLoaderData() as ContactData;
  const site = useSiteData();
  const headingId = useId();
  const email = safeEmail(site?.settings.contact_email);
  /** Plain text from settings (CHG-005, TS-013); React escapes it. */
  const promise = site?.settings.contact_promise.trim() ?? "";
  return (
    <>
      <Section surface="dark" aria-labelledby={headingId} className={styles.contact}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <h1 id={headingId} className={styles.heading}>
              {contactPage.headingLines.map((line) => (
                <span key={line} className={styles.line}>
                  {line}
                </span>
              ))}
            </h1>
            {promise !== "" && <p className={styles.promise}>{promise}</p>}
            {email && (
              <p className={styles.emailBlock}>
                <span className={styles.emailLabel}>{contactPage.emailLabel}</span>
                <a href={`mailto:${email}`} className={styles.email}>
                  <MailIcon className={styles.mailIcon} />
                  {email}
                </a>
              </p>
            )}
          </div>
          <EnquiryForm contactEmail={email} />
        </div>
      </Section>
      {data.faq_preview.length > 0 && <TapeDivider side="left" />}
      <FaqPreview faqs={data.faq_preview} />
    </>
  );
}
