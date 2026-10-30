import { describe, expect, it } from "vitest";
import { loginPathFor, safeNextPath } from "./next-path";

describe("UI-T-074 / SEC-UI-005 login next validation", () => {
  it.each([
    "//evil.example",
    "https://evil.example",
    "/\\evil",
    "/work",
    "%2F%2Fevil.example",
    "/admin%5C..%5C..%2F%2Fevil",
    "/admin@evil.example",
    "/administrator",
    "javascript:alert(1)",
    "/admin/../work",
    "/admin/login",
    "/admin\u0000x",
    "",
    null,
  ])("rejects %j → /admin", (value) => {
    expect(safeNextPath(value)).toBe("/admin");
  });

  it.each([
    ["/admin", "/admin"],
    ["/admin/enquiries", "/admin/enquiries"],
    ["%2Fadmin%2Fcase-studies", "/admin/case-studies"],
    ["/admin/enquiries?status=new", "/admin/enquiries?status=new"],
  ])("accepts %j", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });

  it("loginPathFor keeps only admin paths", () => {
    expect(loginPathFor("/admin/case-studies")).toBe("/admin/login?next=%2Fadmin%2Fcase-studies");
    expect(loginPathFor("/work")).toBe("/admin/login?next=%2Fadmin");
  });
});
