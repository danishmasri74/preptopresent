import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_SIGN_IN, isProtectedPath, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it.each([
    ["/projects/123", "/projects/123"],
    ["/home?tab=recent", "/home?tab=recent"],
  ])("keeps in-app path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/home\nSet-Cookie:x",
  ])("falls back to the default for unsafe value %s", (input) => {
    expect(safeNextPath(input)).toBe(DEFAULT_AFTER_SIGN_IN);
  });
});

describe("isProtectedPath", () => {
  it("protects app areas and their children", () => {
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/onboarding/consent")).toBe(true);
    expect(isProtectedPath("/projects/abc")).toBe(true);
  });

  it("leaves public pages and look-alike paths open", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/sign-in")).toBe(false);
    expect(isProtectedPath("/homepage")).toBe(false);
  });
});
