import { describe, expect, it } from "vitest";
import {
  MAX_RUBRIC_BYTES,
  formatWeight,
  pasteRubricSchema,
  rubricFileType,
  rubricPath,
  validateRubricFile,
  weightTotal,
} from "./rubrics";

function file(name: string, type = "", size = 1000) {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("rubric files", () => {
  it("recognises accepted types by extension or MIME type", () => {
    expect(rubricFileType(file("rubric.PDF"))).toEqual({ mime: "application/pdf", ext: "pdf" });
    expect(rubricFileType(file("photo.jpeg"))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(rubricFileType(file("scan", "image/png"))).toEqual({ mime: "image/png", ext: "png" });
    expect(rubricFileType(file("brief.docx"))?.ext).toBe("docx");
    expect(rubricFileType(file("old.doc", "application/msword"))).toBeNull();
  });

  it("explains what's wrong with a file before uploading", () => {
    expect(validateRubricFile(null)).toMatch(/choose/i);
    expect(validateRubricFile(file("notes.txt", "text/plain"))).toMatch(/paste the text/i);
    expect(validateRubricFile(file("big.pdf", "", MAX_RUBRIC_BYTES + 1))).toMatch(/20 MB/);
    expect(validateRubricFile(file("empty.pdf", "", 0))).toMatch(/empty/);
    expect(validateRubricFile(file("ok.pdf"))).toBeNull();
  });

  it("stores files under the user's project folder", () => {
    expect(rubricPath("u", "p", "r", "pdf")).toBe("u/p/rubric-r.pdf");
  });
});

describe("pasted rubrics", () => {
  const projectId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

  it("needs real content and has an upper limit", () => {
    expect(pasteRubricSchema.safeParse({ projectId, text: "  too short " }).success).toBe(false);
    expect(pasteRubricSchema.safeParse({ projectId, text: "x".repeat(20_001) }).success).toBe(
      false,
    );
    const ok = pasteRubricSchema.safeParse({
      projectId,
      text: "  1. Delivery - 20%  clear voice ",
    });
    expect(ok.success && ok.data.text).toBe("1. Delivery - 20%  clear voice");
  });
});

describe("weights", () => {
  it("totals without floating-point noise and formats percentages", () => {
    expect(weightTotal([{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }])).toBe(100);
    expect(formatWeight(25)).toBe("25%");
    expect(formatWeight(12.5)).toBe("12.5%");
    expect(formatWeight(33.33)).toBe("33.3%");
  });
});
