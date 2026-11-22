import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the verified signed-in user id and a request-scoped Supabase client,
 * or redirects to /sign-in. Use at the top of every protected page and server action.
 */
export async function requireUser() {
  // Session checks compare token expiry with the current time, so they must run per request,
  // never during prerendering (Cache Components flags Date.now() otherwise).
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/sign-in");
  return { supabase, userId, email: (data.claims.email as string | undefined) ?? null };
}

export type Profile = {
  id: string;
  display_name: string | null;
  university: string | null;
  field_of_study: string | null;
  goals: string[];
  onboarded_at: string | null;
  deletion_requested_at: string | null;
};

export async function getProfile() {
  const { supabase, userId, email } = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, university, field_of_study, goals, onboarded_at, deletion_requested_at",
    )
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("Could not load your profile.");
  // Account deletion is pending (F-06): sign out instead of showing any data.
  if (data.deletion_requested_at) redirect("/auth/deleted");
  return { profile: data as Profile, userId, email, supabase };
}

/** For onboarding pages: signed in, but not yet onboarded (otherwise go home). */
export async function requireOnboarding(): Promise<Profile> {
  const { profile } = await getProfile();
  if (profile.onboarded_at) redirect("/home");
  return profile;
}
