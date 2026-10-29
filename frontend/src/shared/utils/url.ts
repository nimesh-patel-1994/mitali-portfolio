/**
 * URL safety helpers (SEC-UI-004, SEC-UI-009, UI-REV-011, UI-REV-023).
 */

/** Returns the normalised URL when `value` is an absolute http(s) URL, otherwise null. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed !== value) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  return parsed.href;
}

function hasControlOrBackslash(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || value[i] === "\\") return true;
  }
  return false;
}

/** True for a same-origin, root-relative app path such as `/work` (not `//host`, `/\host` or control chars). */
export function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !hasControlOrBackslash(value);
}

/** Media URLs are used only when root-relative under `/media/` (SEC-UI-009). */
export function isSafeMediaUrl(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/media/") &&
    !value.includes("..") &&
    !/[\s"'<>\\]/.test(value) &&
    isInternalPath(value)
  );
}

/** Plain address shape check before building a `mailto:` link (the backend validates it on save, SEC-UI-004). */
export function safeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return /^[^\s@<>"'\\:/?#]+@[^\s@<>"'\\:/?#]+\.[^\s@<>"'\\:/?#]+$/.test(value) ? value : null;
}
