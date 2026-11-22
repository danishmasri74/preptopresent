"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email?: string };

const schema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  next: z.string().optional(),
});

/** Sends a passwordless sign-in link. Also creates the account on first use. */
export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check your email address.",
      email: String(formData.get("email") ?? ""),
    };
  }

  const { email, next } = parsed.data;
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) {
    return { status: "error", message: "Something went wrong. Please try again.", email };
  }

  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", safeNextPath(next));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error) {
    // Don't reveal provider details. The most common cause is the per-email rate limit.
    const rateLimited = error.status === 429 || /rate|seconds/i.test(error.message);
    return {
      status: "error",
      email,
      message: rateLimited
        ? "Please wait a minute before requesting another link."
        : "We couldn't send the link. Please try again.",
    };
  }

  return { status: "sent", email };
}
