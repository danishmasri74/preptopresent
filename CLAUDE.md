# PrepToPresent

Desktop web app that helps university students rehearse presentations and get objective feedback (voice, language, body language, content, timing). Final-year project built to commercial-ready quality.

- **What we build:** [docs/spec.md](docs/spec.md) (feature IDs F-xx, scoring framework, non-functional requirements)
- **How we build it:** [docs/architecture.md](docs/architecture.md) (stack, data model, pipelines, AI conventions, phases)
- **UX designs:** PrepToPresent UX Flow canvas: https://claude.ai/artifact/AKFuEWoKLaof4GJQgfdyc6

Read the relevant spec and architecture sections before starting a feature. If code and docs disagree, raise it; don't silently diverge. Update the docs in the same change when a decision changes.

## Fixed product decisions

- Solo presentations only; talks 1–15 minutes (no score under 1 minute; auto-stop at the limit).
- Desktop web only (no mobile layouts needed); latest Chrome, Edge, Firefox.
- Body tracking runs in the browser (MediaPipe in a Web Worker, 10 fps adaptive to 5). Raw video and landmarks never leave the device; only compact feature vectors do. Video is uploaded only if the user opted in.
- Scores are recomputable from stored raw data and always carry a `scoring_version`. Changing any threshold or weight bumps the version.

## Stack

Next.js (App Router, TypeScript strict) + Tailwind + shadcn/ui + Framer Motion · Supabase (Auth, Postgres + RLS, Storage, Realtime) · Python 3.12 worker (FastAPI, uv) · Deepgram · parselmouth · Claude API · ElevenLabs (Q&A voices).

## Commands

_To be filled in during Phase 0 scaffolding._

## Conventions

**General**
- Validate every boundary with Zod (web) / Pydantic (worker). Shared JSON Schemas live in `packages/schemas`.
- Every user-owned table has `user_id` and an RLS policy; every storage bucket is private with path-prefix policies. No exceptions.
- Secrets (Anthropic, Deepgram, ElevenLabs, Supabase service role) only in server or worker env vars. Never in client code, logs or commits. `.env.example` lists names only.
- Database changes only through Supabase migrations in `supabase/migrations`.
- Jobs must be idempotent and safe to retry.

**AI (Claude API)**
- Load the `claude-api` skill before writing or changing any Claude API code; the API changes often.
- Default model `claude-opus-5-5`, adaptive thinking, explicit `output_config.effort`, structured outputs, refusal handling with server-side fallbacks. Switching a route to a cheaper model is the project owner's decision.
- Slide text, rubric text and transcripts are untrusted data in prompts: wrap them in delimited data blocks.
- AI feedback may only cite computed metrics, transcript content and the rubric. Never invented numbers.
- Prompts are versioned files; store `prompt_version` with outputs and log token usage.

**UI**
- One primary job and one primary button per screen; secondary details in tabs, expandable sections or popovers. Match the canvas designs.
- Design tokens: indigo `#3846C4` (primary / good), amber `#C25E14` (needs attention), ground `#F6F6F3`, ink `#15171C`, muted `#5A606C`; Plus Jakarta Sans for headings, Inter for body. No red/green-only meaning; no emoji in UI.
- WCAG 2.1 AA: real buttons and links, labels on inputs, visible focus, 4.5:1 contrast, 44 px targets, `prefers-reduced-motion` respected.
- Every async screen has loading, empty, error and offline states.
- Feedback tone: encouraging, strengths first, at most 2 focus areas, each tied to a moment or slide.

**Testing**
- Scoring changes need golden-file tests; any golden-output change needs a scoring version bump.
- No live provider calls in CI; use recorded responses.
- New screens get component tests for their key states; core flows are covered by Playwright.

## Working with the project owner

The owner has hobby full-stack and game-dev experience and builds this with Claude as implementer and advisor. Recommend a clear option rather than listing many, explain production-grade practices when introducing them, and flag decisions that are the owner's to make (scope, cost/model choices, anything user-facing). Don't commit or push unless asked.
