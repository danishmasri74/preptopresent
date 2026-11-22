"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { CONSENT_POLICY_VERSION } from "@/lib/onboarding";
import { deleteAccountSchema, preferenceSchema } from "@/lib/settings";

export type ActionResult = { ok: true } | { ok: false; message: string };
export type DeleteAccountState = { status: "idle" } | { status: "error"; message: string };

const GENERIC = "Something went wrong. Please try again.";

/** Appends a consent row; the latest row per kind is the current setting. */
export async function setPreference(input: {
  kind: string;
  granted: boolean;
}): Promise<ActionResult> {
  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: GENERIC };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("consents").insert({
    user_id: userId,
    kind: parsed.data.kind,
    granted: parsed.data.granted,
    policy_version: CONSENT_POLICY_VERSION,
  });
  if (error) return { ok: false, message: "We couldn't save that change. Please try again." };
  return { ok: true };
}

/**
 * Marks the account for deletion and queues the worker job that removes files and the user,
 * then signs out everywhere. Postgres re-checks who is asking (request_account_deletion()).
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const parsed = deleteAccountSchema.safeParse({ confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { status: "error", message: GENERIC };

  await supabase.auth.signOut({ scope: "global" });
  redirect("/sign-in?deleted=1");
}
