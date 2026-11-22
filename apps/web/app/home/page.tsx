import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { getProfile } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

const steps = [
  {
    title: "Add your presentation",
    body: "Upload your slides and, if you have one, the marking rubric.",
  },
  {
    title: "Review your script",
    body: "We draft talking points and gesture cues for each slide.",
  },
  {
    title: "Rehearse and get feedback",
    body: "Practise in private and see your report about a minute later.",
  },
];

export default async function HomePage() {
  const { profile } = await getProfile();
  if (!profile.onboarded_at) redirect("/onboarding");

  // Phase 1: everyone sees the first-visit state until projects exist.
  return (
    <AppShell active="/home" displayName={profile.display_name}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">
            Welcome{profile.display_name ? `, ${profile.display_name}` : ""}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Three steps to your first rehearsal. Most people are ready in about 10 minutes.
          </p>
        </div>

        <ol className="rounded-[20px] border border-border bg-card px-7 pt-2 pb-6">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="flex items-start gap-4 border-t border-border py-[18px] first:border-t-0"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full font-bold",
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="flex flex-1 flex-col gap-1.5">
                <h2 className={cn("text-[17px] font-bold", i !== 0 && "text-muted-foreground")}>
                  {s.title}
                </h2>
                <p className="leading-relaxed text-muted-foreground">{s.body}</p>
                {i === 0 ? (
                  <Link
                    href="/projects/new"
                    className={cn(buttonVariants({ size: "lg" }), "mt-2 self-start")}
                  >
                    Create a project
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </AppShell>
  );
}
