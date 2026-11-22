import type { Metadata } from "next";
import { requireOnboarding } from "@/lib/auth/session";
import { OnboardingHeader } from "../_components";
import { CheckInForm } from "./check-in-form";

export const metadata: Metadata = { title: "How you feel about presenting" };

export default async function CheckInPage() {
  await requireOnboarding();
  return (
    <>
      <OnboardingHeader step={2} />
      <main className="flex-1 px-10 pt-6 pb-14">
        <div className="mx-auto flex max-w-[640px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">How do you feel about presenting?</h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              There are no right answers. We ask again every few weeks so you can see how your
              confidence changes.
            </p>
          </div>
          <CheckInForm />
        </div>
      </main>
    </>
  );
}
