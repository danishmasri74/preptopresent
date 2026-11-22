import { describe, expect, it } from "vitest";
import {
  MAX_DECK_BYTES,
  bodyPreview,
  deckPath,
  newProjectSchema,
  validateDeckFile,
} from "./projects";

const valid = {
  title: "FYP defence",
  preset: "fyp_viva",
  time_limit_min: "15",
  present_on: "",
  audience: "examiners",
  qa_enabled: true,
  script_style: "key_points",
  tone: "formal",
};

describe("newProjectSchema", () => {
  it("accepts a valid project and converts minutes", () => {
    const r = newProjectSchema.parse(valid);
    expect(r.time_limit_min).toBe(15);
    expect(r.present_on).toBeUndefined();
  });

  it.each([
    ["0 minutes", { time_limit_min: "0" }],
    ["16 minutes", { time_limit_min: "16" }],
    ["empty title", { title: "  " }],
    ["unknown preset", { preset: "keynote" }],
    ["bad date", { present_on: "next week" }],
  ])("rejects %s", (_label, override) => {
    expect(newProjectSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe("validateDeckFile", () => {
  const pdf = (size: number, name = "deck.pdf", type = "application/pdf") =>
    ({ name, size, type }) as File;

  it("accepts a normal PDF", () => {
    expect(validateDeckFile(pdf(2_000_000))).toBeNull();
  });

  it("rejects missing, empty, oversized and non-PDF files", () => {
    expect(validateDeckFile(null)).toMatch(/choose/i);
    expect(validateDeckFile(pdf(0))).toMatch(/empty/i);
    expect(validateDeckFile(pdf(MAX_DECK_BYTES + 1))).toMatch(/100 MB/);
    expect(
      validateDeckFile(
        pdf(1000, "deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml"),
      ),
    ).toMatch(/PDF/);
  });
});

describe("bodyPreview", () => {
  it("drops a leading copy of the title", () => {
    expect(bodyPreview("Problem statement", "Problem statement Public speaking anxiety")).toBe(
      "Public speaking anxiety",
    );
  });

  it("leaves text alone when it doesn't start with the title", () => {
    expect(bodyPreview("Results", "SUS score 78")).toBe("SUS score 78");
    expect(bodyPreview(null, " Some text ")).toBe("Some text");
  });

  it("returns empty when the slide only has its title", () => {
    expect(bodyPreview("Thank you", "Thank you")).toBe("");
  });
});

describe("deckPath", () => {
  it("puts the file under the user's own folder (required by storage RLS)", () => {
    expect(deckPath("u1", "p1", "d1")).toBe("u1/p1/d1.pdf");
  });
});
