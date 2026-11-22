import { describe, expect, it } from "vitest";
import { deleteAccountSchema, exportFilename, latestConsents, preferenceSchema } from "./settings";

describe("latestConsents", () => {
  it("defaults to off when nothing was recorded", () => {
    expect(latestConsents([])).toEqual({ save_video_default: false, study_participation: false });
  });

  it("uses the most recent row per kind, whatever the input order", () => {
    const rows = [
      { kind: "save_video_default", granted: false, created_at: "2026-11-20T10:00:00Z" },
      { kind: "save_video_default", granted: true, created_at: "2026-11-19T10:00:00Z" },
      { kind: "study_participation", granted: true, created_at: "2026-11-18T10:00:00Z" },
      { kind: "analysis", granted: true, created_at: "2026-11-21T10:00:00Z" },
    ];
    expect(latestConsents(rows)).toEqual({ save_video_default: false, study_participation: true });
  });
});

describe("schemas", () => {
  it("accepts only settings-page consent kinds", () => {
    expect(preferenceSchema.safeParse({ kind: "save_video_default", granted: true }).success).toBe(
      true,
    );
    // The analysis consent gates camera use and isn't toggled from here.
    expect(preferenceSchema.safeParse({ kind: "analysis", granted: false }).success).toBe(false);
  });

  it("requires the exact confirm phrase to delete", () => {
    expect(deleteAccountSchema.safeParse({ confirm: " DELETE " }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirm: "" }).success).toBe(false);
  });
});

it("names the export file by date", () => {
  expect(exportFilename(new Date("2026-11-21T15:00:00Z"))).toBe(
    "preptopresent-data-2026-11-21.json",
  );
});
