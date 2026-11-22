import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { getProfile } from "@/lib/auth/session";
import { formatMinutes, presetLabel } from "@/lib/projects";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

type Row = {
  id: string;
  title: string;
  preset: string;
  time_limit_s: number;
  present_on: string | null;
  decks: { status: string; page_count: number | null; version: number }[];
};

function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function subtitle(p: Row): string {
  const parts = [presetLabel(p.preset), formatMinutes(p.time_limit_s)];
  if (p.present_on) {
    const d = daysUntil(p.present_on);
    parts.push(
      d > 1
        ? `presenting in ${d} days`
        : d === 1
          ? "presenting tomorrow"
          : d === 0
            ? "presenting today"
            : "presented",
    );
  }
  return parts.join(" · ");
}

function deckStatus(p: Row): string {
  const deck = [...p.decks].sort((a, b) => b.version - a.version)[0];
  if (!deck) return "No slides yet";
  if (deck.status === "ready") return `${deck.page_count} slides`;
  if (deck.status === "failed") return "Slides need attention";
  return "Reading slides…";
}

export default async function ProjectsPage() {
  const { profile, supabase } = await getProfile();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, preset, time_limit_s, present_on, decks(status, page_count, version)")
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  const projects = (data ?? []) as Row[];

  return (
    <AppShell active="/projects" displayName={profile.display_name}>
      <div className="mx-auto flex max-w-[880px] flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Projects</h1>
          {projects.length > 0 ? (
            <Link href="/projects/new" className={buttonVariants()}>
              New project
            </Link>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-attention-soft px-4 py-3 text-attention-foreground"
          >
            We couldn&apos;t load your projects. Refresh to try again.
          </p>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-[20px] border border-border bg-card p-8">
            <h2 className="text-xl font-bold">No projects yet</h2>
            <p className="text-muted-foreground">
              A project holds one presentation: its slides, rubric, script and every rehearsal.
            </p>
            <Link href="/projects/new" className={cn(buttonVariants({ size: "lg" }), "mt-2")}>
              Create your first project
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-5 rounded-2xl border border-border bg-card px-6 py-5 hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate font-heading text-[17px] font-bold">{p.title}</span>
                    <span className="text-[13px] text-muted-foreground">{subtitle(p)}</span>
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{deckStatus(p)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
