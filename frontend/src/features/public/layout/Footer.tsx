/**
 * Footer (UI-021, REQ-004, REQ-005). Dark-olive footer in the wide container:
 * - giant Wordmark with a small rotated green sub-label tile;
 * - three link groups with green labels: quick links, social links (settings; http(s) only, new tab) and email
 *   (`mailto:` from the validated contact email); the build year (year of `site.generated_at`) top-right;
 * - bottom bar: copyright with the build year, the footer sign-off and the rights line (both from settings, plain
 *   text; CHG-005).
 * Social links that are not absolute http(s) URLs are omitted (SEC-UI-004); no valid links → group omitted.
 * The year comes from the content snapshot, never the render clock, so server and client match (TS-005 step 10).
 */
import { Link } from "react-router";
import type { SiteBundle, SocialLink } from "@/api/types";
import { a11y, footer, nav } from "@/features/public/content/copy";
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
  const year = buildYear(site);
  const socials = safeSocialLinks(site?.settings.social_links);
  const email = safeEmail(site?.settings.contact_email);
  const signoff = site?.settings.footer_signoff.trim() ?? "";
  /** Plain text from settings (CHG-005, TS-013); React escapes it. */
  const rights = site?.settings.footer_rights_line.trim() ?? "";

  return (
    <footer className={styles.footer} data-surface="dark">
      <div className={cx("container-wide", styles.inner)}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Wordmark size="footer" />
            <span className={styles.subLabel}>{footer.subLabel}</span>
          </div>
          {year && (
            <p className={styles.year}>
              <span className="visually-hidden">{footer.builtLabel} </span>
              {year}
            </p>
          )}
        </div>

        <div className={styles.groups}>
          <nav aria-label={footer.navLabel} className={styles.group}>
            <h2 className={styles.label}>{footer.quickLinksLabel}</h2>
            <ul className={styles.list}>
              {QUICK_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {socials.length > 0 && (
            <div className={styles.group}>
              <h2 className={styles.label}>{footer.socialLabel}</h2>
              <ul className={styles.list}>
                {socials.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
                      {link.label}{" "}
                      <span className="visually-hidden">{a11y.opensInNewTab}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {email && (
            <div className={styles.group}>
              <h2 className={styles.label}>{footer.emailLabel}</h2>
              <ul className={styles.list}>
                <li>
                  <a href={`mailto:${email}`} className={cx(styles.link, styles.email)}>
                    {email}
                  </a>
                </li>
              </ul>
            </div>
          )}
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
