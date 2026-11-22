import { z } from "zod";

/** Bump when the consent wording in /onboarding/consent changes; users re-consent. */
export const CONSENT_POLICY_VERSION = "2026-11";

/**
 * Baseline confidence questionnaire (spec F-03). Placeholder wording owned by the team.
 * For the FYP evaluation study, swap in a validated instrument and bump the id.
 */
export const BASELINE_INSTRUMENT = "ptp-baseline-v1";
export const BASELINE_QUESTIONS = [
  "I feel nervous in the days before a presentation.",
  "I worry my mind will go blank while speaking.",
  "I feel comfortable answering questions from an audience.",
  "I know what to improve in my presentations.",
] as const;

export const FIELDS_OF_STUDY = [
  "Computing / IT",
  "Engineering",
  "Business",
  "Science",
  "Health",
  "Arts & humanities",
  "Social sciences",
  "Other",
] as const;

export const GOALS = [
  { id: "less_nervous", label: "Feeling less nervous" },
  { id: "fewer_fillers", label: "Fewer filler words" },
  { id: "body_language", label: "Body language" },
  { id: "timing", label: "Staying on time" },
  { id: "qa", label: "Answering questions" },
  { id: "rubric", label: "Hitting the rubric" },
] as const;

const goalIds = GOALS.map((g) => g.id) as [string, ...string[]];

export const aboutSchema = z.object({
  display_name: z.string().trim().min(1, "Tell us what to call you.").max(80),
  university: z.string().trim().max(160).optional().default(""),
  field_of_study: z.enum(FIELDS_OF_STUDY, { message: "Choose your field of study." }),
  goals: z.array(z.enum(goalIds)).max(GOALS.length).default([]),
});

export const checkInSchema = z.object({
  items: z
    .array(z.coerce.number().int().min(1).max(5))
    .length(BASELINE_QUESTIONS.length, "Please answer every statement."),
});

export const consentSchema = z.object({
  analysis: z.literal(true, { message: "This is needed to analyse your rehearsals." }),
  age_18_plus: z.literal(true, { message: "You must be 18 or older to use PrepToPresent." }),
  save_video_default: z.boolean(),
  study_participation: z.boolean(),
});

export type FormState = { status: "idle" } | { status: "error"; message: string };
