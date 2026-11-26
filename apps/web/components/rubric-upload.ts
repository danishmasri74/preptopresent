"use client";

import { registerRubric } from "@/app/projects/actions";
import { rubricFileType, rubricPath } from "@/lib/rubrics";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads a rubric file straight from the browser to the user's private Storage folder, then
 * registers it so the worker reads the criteria. Returns an error message or null.
 */
export async function uploadRubric(file: File, userId: string, projectId: string) {
  const type = rubricFileType(file);
  if (!type) return "We can't read that file type. Upload a PDF, Word document or photo.";
  const rubricId = crypto.randomUUID();
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from("rubrics")
    .upload(rubricPath(userId, projectId, rubricId, type.ext), file, {
      contentType: type.mime,
      upsert: false,
    });
  if (uploadError) return "Your rubric didn't upload. Check your connection and try again.";

  const result = await registerRubric({
    projectId,
    rubricId,
    filename: file.name,
    size: file.size,
    mimeType: type.mime,
    ext: type.ext,
  });
  return result.ok ? null : result.message;
}
