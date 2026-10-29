/**
 * Small decorative line icons (our own drawings). Always `aria-hidden`; the control or text next to them carries
 * the meaning. Size follows the font size (1em) and colour follows `currentColor`.
 */
import type { ReactNode, SVGProps } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./Icon.module.css";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

function Svg({ className, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      className={cx(styles.icon, className)}
      {...rest}
    />
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v16M4 12h16" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12H5M11 5l-7 7 7 7" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h15M13 5l7 7-7 7" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.5" width="18" height="13" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </Svg>
  );
}
