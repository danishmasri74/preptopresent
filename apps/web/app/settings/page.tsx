import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getProfile } from "@/lib/auth/session";
import { latestConsents } from "@/lib/settings";
import { PrivacySettings } from "./privacy-settings";

export const metadata: Metadata = { title: "Privacy & data · Settings" };

export default async function SettingsPage() {
  const { supabase } = await getProfile();
  const { data, error } = await supabase
    .from("consents")
    .select("kind, granted, created_at")
    .in("kind", ["save_video_default", "study_participation"]);

  return (
    <div className="flex min-h-full flex-1 flex-wrap">
      <aside className="flex max-w-[220px] flex-[1_1_200px] flex-col gap-1 px-4 py-7">
        <Link
          href="/home"
          className="mb-4 flex min-h-11 items-center gap-2 rounded-[10px] px-3.5 font-semibold text-primary hover:bg-[#ececE8]"
        >
          <ChevronLeft className="size-[18px]" aria-hidden="true" />
          Home
        </Link>
        <nav aria-label="Settings" className="flex flex-col gap-1">
          <Link
            href="/settings"
            aria-current="page"
            className="flex min-h-11 items-center rounded-[10px] bg-card px-3.5 font-semibold text-foreground shadow-[0_1px_2px_rgba(20,20,30,0.06)]"
          >
            Privacy &amp; data
          </Link>
        </nav>
      </aside>

      <main className="min-w-0 flex-[999_1_560px] px-12 py-12">
        <div className="mx-auto flex max-w-[720px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Privacy &amp; data</h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Body tracking runs on your computer: we only receive numbers like head angle and
              shoulder position. Rehearsal video and audio are saved privately to your account and
              kept until you delete them.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-attention-soft px-4 py-3 text-attention-foreground"
            >
              We couldn&apos;t load your settings. Refresh to try again.
            </p>
          ) : (
            // Rehearsal recordings arrive in Phase 3; until then there is nothing to delete.
            <PrivacySettings preferences={latestConsents(data ?? [])} recordingCount={0} />
          )}
        </div>
      </main>
    </div>
  );
}
