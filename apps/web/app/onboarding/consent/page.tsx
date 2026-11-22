import type { Metadata } from "next";
import { requireOnboarding } from "@/lib/auth/session";
import { OnboardingHeader } from "../_components";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Camera and microphone" };

const points = [
  {
    title: "Camera: analysed on your computer",
    body: "We track points on your face and upper body on your device. Only those numbers, like head angle and shoulder position, are sent to us.",
  },
  {
    title: "Microphone: sent securely for analysis",
    body: "Your audio goes to our speech and AI providers to make a transcript and feedback. They don't keep it or use it to train their models.",
  },
  {
    title: "Video: only if you choose",
    body: "Recordings are saved for playback only when you turn it on, and are deleted automatically after 90 days.",
  },
];

export default async function ConsentPage() {
  await requireOnboarding();
  return (
    <>
      <OnboardingHeader step={3} />
      <main className="flex-1 px-10 pt-4 pb-14">
        <div className="mx-auto flex max-w-[640px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">How we use your camera and microphone</h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Please read this before your first rehearsal. You can change your mind anytime in
              Settings.
            </p>
          </div>
          <ul className="rounded-[20px] border border-border bg-card px-7 py-1.5">
            {points.map((p) => (
              <li
                key={p.title}
                className="flex flex-col gap-1 border-t border-border py-4 first:border-t-0"
              >
                <strong>{p.title}</strong>
                <p className="leading-relaxed text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
          <ConsentForm />
        </div>
      </main>
    </>
  );
}
