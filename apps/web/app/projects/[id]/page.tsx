import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth/session";
import { DECK_ERROR_MESSAGES, bodyPreview, formatMinutes, presetLabel } from "@/lib/projects";
import type { RubricCriterion } from "@/lib/rubrics";
import { DeckUploader, ProcessingWatcher } from "./deck-panels";
import { RubricPanel, type RubricSummary } from "./rubric-panel";

export const metadata: Metadata = { title: "Project" };

type Deck = {
  id: string;
  version: number;
  status: "uploaded" | "processing" | "ready" | "failed";
  error_code: string | null;
  page_count: number | null;
  original_filename: string;
  created_at: string;
};

type Slide = {
  id: string;
  index: number;
  title: string | null;
  body_text: string;
  image_path: string | null;
};

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const { upload } = await searchParams;
  const { supabase, userId } = await getProfile();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, preset, time_limit_s")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: deckRow } = await supabase
    .from("decks")
    .select("id, version, status, error_code, page_count, original_filename, created_at")
    .eq("project_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const deck = deckRow as Deck | null;

  const { data: rubricRow } = await supabase
    .from("rubrics")
    .select(
      "id, status, error_code, source_kind, original_filename, weights_suggested, model, created_at",
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rubric = rubricRow as RubricSummary | null;
  let criteria: RubricCriterion[] = [];
  if (rubric?.status === "parsed" || rubric?.status === "confirmed") {
    const { data } = await supabase
      .from("rubric_criteria")
      .select("id, position, name, weight, description")
      .eq("rubric_id", rubric.id)
      .order("position");
    criteria = (data ?? []) as RubricCriterion[];
  }

  let slides: (Slide & { imageUrl: string | null })[] = [];
  if (deck?.status === "ready") {
    const { data } = await supabase
      .from("slides")
      .select("id, index, title, body_text, image_path")
      .eq("deck_id", deck.id)
      .order("index");
    const rows = (data ?? []) as Slide[];
    const paths = rows.map((s) => s.image_path).filter((p): p is string => Boolean(p));
    const { data: signed } = paths.length
      ? await supabase.storage.from("slide-images").createSignedUrls(paths, 3600)
      : { data: [] };
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    slides = rows.map((s) => ({
      ...s,
      imageUrl: s.image_path ? (urlByPath.get(s.image_path) ?? null) : null,
    }));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center gap-4 border-b border-border px-7 py-3">
        <Link
          href="/projects"
          aria-label="Back to projects"
          className="flex size-11 items-center justify-center rounded-xl text-primary hover:bg-muted"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-bold">{project.title}</h1>
          <p className="text-[13px] text-muted-foreground">
            {presetLabel(project.preset)} · {formatMinutes(project.time_limit_s)} limit
            {deck?.status === "ready" ? ` · ${deck.page_count} slides` : ""}
          </p>
        </div>
      </header>

      <main className="flex-1 px-10 py-8">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6">
          {!deck ? (
            <DeckUploader
              userId={userId}
              projectId={id}
              heading="Add your slides"
              intro="Upload your deck as a PDF. We'll read each slide so we can draft your script."
              initialError={
                upload === "failed"
                  ? "Your project was created, but the slides didn't upload. Please try again."
                  : null
              }
            />
          ) : deck.status === "uploaded" || deck.status === "processing" ? (
            <ProcessingWatcher startedAt={deck.created_at} />
          ) : deck.status === "failed" ? (
            <DeckUploader
              userId={userId}
              projectId={id}
              heading="We couldn't read those slides"
              intro={DECK_ERROR_MESSAGES[deck.error_code ?? ""] ?? DECK_ERROR_MESSAGES.internal}
            />
          ) : (
            <>
              {deck.error_code === "no_text" ? (
                <p className="rounded-xl bg-attention-soft px-4 py-3 text-sm text-attention-foreground">
                  We couldn&apos;t find any text in this PDF (it may be scanned images). Your script
                  will be less accurate. Exporting the PDF straight from PowerPoint or Google Slides
                  usually fixes this.
                </p>
              ) : null}
              <RubricPanel
                key={rubric?.id ?? "none"}
                userId={userId}
                projectId={id}
                rubric={rubric}
                criteria={criteria}
              />
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-bold">Your slides</h2>
                <p className="text-sm text-muted-foreground">
                  From {deck.original_filename}. Script drafting comes next.
                </p>
              </div>
              <ol className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {slides.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs; next/image adds nothing here
                      <img
                        src={s.imageUrl}
                        alt={`Slide ${s.index}${s.title ? `: ${s.title}` : ""}`}
                        className="aspect-video w-full border-b border-border object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-video w-full bg-muted" aria-hidden="true" />
                    )}
                    <div className="flex flex-col gap-1 p-4">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Slide {s.index}
                      </span>
                      <span className="line-clamp-1 font-semibold">
                        {s.title ?? "Untitled slide"}
                      </span>
                      {bodyPreview(s.title, s.body_text) ? (
                        <span className="line-clamp-2 text-sm text-muted-foreground">
                          {bodyPreview(s.title, s.body_text)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
