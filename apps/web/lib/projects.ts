import { z } from "zod";

export const PRESETS = [
  { id: "class", label: "Class presentation", minutes: 8, hint: "5–10 min" },
  { id: "fyp_viva", label: "FYP / viva", minutes: 15, hint: "15 min + Q&A" },
  { id: "pitch", label: "Pitch", minutes: 4, hint: "3–5 min" },
  { id: "custom", label: "Custom", minutes: 10, hint: "Set your own" },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"];

export const AUDIENCES = [
  { id: "examiners", label: "Lecturers / examiners" },
  { id: "classmates", label: "Classmates" },
  { id: "industry", label: "Industry panel" },
  { id: "public", label: "General public" },
] as const;

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 15;
export const MAX_DECK_BYTES = 100 * 1024 * 1024;
export const DECK_MIME_TYPES = ["application/pdf"] as const;

const presetIds = PRESETS.map((p) => p.id) as [PresetId, ...PresetId[]];
const audienceIds = AUDIENCES.map((a) => a.id) as [string, ...string[]];

export const newProjectSchema = z.object({
  title: z.string().trim().min(1, "Give your project a title.").max(120),
  preset: z.enum(presetIds),
  time_limit_min: z.coerce
    .number()
    .int()
    .min(MIN_MINUTES, `Time limit must be at least ${MIN_MINUTES} minute.`)
    .max(MAX_MINUTES, `Time limit can be at most ${MAX_MINUTES} minutes.`),
  present_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  audience: z
    .enum(audienceIds)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  qa_enabled: z.boolean(),
  script_style: z.enum(["key_points", "full"]),
  tone: z.enum(["formal", "conversational"]),
});

export type NewProjectInput = z.infer<typeof newProjectSchema>;

export const registerDeckSchema = z.object({
  projectId: z.uuid(),
  deckId: z.uuid(),
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_DECK_BYTES),
  mimeType: z.enum(DECK_MIME_TYPES),
});

/** Storage path for an uploaded deck. Must match the RLS rule "<user>/<project>/...". */
export function deckPath(userId: string, projectId: string, deckId: string): string {
  return `${userId}/${projectId}/${deckId}.pdf`;
}

/** Client-side file check before uploading (the server and storage enforce it again). */
export function validateDeckFile(file: File | null | undefined): string | null {
  if (!file) return "Choose your slides (PDF).";
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Upload your slides as a PDF. In PowerPoint: File › Export › PDF.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_DECK_BYTES) return "That file is over 100 MB.";
  return null;
}

/**
 * Slide text for previews without the title repeated at the start.
 * (Extraction keeps the full raw text, so this only affects display.)
 */
export function bodyPreview(title: string | null, body: string): string {
  const text = body.trim();
  if (!title) return text;
  const t = title.trim();
  return text.toLowerCase().startsWith(t.toLowerCase()) ? text.slice(t.length).trim() : text;
}

export function presetLabel(id: string): string {
  return PRESETS.find((p) => p.id === id)?.label ?? "Custom";
}

export function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export const DECK_ERROR_MESSAGES: Record<string, string> = {
  unreadable: "We couldn't open that file as a PDF. Try exporting it again.",
  encrypted: "That PDF is password-protected. Export a copy without a password.",
  empty: "That PDF has no pages.",
  too_many_pages: "That deck has more than 60 slides. Trim it and upload again.",
  internal: "Something went wrong on our side while reading your slides. Please try again.",
};
