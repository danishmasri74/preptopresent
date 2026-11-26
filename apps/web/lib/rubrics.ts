import { z } from "zod";

export const MAX_RUBRIC_BYTES = 20 * 1024 * 1024;
export const MAX_PASTE_CHARS = 20_000;
export const MIN_PASTE_CHARS = 20;

/** Accepted rubric files: extension → MIME type (must match the `rubrics` bucket and table). */
export const RUBRIC_FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type RubricMime = (typeof RUBRIC_FILE_TYPES)[keyof typeof RUBRIC_FILE_TYPES];
const RUBRIC_MIMES = [...new Set(Object.values(RUBRIC_FILE_TYPES))] as [
  RubricMime,
  ...RubricMime[],
];

export const RUBRIC_ACCEPT = [
  ...RUBRIC_MIMES,
  ".pdf",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
].join(",");

/** The file's type and storage extension, or null if we don't accept it. */
export function rubricFileType(file: File): { mime: RubricMime; ext: string } | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext in RUBRIC_FILE_TYPES) {
    const mime = RUBRIC_FILE_TYPES[ext as keyof typeof RUBRIC_FILE_TYPES];
    return { mime, ext: ext === "jpeg" ? "jpg" : ext };
  }
  const byMime = Object.entries(RUBRIC_FILE_TYPES).find(([, m]) => m === file.type);
  return byMime ? { mime: byMime[1], ext: byMime[0] === "jpeg" ? "jpg" : byMime[0] } : null;
}

export function rubricBadge(file: File): string {
  return (rubricFileType(file)?.ext ?? "file").toUpperCase();
}

/** Client-side check before uploading (storage and the database enforce it again). */
export function validateRubricFile(file: File | null | undefined): string | null {
  if (!file) return "Choose your rubric or brief.";
  if (!rubricFileType(file)) {
    return "Upload a PDF, Word document (.docx) or photo (JPG, PNG). For other formats, paste the text instead.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_RUBRIC_BYTES) return "That file is over 20 MB.";
  return null;
}

export const registerRubricSchema = z.object({
  projectId: z.uuid(),
  rubricId: z.uuid(),
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_RUBRIC_BYTES),
  mimeType: z.enum(RUBRIC_MIMES),
  ext: z.enum(["pdf", "docx", "jpg", "png", "webp"]),
});

export const pasteRubricSchema = z.object({
  projectId: z.uuid(),
  text: z
    .string()
    .trim()
    .min(MIN_PASTE_CHARS, "Paste the full rubric or brief (at least a few lines).")
    .max(
      MAX_PASTE_CHARS,
      `That's over ${MAX_PASTE_CHARS.toLocaleString("en")} characters. Paste just the marking part.`,
    ),
});

/** Storage path for an uploaded rubric. Must match the RLS rule "<user>/<project>/...". */
export function rubricPath(userId: string, projectId: string, rubricId: string, ext: string) {
  return `${userId}/${projectId}/rubric-${rubricId}.${ext}`;
}

export type RubricStatus = "uploaded" | "processing" | "parsed" | "confirmed" | "failed";

export type RubricCriterion = {
  id: string;
  position: number;
  name: string;
  weight: number;
  description: string;
};

/** Sum of weights, rounded to avoid floating-point noise (numeric(5,2) in the database). */
export function weightTotal(criteria: Pick<RubricCriterion, "weight">[]): number {
  return Math.round(criteria.reduce((sum, c) => sum + Number(c.weight), 0) * 100) / 100;
}

export function formatWeight(weight: number): string {
  const n = Number(weight);
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, "")}%`;
}

export const RUBRIC_ERROR_MESSAGES: Record<string, string> = {
  not_a_rubric:
    "We couldn't find any marking criteria in what you added. Check it's the rubric or brief, then try again.",
  unreadable: "We couldn't open that file. Try saving it again, or paste the text instead.",
  encrypted: "That PDF is password-protected. Save a copy without a password and upload it again.",
  empty: "That file has no content we could read.",
  too_many_pages: "That document is over 20 pages. Upload just the marking rubric.",
  unsupported: "We can't read that file type. Upload a PDF, Word document or photo instead.",
  refused: "We couldn't read this rubric automatically. Try pasting the criteria as text.",
  internal: "Something went wrong on our side while reading your rubric. Please try again.",
};
