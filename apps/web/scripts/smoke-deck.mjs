// End-to-end check of the slide pipeline (spec F-11, F-12):
// sign in -> create project -> upload PDF to Storage -> register deck -> enqueue_job ->
// worker extracts -> slides + images readable by the owner, invisible to another user.
//
// Usage (from apps/web, with the worker running):
//   node --env-file=.env.local scripts/smoke-deck.mjs
// Uses services/worker/tests/fixtures/sample-deck.pdf (3 slides). Cleans up after itself.

import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) {
  console.error("Missing env vars. Fill in apps/web/.env.local.");
  process.exit(1);
}

const pdf = readFileSync(
  new URL("../../../services/worker/tests/fixtures/sample-deck.pdf", import.meta.url),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);
const created = [];
const step = (m) => console.log(`- ${m}`);

async function newUser() {
  const email = `smoke-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error) throw r.error;
  created.push(r.data.user.id);
  const client = createClient(url, publishableKey, opts);
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { client, id: r.data.user.id };
}

try {
  step("creating two throwaway users");
  const owner = await newUser();
  const other = await newUser();

  step("creating a project (RLS insert)");
  const proj = await owner.client
    .from("projects")
    .insert({ user_id: owner.id, title: "Smoke deck", preset: "fyp_viva", time_limit_s: 900 })
    .select("id")
    .single();
  if (proj.error) throw proj.error;
  const projectId = proj.data.id;

  step("uploading the PDF to the owner's private folder");
  const deckId = randomUUID();
  const path = `${owner.id}/${projectId}/${deckId}.pdf`;
  const up = await owner.client.storage
    .from("decks")
    .upload(path, pdf, { contentType: "application/pdf" });
  if (up.error) throw up.error;

  step("blocking uploads into someone else's folder (storage RLS)");
  const sneaky = await other.client.storage
    .from("decks")
    .upload(`${owner.id}/${projectId}/${randomUUID()}.pdf`, pdf, {
      contentType: "application/pdf",
    });
  if (!sneaky.error) throw new Error("storage RLS leak: other user wrote into owner's folder");

  step("registering the deck and queueing extraction");
  const deck = await owner.client.from("decks").insert({
    id: deckId,
    user_id: owner.id,
    project_id: projectId,
    source_path: path,
    original_filename: "sample-deck.pdf",
    file_size: pdf.length,
    mime_type: "application/pdf",
  });
  if (deck.error) throw deck.error;
  const job = await owner.client.rpc("enqueue_job", {
    p_kind: "ingest_deck",
    p_payload: { deck_id: deckId },
  });
  if (job.error) throw job.error;

  step("refusing to queue a job for someone else's deck");
  const stolen = await other.client.rpc("enqueue_job", {
    p_kind: "ingest_deck",
    p_payload: { deck_id: deckId },
  });
  if (!stolen.error) throw new Error("enqueue_job accepted another user's deck");

  step("waiting for the worker (up to 60 s)");
  let status;
  for (let i = 0; i < 60; i++) {
    const r = await owner.client
      .from("decks")
      .select("status, page_count, error_code")
      .eq("id", deckId)
      .single();
    if (r.error) throw r.error;
    status = r.data;
    if (status.status === "ready" || status.status === "failed") break;
    await new Promise((res) => setTimeout(res, 1000));
  }
  if (status.status !== "ready")
    throw new Error(`deck not ready: ${JSON.stringify(status)}. Is the worker running?`);
  if (status.page_count !== 3) throw new Error(`expected 3 pages, got ${status.page_count}`);

  step("checking slide rows and titles");
  const slides = await owner.client
    .from("slides")
    .select("index, title, body_text, image_path")
    .eq("deck_id", deckId)
    .order("index");
  if (slides.error) throw slides.error;
  const titles = slides.data.map((s) => s.title);
  if (JSON.stringify(titles) !== JSON.stringify(["PrepToPresent", "Methodology", "Results"])) {
    throw new Error(`unexpected titles ${JSON.stringify(titles)}`);
  }

  step("checking slide images load through a signed URL");
  const signed = await owner.client.storage
    .from("slide-images")
    .createSignedUrl(slides.data[1].image_path, 60);
  if (signed.error) throw signed.error;
  const img = await fetch(signed.data.signedUrl);
  const bytes = new Uint8Array(await img.arrayBuffer());
  if (!img.ok || bytes[0] !== 0x89 || bytes[1] !== 0x50)
    throw new Error("slide image is not a PNG");

  step("checking another user sees none of it (RLS)");
  const leakProject = await other.client.from("projects").select("id").eq("id", projectId);
  const leakSlides = await other.client.from("slides").select("id").eq("deck_id", deckId);
  const leakImage = await other.client.storage
    .from("slide-images")
    .createSignedUrl(slides.data[0].image_path, 60);
  if (leakProject.data?.length || leakSlides.data?.length || !leakImage.error) {
    throw new Error("RLS leak: another user could see the project, slides or images");
  }

  console.log("\nPASS: upload, extraction, images and isolation all work end to end.");
} catch (err) {
  console.error("\nFAIL:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  for (const id of created) {
    for (const bucket of ["decks", "slide-images"]) {
      const list = await admin.storage.from(bucket).list(id, { limit: 100 });
      for (const projectFolder of list.data ?? []) {
        const inner = await admin.storage
          .from(bucket)
          .list(`${id}/${projectFolder.name}`, { limit: 100 });
        const paths = [];
        for (const entry of inner.data ?? []) {
          if (entry.id) paths.push(`${id}/${projectFolder.name}/${entry.name}`);
          else {
            const deep = await admin.storage
              .from(bucket)
              .list(`${id}/${projectFolder.name}/${entry.name}`, { limit: 100 });
            for (const f of deep.data ?? [])
              paths.push(`${id}/${projectFolder.name}/${entry.name}/${f.name}`);
          }
        }
        if (paths.length) await admin.storage.from(bucket).remove(paths);
      }
    }
    await admin.auth.admin.deleteUser(id);
  }
  console.log("- cleaned up test users and files");
}
