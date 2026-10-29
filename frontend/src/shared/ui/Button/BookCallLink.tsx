/**
 * BookCallLink (UI-006, REQ-002, REQ-013): external link to `settings.booking_url` when it is a valid absolute
 * http(s) URL; null, "", "#" or anything else (javascript:, ftp:, relative) falls back to `/contact`.
 */
import type { ReactNode } from "react";
import { actions } from "@/features/public/content/copy";
import { safeExternalUrl } from "@/shared/utils/url";
import type { ButtonVariant } from "./Button";
import { ButtonLink } from "./ButtonLink";

export const CONTACT_PATH = "/contact";

export function bookingHref(bookingUrl: string | null | undefined): string {
  return safeExternalUrl(bookingUrl) ?? CONTACT_PATH;
}

export interface BookCallLinkProps {
  bookingUrl: string | null | undefined;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export function BookCallLink({ bookingUrl, variant = "primary", fullWidth, className, children }: BookCallLinkProps) {
  return (
    <ButtonLink href={bookingHref(bookingUrl)} variant={variant} fullWidth={fullWidth} className={className}>
      {children ?? actions.bookCall}
    </ButtonLink>
  );
}
