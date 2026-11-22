import type { Metadata } from "next";
import { requireOnboarding } from "@/lib/auth/session";
import { OnboardingHeader } from "../_components";
import { AboutForm } from "./about-form";

export const metadata: Metadata = { title: "About you" };

export default async function AboutPage() {
  const profile = await requireOnboarding();
  return (
    <>
      <OnboardingHeader step={1} />
      <main className="flex-1 px-10 pt-6 pb-14">
        <div className="mx-auto flex max-w-[560px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">A little about you</h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              This helps us pitch your scripts and feedback at the right level.
            </p>
          </div>
          <AboutForm
            defaults={{
              display_name: profile.display_name ?? "",
              university: profile.university ?? "",
              field_of_study: profile.field_of_study ?? "",
              goals: profile.goals ?? [],
            }}
          />
        </div>
      </main>
    </>
  );
}
