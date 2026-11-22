import { z } from "zod";

/**
 * Consent-backed preferences the user can change in Settings › Privacy & data (spec F-04, F-06).
 * Each change appends a new `consents` row, so the history stays auditable.
 */
export const PRIVACY_PREFERENCES = [
  {
    kind: "save_video_default",
    label: "Save video for playback",
    description: "Default for new rehearsals. You can change it each time.",
  },
  {
    kind: "study_participation",
    label: "Help evaluate PrepToPresent",
    description: "Use my anonymised scores in the evaluation study. Never recordings.",
  },
] as const;

export type PreferenceKind = (typeof PRIVACY_PREFERENCES)[number]["kind"];

const preferenceKinds = PRIVACY_PREFERENCES.map((p) => p.kind) as [
  PreferenceKind,
  ...PreferenceKind[],
];

export const preferenceSchema = z.object({
  kind: z.enum(preferenceKinds),
  granted: z.boolean(),
});

/** What the user must type to confirm account deletion. */
export const DELETE_CONFIRM_PHRASE = "DELETE";

export const deleteAccountSchema = z.object({
  confirm: z
    .string()
    .trim()
    .refine((v) => v === DELETE_CONFIRM_PHRASE, `Type ${DELETE_CONFIRM_PHRASE} to confirm.`),
});

/** Latest decision per consent kind, from rows in any order. Missing kinds default to false. */
export function latestConsents(
  rows: { kind: string; granted: boolean; created_at: string }[],
): Record<PreferenceKind, boolean> {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const result = Object.fromEntries(preferenceKinds.map((k) => [k, false])) as Record<
    PreferenceKind,
    boolean
  >;
  for (const row of sorted) {
    if ((preferenceKinds as readonly string[]).includes(row.kind)) {
      result[row.kind as PreferenceKind] = row.granted;
    }
  }
  return result;
}

/** How long download links for uploaded files inside a data export stay valid. */
export const EXPORT_LINK_TTL_S = 24 * 60 * 60;
export const EXPORT_FORMAT_VERSION = 1;

export function exportFilename(now: Date): string {
  return `preptopresent-data-${now.toISOString().slice(0, 10)}.json`;
}
