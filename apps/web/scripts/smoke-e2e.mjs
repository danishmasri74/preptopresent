// End-to-end smoke test for the Phase 0 architecture.
//
// Proves: Supabase Auth -> enqueue_job() RPC -> jobs queue -> Python worker -> result readable
// by the owner under RLS, and NOT readable anonymously.
//
// Usage (from apps/web, with the worker running in another terminal):
//   node --env-file=.env.local scripts/smoke-e2e.mjs
//
// Creates a throwaway user with a random password and deletes it at the end.

import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  console.error("Missing env vars. Fill in apps/web/.env.local (see .env.example).");
  process.exit(1);
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, noSession);
const anon = createClient(url, publishableKey, noSession);
const user = createClient(url, publishableKey, noSession);

const email = `smoke-${randomUUID()}@example.com`;
const password = randomBytes(24).toString("base64url");
let userId;

function step(msg) {
  console.log(`- ${msg}`);
}

try {
  step("creating throwaway user");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  step("signing in");
  const signIn = await user.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;

  step("checking profile row was auto-created (trigger + RLS)");
  const profile = await user.from("profiles").select("id").single();
  if (profile.error || profile.data.id !== userId) throw profile.error ?? new Error("no profile");

  step("enqueueing ping job via enqueue_job()");
  const enq = await user.rpc("enqueue_job", { p_kind: "ping", p_payload: { message: "hello" } });
  if (enq.error) throw enq.error;
  const jobId = enq.data;

  step("rejecting a job kind that is not allow-listed");
  const bad = await user.rpc("enqueue_job", { p_kind: "drop_tables", p_payload: {} });
  if (!bad.error) throw new Error("expected enqueue_job to reject unknown kind");

  step("waiting for the worker (up to 30 s)");
  let job;
  for (let i = 0; i < 30; i++) {
    const r = await user.from("jobs").select("status, result, error").eq("id", jobId).single();
    if (r.error) throw r.error;
    job = r.data;
    if (job.status === "succeeded" || job.status === "failed") break;
    await new Promise((res) => setTimeout(res, 1000));
  }
  if (job.status !== "succeeded") {
    throw new Error(
      `job not succeeded (status=${job.status}, error=${job.error}). Is the worker running?`,
    );
  }
  if (job.result?.pong !== true || job.result?.echo !== "hello") {
    throw new Error(`unexpected result ${JSON.stringify(job.result)}`);
  }

  step("checking anonymous clients cannot read jobs (RLS)");
  const leaked = await anon.from("jobs").select("id").eq("id", jobId);
  if (leaked.error) throw leaked.error;
  if (leaked.data.length !== 0) throw new Error("RLS leak: anonymous client could read a job");

  console.log("\nPASS: auth, RLS, queue and worker work end to end.");
} catch (err) {
  console.error("\nFAIL:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  if (userId) {
    const del = await admin.auth.admin.deleteUser(userId);
    console.log(del.error ? `(cleanup failed: ${del.error.message})` : "- cleaned up test user");
  }
}
