import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { EXPORT_FORMAT_VERSION, EXPORT_LINK_TTL_S, exportFilename } from "@/lib/settings";

/**
 * Data export (spec F-06): everything we hold about the signed-in user as one JSON file.
 * Reads run under the user's session, so row-level security limits them to their own rows.
 * Uploaded files are included as signed download links that expire after 24 hours.
 */
export async function GET() {
  const { supabase, userId, email } = await requireUser();

  const [profile, consents, surveys, projects, decks, slides] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, university, field_of_study, goals, onboarded_at, created_at")
      .eq("id", userId)
      .single(),
    supabase
      .from("consents")
      .select("kind, granted, policy_version, created_at")
      .order("created_at"),
    supabase
      .from("confidence_surveys")
      .select("kind, instrument, items, created_at")
      .order("created_at"),
    supabase
      .from("projects")
      .select(
        "id, title, preset, time_limit_s, present_on, audience, qa_enabled, script_style, tone, status, created_at, updated_at",
      )
      .order("created_at"),
    supabase
      .from("decks")
      .select(
        "id, project_id, version, original_filename, file_size, mime_type, page_count, status, source_path, created_at",
      )
      .order("created_at"),
    supabase
      .from("slides")
      .select("deck_id, index, title, body_text, notes, visual_count")
      .order("deck_id")
      .order("index"),
  ]);

  const failed = [profile, consents, surveys, projects, decks, slides].find((r) => r.error);
  if (failed) {
    return NextResponse.json(
      { error: "We couldn't prepare your data. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const deckRows = decks.data ?? [];
  const signed = deckRows.length
    ? await supabase.storage.from("decks").createSignedUrls(
        deckRows.map((d) => d.source_path),
        EXPORT_LINK_TTL_S,
      )
    : { data: [], error: null };
  const linkByPath = new Map(
    (signed.data ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path, s.signedUrl]),
  );

  const now = new Date();
  const body = {
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: now.toISOString(),
    file_links_expire_at: new Date(now.getTime() + EXPORT_LINK_TTL_S * 1000).toISOString(),
    account: { email, ...profile.data },
    consents: consents.data,
    confidence_surveys: surveys.data,
    projects: (projects.data ?? []).map((p) => ({
      ...p,
      decks: deckRows
        .filter((d) => d.project_id === p.id)
        .map((d) => ({
          id: d.id,
          version: d.version,
          original_filename: d.original_filename,
          file_size: d.file_size,
          mime_type: d.mime_type,
          page_count: d.page_count,
          status: d.status,
          created_at: d.created_at,
          download_url: linkByPath.get(d.source_path) ?? null,
          slides: (slides.data ?? [])
            .filter((s) => s.deck_id === d.id)
            .map((s) => ({
              index: s.index,
              title: s.title,
              body_text: s.body_text,
              notes: s.notes,
              visual_count: s.visual_count,
            })),
        })),
    })),
    // Rehearsals, transcripts, scores and recordings are added here as those features ship.
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(now)}"`,
      "Cache-Control": "no-store",
    },
  });
}
