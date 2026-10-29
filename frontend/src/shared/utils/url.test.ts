import { describe, expect, it } from "vitest";
import { isInternalPath, isSafeMediaUrl, safeExternalUrl } from "./url";

describe("SEC-UI-004 safeExternalUrl", () => {
  it.each(["https://example.com/a", "http://example.com"])("accepts %s", (url) => {
    expect(safeExternalUrl(url)).not.toBeNull();
  });

  it.each([null, undefined, "", "#", "/contact", "javascript:alert(1)", "JAVASCRIPT:alert(1)", "ftp://x", "data:text/html,x", " https://x.com", "mailto:a@b.c", "https://"])(
    "rejects %s",
    (url) => {
      expect(safeExternalUrl(url)).toBeNull();
    },
  );
});

describe("isInternalPath", () => {
  it.each([["/work", true], ["/", true], ["//evil.example", false], ["/\\evil", false], ["work", false], ["/a\nb", false]])(
    "%s → %s",
    (value, expected) => {
      expect(isInternalPath(value)).toBe(expected);
    },
  );
});

describe("SEC-UI-009 isSafeMediaUrl", () => {
  it.each([["/media/seed/a.webp", true], ["/media/../x", false], ["https://x/media/a.png", false], ["/static/a.png", false], ['/media/a".png', false]])(
    "%s → %s",
    (value, expected) => {
      expect(isSafeMediaUrl(value)).toBe(expected);
    },
  );
});
