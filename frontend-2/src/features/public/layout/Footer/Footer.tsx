/**
 * Footer (UI-107, REQ-004, REQ-005, REQ-086, TS-023 step 4, DES-052, DES-057, DES-065) on the deepest surface:
 * 1. a giant two-line "let's talk" call-to-action linking to /contact (display 300, 4 px accent underline, arrow);
 * 2. hairline, the giant wordmark and the contact email (`mailto:`, validated);
 * 3. hairline, link columns: quick links (Work, Writing, About, Contact, FAQs), social links (settings; http(s) only,
 *    new tab, `rel="noopener noreferrer"`; group omitted when none is valid) and contact;
 * 4. bottom bar: "© <year of site.generated_at> Mitali", the sign-off and the rights line (plain text).
 * The year comes from the content snapshot, never the render clock, so server and client match.
 */
import { Fragment, useId } from "react";
import type { SiteBundle, SocialLink } from "@/api/types";
import { a11y, actions, footer, footerCta, nav } from "@/features/public/content/copy";
import { AppLink } from "@/shared/ui/AppLink/AppLink";
import { ArrowLink } from "@/shared/ui/ArrowLink/ArrowLink";
import { Wordmark } from "@/shared/ui/Wordmark/Wordmark";
import { cx } from "@/shared/utils/cx";
import { safeEmail, safeExternalUrl } from "@/shared/utils/url";
import styles from "./Footer.module.css";

export const QUICK_LINKS = [
  { to: "/work", label: nav.work },
  { to: "/writing", label: nav.writing },
  { to: "/about", label: nav.about },
  { to: "/contact", label: nav.contact },
  { to: "/faqs", label: nav.faqs },
] as const;

/** Year of the content snapshot (UTC), never the render clock. */
export function buildYear(site: SiteBundle | undefined): string | null {
  if (!site) return null;
  const date = new Date(site.generated_at);
  return Number.isNaN(date.getTime()) ? null : String(date.getUTCFullYear());
}

interface SafeSocialLink {
  label: string;
  href: string;
}

export function safeSocialLinks(links: SocialLink[] | undefined): SafeSocialLink[] {
  const out: SafeSocialLink[] = [];
  for (const link of links ?? []) {
    const href = safeExternalUrl(link.url);
    if (href !== null && link.label.trim() !== "") out.push({ label: link.label, href });
  }
  return out;
}

export interface FooterProps {
  site: SiteBundle | undefined;
}

export function Footer({ site }: FooterProps) {
  const quickId = useId();
  const socialId = useId();
  const contactId = useId();
  const year = buildYear(site);
  const socials = safeSocialLinks(site?.settings.social_links);
  const email = safeEmail(site?.settings.contact_email);
  const signoff = site?.settings.footer_signoff.trim() ?? "";
  /** Plain text from settings (CHG-005); React escapes it. */
  const rights = site?.settings.footer_rights_line.trim() ?? "";

  return (
    <footer className={styles.footer} data-surface="deep">
      <div className={cx("bleed", styles.inner)}>
        <div className={styles.ctaBlock}>
          <ArrowLink to="/contact" size="cta" label={footerCta.label}>
            {/* A real space between the lines: the visible text reads "let's talk" (WCAG 2.5.3); CSS stacks the lines. */}
            {footerCta.lines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 && " "}
                <span className={styles.ctaLine}>{line}</span>
              </Fragment>
            ))}
          </ArrowLink>
        </div>

        <div className={styles.brandRow}>
          <Wordmark size="footer" />
          {email && (
            <a href={`mailto:${email}`} className={cx(styles.link, styles.email)}>
              {email}
            </a>
          )}
        </div>

        <div className={styles.groups}>
          <nav aria-labelledby={quickId} className={styles.group}>
            <h2 id={quickId} className={styles.label}>
              {footer.quickLinksLabel}
            </h2>
            <ul className={styles.list}>
              {QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <AppLink to={link.to} className={styles.link}>
                    {link.label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>

          {socials.length > 0 && (
            <div className={styles.group}>
              <h2 id={socialId} className={styles.label}>
                {footer.socialLabel}
              </h2>
              <ul className={styles.list} aria-labelledby={socialId}>
                {socials.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
                      {link.label} <span className="visually-hidden">{a11y.opensInNewTab}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.group}>
            <h2 id={contactId} className={styles.label}>
              {footer.emailLabel}
            </h2>
            <ul className={styles.list} aria-labelledby={contactId}>
              <li>
                <AppLink to="/contact" className={styles.link}>
                  {actions.contact}
                </AppLink>
              </li>
              {email && (
                <li>
                  <a href={`mailto:${email}`} className={styles.link}>
                    {footer.emailLabel}: {email}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          {year && <p>{footer.copyright(year)}</p>}
          {signoff !== "" && <p>{signoff}</p>}
          {rights !== "" && <p>{rights}</p>}
        </div>
      </div>
    </footer>
  );
}
