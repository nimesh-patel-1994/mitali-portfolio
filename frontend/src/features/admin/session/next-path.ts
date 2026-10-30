/**
 * Login `next` validation (UI-036, SEC-UI-005, UI-REV-014). Accepted only when, after decoding, it is a same-origin
 * path equal to `/admin` or starting with `/admin/`, without `//` or `/\` prefixes, backslashes, a scheme, `@` before
 * the first slash segment, or control characters. Anything else → `/admin`. Navigation always goes through the
 * router (never `window.location`).
 */
export const ADMIN_HOME = "/admin";

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function decodeFully(value: string): string | null {
  let current = value;
  // Decode repeatedly (bounded) so double-encoded payloads cannot slip through.
  for (let i = 0; i < 3; i += 1) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) return current;
    current = next;
  }
  return current;
}

export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw === "") return ADMIN_HOME;
  const decoded = decodeFully(raw);
  if (decoded === null) return ADMIN_HOME;
  for (const value of [raw, decoded]) {
    if (hasControlChars(value) || value.includes("\\")) return ADMIN_HOME;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return ADMIN_HOME;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return ADMIN_HOME;
  const pathOnly = decoded.split(/[?#]/, 1)[0] ?? "";
  if (pathOnly.includes("@") || pathOnly.includes("..")) return ADMIN_HOME;
  if (pathOnly !== ADMIN_HOME && !pathOnly.startsWith(`${ADMIN_HOME}/`)) return ADMIN_HOME;
  if (pathOnly === `${ADMIN_HOME}/login` || pathOnly.startsWith(`${ADMIN_HOME}/login/`)) return ADMIN_HOME;
  return decoded;
}

/** Builds `/admin/login?next=…` for the current location (only admin paths are kept). */
export function loginPathFor(currentPath: string): string {
  return `${ADMIN_HOME}/login?next=${encodeURIComponent(safeNextPath(currentPath))}`;
}
