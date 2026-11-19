# PrepToPresent: Architecture

> Status: v1.0 draft, 2026-11-16. Describes _how_ we build what [spec.md](spec.md) defines. Feature IDs (F-xx) refer to the spec.

## 1. System overview

```
┌──────────────────────── Browser (user's laptop) ────────────────────────┐
│  Next.js app (React, TypeScript)                                          │
│   ├─ UI: prep, setup, live rehearsal, reports                             │
│   ├─ Vision worker (Web Worker): MediaPipe face + pose @10 fps (adaptive) │
│   │     → compact feature time series (no images leave the device)        │
│   ├─ MediaRecorder: audio (Opus) + optional video (VP9) in 5 s chunks     │
│   └─ IndexedDB buffer → resumable (TUS) uploads                           │
└───────────────┬───────────────────────────────────────┬──────────────────┘
                │ HTTPS (auth'd)                        │ TUS uploads
┌───────────────▼──────────────┐         ┌──────────────▼───────────────┐
│ Next.js server (Vercel)      │         │ Supabase                      │
│  route handlers / actions    │◄───────►│  Auth (Google, email link)    │
│  validation, rate limits     │         │  Postgres + RLS (+ job queue) │
│  enqueue jobs                │         │  Storage (private buckets)    │
└──────────────────────────────┘         │  Realtime (job progress)      │
                                         └──────────────▲───────────────┘
                                                        │ jobs / results
                                ┌───────────────────────┴───────────────┐
                                │ Python worker (FastAPI + job runner)    │
                                │  slides: LibreOffice → PDF → PyMuPDF    │
                                │  speech: Deepgram (transcript, fillers) │
                                │  prosody: parselmouth (F0, intensity)   │
                                │  scoring: deterministic, versioned      │
                                │  AI: Claude API (scripts, rubric,       │
                                │      feedback, Q&A)  · TTS: ElevenLabs  │
                                └─────────────────────────────────────────┘
```

**Why this split.** The browser does real-time body tracking: it's private, free, and was measured fast enough (see §5.1). The Python worker does heavy or long jobs (document conversion, audio analysis, AI calls) off the request path. Supabase gives production-grade auth, database security (RLS), storage and realtime without us building them.

## 2. Tech stack

| Layer               | Choice                                                                                                                              | Notes                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Web app             | **Next.js (App Router) + TypeScript (strict)**                                                                                      | Hosted on Vercel                                                                                                   |
| UI                  | **Tailwind CSS + shadcn/ui + Framer Motion**                                                                                        | Design tokens match the UX canvas (indigo `#3846C4`, amber `#C25E14`, ground `#F6F6F3`, Plus Jakarta Sans + Inter) |
| Data fetching       | Server components + server actions; TanStack Query for client polling-free updates via Supabase Realtime                            |                                                                                                                    |
| Validation          | **Zod** at every boundary (forms, route handlers, AI outputs)                                                                       |                                                                                                                    |
| Auth / DB / storage | **Supabase** (Postgres 15+, RLS, Storage with TUS resumable uploads, Realtime)                                                      | Migrations via Supabase CLI                                                                                        |
| Job queue           | **Postgres-backed queue** (`jobs` table with `FOR UPDATE SKIP LOCKED`)                                                              | No Redis needed; idempotent jobs with retries                                                                      |
| Worker              | **Python 3.12, FastAPI, uv** in Docker (includes LibreOffice)                                                                       | Hosted on Railway / Fly.io / Render                                                                                |
| Vision              | **MediaPipe Tasks Vision** (Face Landmarker, Pose Landmarker lite) in a Web Worker                                                  | GPU delegate, CPU fallback                                                                                         |
| Speech-to-text      | **Deepgram** (pre-recorded, Nova family model) with word timestamps, confidence, filler words kept                                  | Streaming API only if live nudges (F-26) ship                                                                      |
| Prosody             | **Praat via parselmouth** (F0, intensity)                                                                                           |                                                                                                                    |
| LLM                 | **Claude API, `claude-opus-5-5`** via the official Anthropic SDKs (Python in the worker, TypeScript only if needed in the web tier) | See §7                                                                                                             |
| Text-to-speech      | **ElevenLabs** (streaming) for examiner voices                                                                                      | V1 (Q&A)                                                                                                           |
| Monitoring          | Sentry (web + worker), structured JSON logs                                                                                         |                                                                                                                    |
| Testing             | Vitest + Testing Library, Playwright (e2e), pytest                                                                                  | CI on GitHub Actions                                                                                               |

## 3. Repository layout

```
PrepToPresent/
├─ apps/web/              Next.js app
│  ├─ app/                routes (auth, onboarding, dashboard, projects, prep, rehearse, reports)
│  ├─ components/         UI components (shadcn/ui based)
│  ├─ features/           feature modules (prep, rehearsal, report, qa)
│  ├─ lib/                supabase clients, api helpers, scoring display helpers
│  └─ workers/            vision.worker.ts (MediaPipe)
├─ services/worker/       Python worker
│  ├─ app/jobs/           slides, rubric, script, analyze_session, qa
│  ├─ app/scoring/        versioned scoring configs + metric functions
│  └─ tests/              unit + golden-file tests (sample audio/feature files)
├─ packages/schemas/      JSON Schemas shared by web (Zod) and worker (Pydantic)
├─ supabase/              migrations, seed, RLS policies, storage policies
├─ docs/                  spec.md, architecture.md, decisions/ (ADRs)
└─ spikes/                throwaway experiments (vision-benchmark)
```

## 4. Data model (Postgres)

All tables carry `id uuid`, `created_at`, `updated_at`; user-owned tables carry `user_id` with an RLS policy `user_id = auth.uid()`.

| Table                | Key columns                                                                                                                      | Notes                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `profiles`           | name, university, field, goals[]                                                                                                 | 1:1 with auth user                                   |
| `consents`           | kind (analysis, age, save_video_default, study), granted, policy_version                                                         | Append-only history                                  |
| `confidence_surveys` | instrument, items jsonb, total, taken_at                                                                                         | Baseline and periodic                                |
| `projects`           | title, preset, time_limit_s (60–900), present_on, audience, qa_enabled, script_style, tone, status (active/archived)             |                                                      |
| `decks`              | project_id, version, source_path, page_count, status                                                                             | New row per upload (F-19)                            |
| `slides`             | deck_id, index, title, text, notes, visual_count, image_path, content_hash                                                       | `content_hash` matches unchanged slides on re-upload |
| `rubrics`            | project_id, source_path, raw_text, status (parsed/confirmed)                                                                     |                                                      |
| `rubric_criteria`    | rubric_id, name, weight, descriptors, position                                                                                   | Weights sum to 100 (checked)                         |
| `scripts`            | project_id, deck_id, version, style, tone                                                                                        |                                                      |
| `script_segments`    | script_id, slide_id, text, keywords[], est_seconds, budget_seconds, criteria_ids[]                                               | Budget editable (F-17)                               |
| `gesture_cues`       | segment_id, gesture_id, anchor_offset                                                                                            | `gesture_id` from fixed library                      |
| `sessions`           | project_id, type (full/range/qa/practice), slide_from, slide_to, settings jsonb, status, duration_s, audio_only, scoring_version |                                                      |
| `session_checkins`   | session_id, phase (pre/post), confidence 1–5                                                                                     |                                                      |
| `session_media`      | session_id, audio_path, video_path (nullable), delete_after                                                                      | Retention job deletes media, keeps results           |
| `slide_events`       | session_id, t_ms, slide_index, kind (enter/pause/resume)                                                                         |                                                      |
| `transcripts`        | session_id, words jsonb (word, start, end, confidence, filler), provider, model                                                  |                                                      |
| `prosody_tracks`     | session_id, f0 (compressed), intensity (compressed), hop_ms                                                                      |                                                      |
| `vision_tracks`      | session_id, features (compressed), fps, coverage                                                                                 | Per-frame feature vector (§5.2)                      |
| `metrics`            | session_id, key, value, confidence, slide_index (nullable), scoring_version                                                      | One row per metric (and per slide where relevant)    |
| `scores`             | session_id, category, value, scoring_version                                                                                     | Plus `overall`                                       |
| `moments`            | session_id, t_ms, kind, polarity (positive/needs_work), detail                                                                   | Feeds "moments to review"                            |
| `feedback`           | session_id, overview jsonb, model, prompt_version                                                                                | Structured AI output                                 |
| `qa_drills`          | project_id, persona, question_count, status                                                                                      |                                                      |
| `qa_items`           | drill_id, question, audio_path, transcript, evaluation jsonb                                                                     |                                                      |
| `jobs`               | kind, payload jsonb, status, attempts, run_after, error, user_id                                                                 | Queue + progress (Realtime)                          |

**Storage buckets (all private):** `decks`, `slide-images`, `rubrics`, `recordings` (audio/video), `qa-audio`. Paths are prefixed with `user_id/` and protected by storage policies; the client only gets short-lived signed URLs.

## 5. Rehearsal pipeline

### 5.1 Measured baseline

`spikes/vision-benchmark` (2026-11-16, i5-12450H laptop, browser on Intel integrated GPU, 720p, recording on): face + pose = **34 ms/frame on GPU, 52 ms on CPU at 10 fps, zero dropped frames**. 30 fps hits ~92% of budget, so 10 fps is the design rate. Untested on old 4-thread laptops; the adaptive rate (below) covers that and should be verified on one.

### 5.2 In the browser (during the run)

1. **Capture:** `getUserMedia` (720p, chosen devices). `MediaRecorder` records **audio-only Opus ~32 kbps** always, and **video VP9 ~1 Mbps** only if saving is on. 5 s chunks are written to IndexedDB and uploaded via TUS as they're produced.
2. **Vision worker:** frames are passed as `ImageBitmap` (transferable) to a Web Worker running Face and Pose Landmarker. Target 10 fps; if the average budget use is > 70% for 5 s, drop to 5 fps. The worker computes a **compact feature vector per frame**: head yaw/pitch/roll, gaze proxy, face present, shoulder tilt, nose–shoulder distance, wrist positions/visibility, a few expression blendshapes, and a tracking-quality flag. Raw landmarks are not stored or uploaded (data minimisation). Features are batched and uploaded compressed.
3. **Calibration:** during setup, capture the "looking at camera" head pose and an upright posture baseline (2 s each). Eye contact and posture are measured relative to these.
4. **Timeline:** slide enter/pause/resume events with timestamps relative to recording start.
5. **Live warnings:** time-left from the timeline; "can't see you" when face/pose is missing for > 3 s; spans are flagged in the feature stream.
6. **Finish:** final chunks flushed and uploaded → `POST /api/sessions/:id/complete` enqueues `analyze_session`. If offline, the upload queue resumes automatically (F-31).

### 5.3 In the worker (`analyze_session` job)

Stages run in this order, writing results as they finish so the report fills in progressively (published via Realtime on the `jobs` row):

| Stage               | Work                                                                                                 | Typical time (15 min run) |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------- |
| 1. Body & timing    | Score vision features + slide timing (no external calls)                                             | < 3 s                     |
| 2. Transcribe       | Deepgram pre-recorded on the audio file: words, timestamps, confidence, filler words                 | ~10–30 s                  |
| 3. Prosody          | parselmouth F0 + intensity (in parallel with 2)                                                      | ~3–5 s                    |
| 4. Speech metrics   | Pace, pauses, fillers (+ discourse-filler classification), clarity, pitch variety, volume, per slide | < 2 s                     |
| 5. Content          | Claude: rubric coverage + structure from transcript (structured output)                              | ~10–25 s                  |
| 6. Scores & moments | Apply scoring config → `metrics`, `scores`, `moments`                                                | < 1 s                     |
| 7. Feedback         | Claude: overview summary, 2 strengths, 2 focus areas citing moments (structured output)              | ~10–20 s                  |

Target total ≤ 90 s p90 (spec §7). Every stage is idempotent and can be re-run, which is also how a new scoring version re-scores old sessions (stages 4–7 only).

## 6. Prep pipeline

1. **Deck ingest (`ingest_deck`):** PPTX → PDF via headless LibreOffice; render each page to PNG (PyMuPDF); extract text (PyMuPDF) and speaker notes and titles (python-pptx for PPTX); count images and charts; compute `content_hash` per slide. Scanned PDFs with no text → fall back to Claude vision on the slide images, or show an extraction-failure state (F-13).
2. **Rubric parse (`parse_rubric`):** extract text (PDF/DOCX); images go to Claude vision. Claude returns criteria as structured output. The user confirms them on Rubric review (F-15).
3. **Script generation (`generate_script`):** Claude receives slides, notes, rubric criteria, project settings and the gesture library; returns per-slide `{text, keywords[], est_seconds, criteria_ids[], gesture_cues[{gesture_id, anchor_text}]}` as structured output. Default budgets are proportional to estimated time and scaled to the time limit.
4. **Gesture library (initial):** `open_palms`, `count_fingers`, `point_to_slide`, `size_big_small`, `compare_hands` (one hand then the other), `steeple`, `hand_to_chest` (personal point), `sweep` (overview), `pause_reset` (hands down, posture reset). Each gesture is a JSON keyframe sequence of joint angles for a 2D SVG rig (torso, upper arms, forearms, hands) played with Framer Motion. Adding a gesture = adding data, not code.
5. **Deck re-upload (F-19):** match slides by `content_hash` (then by title similarity); unchanged slides keep segments and budgets; changed and new slides are flagged for regeneration.

## 7. AI design (Claude API)

| Use               | Input                                                       | Output                                                              | Notes                                                             |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Rubric parsing    | Rubric text or image                                        | Criteria (name, weight, descriptors)                                | Structured output                                                 |
| Script generation | Slides, notes, rubric, settings, gesture library            | Per-slide script segments                                           | Structured output; streaming; deck context cached for later edits |
| Script edits      | Segment + instruction (shorten, conversational, regenerate) | New segment                                                         | Reuses cached deck context                                        |
| Content analysis  | Transcript, slide timeline, rubric                          | Coverage per criterion, structure checks                            | Structured output                                                 |
| Session feedback  | Computed metrics, moments, coverage, user goals             | Overview summary, strengths, focus areas                            | Structured output; may only cite provided data                    |
| Q&A questions     | Slides, script, rubric, persona                             | Question list                                                       | Structured output                                                 |
| Q&A evaluation    | Question, answer transcript, project context                | Relevance, completeness, length verdict, feedback, stronger example | Structured output                                                 |

**Conventions** (check the `claude-api` skill before writing AI code; the API changes often):

- Model: **`claude-opus-5-5`** for all uses by default. Moving any route to a cheaper model (e.g. Sonnet or Haiku) or a lower effort level is a product decision for the project owner, made per route and backed by an eval set.
- Adaptive thinking (Opus 5.5 can't disable thinking); set `output_config.effort` explicitly per route (Opus 5.5 defaults to `medium`).
- Structured outputs via `output_config.format` / `messages.parse()` with JSON Schemas from `packages/schemas`. Forced `tool_choice` isn't available on this model, and assistant prefill isn't supported.
- Streaming for long outputs (script generation).
- Refusal handling: check `stop_reason` before reading content; use server-side fallbacks (`fallbacks: "default"` with the beta header).
- Prompt caching: stable system prompt + deck/rubric context first, volatile content last.
- All user-provided text (slides, rubric, transcript) is wrapped in clearly delimited data blocks and treated as untrusted (prompt-injection safe).
- Prompts are versioned files in the worker (`prompt_version` stored with outputs). Log token usage and cost per call.

## 8. Security & privacy

- **Auth:** Supabase Auth (Google OAuth, email magic link). Sessions via HTTP-only cookies (Supabase SSR helpers).
- **Authorisation:** RLS on every table; storage policies on every bucket; the worker uses a service role key that is never exposed to the browser.
- **Secrets:** Anthropic, Deepgram and ElevenLabs keys live only in worker/server environment variables. `.env*` is git-ignored; `.env.example` documents names only.
- **Uploads:** validate MIME type and magic bytes, size (≤ 100 MB deck, ≤ 20 MB rubric), page count (≤ 60); convert documents in a sandboxed container without network access.
- **Consent gating:** camera/mic analysis can't start without a valid `consents` row for the current policy version.
- **Retention:** a nightly job deletes media past `delete_after`; account deletion cascades to all rows and storage objects.
- **Providers:** configure no-retention / no-training options where offered; list providers in the privacy policy.
- **Rate limits:** per-user limits on script generation, Q&A and session analysis to cap abuse and cost.

## 9. Environments & delivery

- **Local:** Next.js dev server; Supabase (hosted dev project, or local via Supabase CLI, which needs Docker Desktop); worker via `uv run` or Docker.
- **Staging** and **production:** separate Supabase projects, Vercel environments, worker deployments, and provider keys.
- **CI (GitHub Actions):** typecheck, lint, unit tests (web + worker), migration check, Playwright smoke on staging.
- **Decisions:** significant choices are recorded as short ADRs in `docs/decisions/`.

## 10. Testing strategy

- **Scoring:** pure functions with golden-file tests (fixed feature/transcript inputs → exact metric values). Any change to a golden output requires a scoring version bump.
- **Worker jobs:** pytest with recorded provider responses (no live API calls in CI).
- **Web:** component tests for key states (empty, loading, error, blocked, offline); Playwright e2e for sign-up → project → rehearsal (fake media stream) → report.
- **AI quality:** small eval sets for script generation, feedback and Q&A evaluation before changing prompts or models.
- **Accessibility:** axe checks in Playwright; manual keyboard pass per release.

## 11. Cost model (initial estimate, to be measured)

Per 15-min full run: transcription (~15 audio minutes), 2 Claude calls (content analysis + feedback, ~10–15k input / ~2–3k output tokens each), storage (~2 MB audio features + optional ~110 MB video). Expected order of magnitude: **US$0.10–0.25 per run** before any optimisation. Script generation and Q&A are separate per-use costs. Real numbers come from usage logging (§7).

## 12. Delivery phases

| Phase             | Scope                                                                                                                                                                            | Exit criteria                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 0. Setup          | Monorepo scaffold, Supabase project, CI, design tokens, CLAUDE.md commands                                                                                                       | `pnpm dev` + worker run locally; CI green                     |
| 1. Foundation     | Auth, onboarding (F-01–04), projects (F-10–11), deck ingest (F-12–13), settings privacy (F-06)                                                                                   | A user can sign up, create a project and see extracted slides |
| 2. AI prep        | Rubric parse + review (F-14–15), script generation + prep workspace (F-16–17)                                                                                                    | Script generated and editable for a real deck                 |
| 3. Rehearsal core | Setup (F-20–22), live (F-24–25), recording + resumable upload (F-31), speech pipeline + report overview / slides / transcript (F-30, F-32, F-34–35), history + compare (F-39–41) | End-to-end audio rehearsal with scores and feedback in ≤ 90 s |
| 4. Body language  | Vision worker + calibration, body metrics, playback lanes (F-33), gesture rig + cues (F-18)                                                                                      | Body-language scores + gesture cues live                      |
| 5. Engagement     | Warmup (F-23), Q&A drill (F-50–53), nudges/countdown/practice (F-26–28), rubric tab, data-quality notices, practise-this (F-36–38), deck re-upload (F-19)                        | All V1 features complete                                      |
| 6. Hardening      | Accessibility audit, performance on low-end laptops, security review, retention jobs, evaluation study                                                                           | Spec §7 requirements verified                                 |
