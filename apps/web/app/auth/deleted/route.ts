import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where getProfile() sends a user whose account is being deleted (e.g. they signed in again
 * before the delete_account job finished). It signs out only in that case, so a stray link to
 * this URL can't sign anyone else out.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("deletion_requested_at")
      .eq("id", userId)
      .maybeSingle();
    if (profile && !profile.deletion_requested_at) {
      return NextResponse.redirect(new URL("/home", request.nextUrl.origin), { status: 303 });
    }
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/sign-in?deleted=1", request.nextUrl.origin), {
    status: 303,
  });
}
