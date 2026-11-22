import { describe, expect, it } from "vitest";
import { aboutSchema, checkInSchema, consentSchema } from "./onboarding";

describe("aboutSchema", () => {
  it("accepts a valid profile and trims the name", () => {
    const r = aboutSchema.parse({
      display_name: "  Aina ",
      university: "",
      field_of_study: "Computing / IT",
      goals: ["less_nervous", "timing"],
    });
    expect(r.display_name).toBe("Aina");
    expect(r.goals).toEqual(["less_nervous", "timing"]);
  });

  it("rejects an empty name, unknown field and unknown goals", () => {
    expect(
      aboutSchema.safeParse({ display_name: " ", field_of_study: "Computing / IT" }).success,
    ).toBe(false);
    expect(aboutSchema.safeParse({ display_name: "A", field_of_study: "Astrology" }).success).toBe(
      false,
    );
    expect(
      aboutSchema.safeParse({ display_name: "A", field_of_study: "Business", goals: ["hack"] })
        .success,
    ).toBe(false);
  });
});

describe("checkInSchema", () => {
  it("accepts four answers between 1 and 5 (form values arrive as strings)", () => {
    expect(checkInSchema.parse({ items: ["4", "3", "2", "5"] }).items).toEqual([4, 3, 2, 5]);
  });

  it("rejects missing or out-of-range answers", () => {
    expect(checkInSchema.safeParse({ items: ["4", "3", "2"] }).success).toBe(false);
    expect(checkInSchema.safeParse({ items: ["4", "3", "2", "6"] }).success).toBe(false);
    expect(checkInSchema.safeParse({ items: ["4", "3", "2", null] }).success).toBe(false);
  });
});

describe("consentSchema", () => {
  const base = { save_video_default: false, study_participation: false };

  it("requires analysis consent and age confirmation", () => {
    expect(consentSchema.safeParse({ ...base, analysis: true, age_18_plus: true }).success).toBe(
      true,
    );
    expect(consentSchema.safeParse({ ...base, analysis: false, age_18_plus: true }).success).toBe(
      false,
    );
    expect(consentSchema.safeParse({ ...base, analysis: true, age_18_plus: false }).success).toBe(
      false,
    );
  });
});
