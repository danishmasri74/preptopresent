// End-to-end check of rubric reading (spec F-14):
// sign in -> create project -> paste a rubric and upload a PDF rubric -> enqueue_job ->
// worker reads them -> criteria readable by the owner, invisible to another user, and
// another user can't queue a job for the owner's rubric.
//
// Usage (from apps/web, with the worker running; AI_MODE=mock costs nothing):
//   node --env-file=.env.local scripts/smoke-rubric.mjs
// Uses samples/rubrics. Cleans up after itself.

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

const sample = (name) => new URL(`../../../samples/rubrics/${name}`, import.meta.url);
const pdf = readFileSync(sample("fyp-presentation-rubric.pdf"));
const pasted = readFileSync(sample("rubric-pasted-text.txt"), "utf8");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);
const created = [];
const step = (m) => console.log(`- ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function waitForRubric(client, rubricId) {
  for (let i = 0; i < 45; i++) {
    const { data, error } = await client
      .from("rubrics")
      .select("status, error_code, model, prompt_version")
      .eq("id", rubricId)
      .single();
    if (error) throw error;
    if (data.status === "parsed" || data.status === "failed") return data;
    await sleep(2000);
  }
  throw new Error("timed out waiting for the worker (is it running?)");
}

try {
  step("creating two throwaway users");
  const owner = await newUser();
  const other = await newUser();

  const proj = await owner.client
    .from("projects")
    .insert({ user_id: owner.id, title: "Smoke rubric", preset: "fyp_viva", time_limit_s: 900 })
    .select("id")
    .single();
  if (proj.error) throw proj.error;
  const projectId = proj.data.id;

  step("pasting a rubric and queueing it");
  const pasteId = randomUUID();
  let r = await owner.client.from("rubrics").insert({
    id: pasteId,
    user_id: owner.id,
    project_id: projectId,
    source_kind: "paste",
    pasted_text: pasted,
  });
  if (r.error) throw r.error;
  r = await owner.client.rpc("enqueue_job", {
    p_kind: "parse_rubric",
    p_payload: { rubric_id: pasteId },
  });
  if (r.error) throw r.error;

  step("uploading a PDF rubric to the owner's private folder and queueing it");
  const fileId = randomUUID();
  const path = `${owner.id}/${projectId}/rubric-${fileId}.pdf`;
  r = await owner.client.storage
    .from("rubrics")
    .upload(path, pdf, { contentType: "application/pdf" });
  if (r.error) throw r.error;
  r = await owner.client.from("rubrics").insert({
    id: fileId,
    user_id: owner.id,
    project_id: projectId,
    source_kind: "file",
    source_path: path,
    original_filename: "fyp-presentation-rubric.pdf",
    mime_type: "application/pdf",
    file_size: pdf.length,
  });
  if (r.error) throw r.error;
  r = await owner.client.rpc("enqueue_job", {
    p_kind: "parse_rubric",
    p_payload: { rubric_id: fileId },
  });
  if (r.error) throw r.error;

  step("blocking a rubric row that claims a finished status (RLS insert check)");
  const forged = await owner.client.from("rubrics").insert({
    user_id: owner.id,
    project_id: projectId,
    source_kind: "paste",
    pasted_text: pasted,
    status: "parsed",
  });
  if (!forged.error) throw new Error("RLS leak: user inserted a rubric marked as parsed");

  step("blocking another user from queueing the owner's rubric");
  const sneaky = await other.client.rpc("enqueue_job", {
    p_kind: "parse_rubric",
    p_payload: { rubric_id: fileId },
  });
  if (!sneaky.error) throw new Error("enqueue_job leak: other user queued the owner's rubric");

  step("waiting for the worker to read both");
  for (const [id, expected] of [
    [pasteId, [15, 20, 25, 20, 20]],
    [fileId, [20, 25, 25, 20, 10]],
  ]) {
    const done = await waitForRubric(owner.client, id);
    if (done.status !== "parsed")
      throw new Error(`rubric ${id} ${done.status}: ${done.error_code}`);
    const { data: criteria, error } = await owner.client
      .from("rubric_criteria")
      .select("position, name, weight")
      .eq("rubric_id", id)
      .order("position");
    if (error) throw error;
    const weights = criteria.map((c) => Number(c.weight));
    if (JSON.stringify(weights) !== JSON.stringify(expected)) {
      throw new Error(`unexpected weights ${weights} (expected ${expected})`);
    }
    console.log(`  ${criteria.length} criteria, read by ${done.model} (${done.prompt_version})`);
  }

  step("checking the other user sees none of it (RLS)");
  const peek = await other.client.from("rubric_criteria").select("id").limit(1);
  const peekRubric = await other.client.from("rubrics").select("id").eq("id", fileId);
  const peekFile = await other.client.storage.from("rubrics").download(path);
  if (peek.data?.length || peekRubric.data?.length || !peekFile.error) {
    throw new Error("RLS leak: other user can see the owner's rubric");
  }

  console.log("\nRubric smoke test passed.");
} catch (err) {
  console.error("\nRubric smoke test FAILED:", err.message ?? err);
  process.exitCode = 1;
} finally {
  for (const id of created) {
    const files = await admin.storage.from("rubrics").list(id, { limit: 100 });
    for (const folder of files.data ?? []) {
      const inner = await admin.storage.from("rubrics").list(`${id}/${folder.name}`);
      const paths = (inner.data ?? []).map((f) => `${id}/${folder.name}/${f.name}`);
      if (paths.length) await admin.storage.from("rubrics").remove(paths);
    }
    await admin.auth.admin.deleteUser(id);
  }
}
