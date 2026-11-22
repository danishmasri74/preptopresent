"use client";

import { registerDeck } from "@/app/projects/actions";
import { createClient } from "@/lib/supabase/client";
import { deckPath } from "@/lib/projects";

/**
 * Uploads a PDF straight from the browser to the user's private Storage folder, then
 * registers it so the worker extracts the slides. Returns an error message or null.
 */
export async function uploadDeck(file: File, userId: string, projectId: string) {
  const deckId = crypto.randomUUID();
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("decks")
    .upload(deckPath(userId, projectId, deckId), file, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    return "Your slides didn't upload. Check your connection and try again.";
  }

  const result = await registerDeck({
    projectId,
    deckId,
    filename: file.name,
    size: file.size,
    mimeType: "application/pdf",
  });
  return result.ok ? null : result.message;
}
