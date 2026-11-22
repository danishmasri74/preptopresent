"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { deckPath, newProjectSchema, registerDeckSchema } from "@/lib/projects";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

const GENERIC = "Something went wrong. Please try again.";

export async function createProject(
  formData: FormData,
): Promise<ActionResult<{ projectId: string; userId: string }>> {
  const parsed = newProjectSchema.safeParse({
    title: formData.get("title"),
    preset: formData.get("preset"),
    time_limit_min: formData.get("time_limit_min"),
    present_on: formData.get("present_on") ?? "",
    audience: formData.get("audience") ?? "",
    qa_enabled: formData.get("qa_enabled") === "yes",
    script_style: formData.get("script_style"),
    tone: formData.get("tone"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const { supabase, userId } = await requireUser();
  const p = parsed.data;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      title: p.title,
      preset: p.preset,
      time_limit_s: p.time_limit_min * 60,
      present_on: p.present_on ?? null,
      audience: p.audience ?? null,
      qa_enabled: p.qa_enabled,
      script_style: p.script_style,
      tone: p.tone,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: GENERIC };

  revalidatePath("/projects");
  return { ok: true, data: { projectId: data.id, userId } };
}

/**
 * Called after the browser has uploaded the PDF to Storage. Records the deck and queues
 * extraction. RLS + enqueue_job() re-check ownership server-side.
 */
export async function registerDeck(input: {
  projectId: string;
  deckId: string;
  filename: string;
  size: number;
  mimeType: string;
}): Promise<ActionResult<null>> {
  const parsed = registerDeckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That upload looks invalid." };
  const { projectId, deckId, filename, size, mimeType } = parsed.data;

  const { supabase, userId } = await requireUser();

  const { data: latest } = await supabase
    .from("decks")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("decks").insert({
    id: deckId,
    user_id: userId,
    project_id: projectId,
    version: (latest?.version ?? 0) + 1,
    source_path: deckPath(userId, projectId, deckId),
    original_filename: filename,
    file_size: size,
    mime_type: mimeType,
  });
  if (error) return { ok: false, message: GENERIC };

  const { error: jobError } = await supabase.rpc("enqueue_job", {
    p_kind: "ingest_deck",
    p_payload: { deck_id: deckId },
  });
  if (jobError) return { ok: false, message: GENERIC };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: null };
}
