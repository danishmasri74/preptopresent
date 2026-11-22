"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  BASELINE_INSTRUMENT,
  BASELINE_QUESTIONS,
  CONSENT_POLICY_VERSION,
  aboutSchema,
  checkInSchema,
  consentSchema,
  type FormState,
} from "@/lib/onboarding";

const GENERIC_ERROR: FormState = {
  status: "error",
  message: "Something went wrong saving that. Please try again.",
};

export async function saveAbout(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = aboutSchema.safeParse({
    display_name: formData.get("display_name"),
    university: formData.get("university") ?? "",
    field_of_study: formData.get("field_of_study"),
    goals: formData.getAll("goals"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      university: parsed.data.university || null,
      field_of_study: parsed.data.field_of_study,
      goals: parsed.data.goals,
    })
    .eq("id", userId);
  if (error) return GENERIC_ERROR;

  redirect("/onboarding/check-in");
}

export async function saveCheckIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = checkInSchema.safeParse({
    items: BASELINE_QUESTIONS.map((_, i) => formData.get(`q${i}`)),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please answer every statement." };
  }

  const { supabase, userId } = await requireUser();

  // Idempotent: going back and forth through onboarding must not record two baselines.
  const { count, error: countError } = await supabase
    .from("confidence_surveys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "baseline");
  if (countError) return GENERIC_ERROR;

  if (!count) {
    const { error } = await supabase.from("confidence_surveys").insert({
      user_id: userId,
      kind: "baseline",
      instrument: BASELINE_INSTRUMENT,
      items: parsed.data.items,
    });
    if (error) return GENERIC_ERROR;
  }

  redirect("/onboarding/consent");
}

export async function saveConsent(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = consentSchema.safeParse({
    analysis: formData.get("analysis") === "on",
    age_18_plus: formData.get("age_18_plus") === "on",
    save_video_default: formData.get("save_video_default") === "on",
    study_participation: formData.get("study_participation") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const { supabase, userId } = await requireUser();
  const rows = Object.entries(parsed.data).map(([kind, granted]) => ({
    user_id: userId,
    kind,
    granted,
    policy_version: CONSENT_POLICY_VERSION,
  }));
  const { error } = await supabase.from("consents").insert(rows);
  if (error) return GENERIC_ERROR;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId);
  if (profileError) return GENERIC_ERROR;

  redirect("/home");
}
