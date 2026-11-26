# PrepToPresent

Desktop web app that helps university students rehearse presentations and get objective feedback (voice, language, body language, content, timing). Final-year project built to commercial-ready quality.

- **What we build:** [docs/spec.md](docs/spec.md) (feature IDs F-xx, scoring framework, non-functional requirements)
- **How we build it:** [docs/architecture.md](docs/architecture.md) (stack, data model, pipelines, AI conventions, phases)
- **UX designs:** PrepToPresent UX Flow canvas: https://claude.ai/artifact/AKFuEWoKLaof4GJQgfdyc6

Read the relevant spec and architecture sections before starting a feature. If code and docs disagree, raise it; don't silently diverge. Update the docs in the same change when a decision changes.

## Fixed product decisions

- Solo presentations only; talks 1–15 minutes (no score under 1 minute; auto-stop at the limit).
- Desktop web only (no mobile layouts needed); latest Chrome, Edge, Firefox.
- Body tracking runs in the browser (MediaPipe in a Web Worker, 10 fps adaptive to 5). Landmarks never leave the device; only compact feature vectors do. Rehearsal videos are saved privately to Cloudflare R2 (replay and comparison on any device) and kept until the user deletes them.
- Scores are recomputable from stored raw data and always carry a `scoring_version`. Changing any threshold or weight bumps the version.

## Stack

Next.js (App Router, TypeScript strict) + Tailwind + shadcn/ui + Framer Motion · Supabase (Auth, Postgres + RLS, Storage, Realtime) · Python 3.12 worker (FastAPI, uv) · Cloudflare R2 (videos) · ElevenLabs (Scribe v3 transcription, Eleven v4 Q&A voices) · parselmouth · Claude API.

## Commands

Run from the repo root unless noted. Package manager: **pnpm** (web), **uv** (worker).

| Task                                   | Command                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Install everything                     | `pnpm install` and `cd services/worker && uv sync`                                                                                   |
| Web dev server (http://localhost:3000) | `pnpm dev`                                                                                                                           |
| Web lint / typecheck / tests / build   | `pnpm --filter web lint` · `pnpm --filter web typecheck` · `pnpm --filter web test` · `pnpm --filter web build`                      |
| Format (Prettier) / check              | `pnpm format` · `pnpm format:check`                                                                                                  |
| Worker tests / lint / format           | `cd services/worker && uv run pytest -q` · `uv run ruff check .` · `uv run ruff format .`                                            |
| Worker health API                      | `cd services/worker && uv run uvicorn app.main:app --reload --port 8000`                                                             |
| Worker job runner                      | `cd services/worker && uv run python -m app.runner` (needs `DATABASE_URL`)                                                           |
| Supabase CLI                           | `pnpm exec supabase …` (e.g. `migration new <name>`)                                                                                 |
| Apply migrations to the dev database   | `pnpm exec supabase db push --remote="$DATABASE_URL"` (read the URL from `services/worker/.env`; `--dry-run` first)                  |
| End-to-end smoke tests                 | start the worker, then `pnpm --filter web smoke:e2e` (auth/queue), `smoke:deck` (slide pipeline) and `smoke:rubric` (rubric reading) |

Notes:

- Next.js here is **v16** (newer than most training data). Read `apps/web/AGENTS.md` and the bundled docs in `apps/web/node_modules/next/dist/docs/` before using unfamiliar APIs.
- `typecheck` runs `next typegen` first (generates route types such as `LayoutProps`).
- Add shadcn components with `pnpm dlx shadcn@latest add <name>` from `apps/web`.
- No Docker locally: we use a hosted Supabase dev project (`preptopresent-dev`), not `supabase start`.
- `AI_MODE=mock` in `services/worker/.env` makes AI jobs return test answers (no key, no cost); `live` calls Claude.
- Real secrets live only in git-ignored `apps/web/.env.local` and `services/worker/.env`. `.env.example` files are committed templates and must stay blank. Never print secret values in command output (mask connection strings).

## Conventions

**General**

- Validate every boundary with Zod (web) / Pydantic (worker). Shared JSON Schemas live in `packages/schemas`.
- Every user-owned table has `user_id` and an RLS policy; every storage bucket is private with path-prefix policies. No exceptions. R2 has no RLS: only the server issues presigned URLs, after checking ownership in Postgres.
- Secrets (Anthropic, ElevenLabs, Cloudflare R2, Supabase service role) only in server or worker env vars. Never in client code, logs or commits. `.env.example` lists names only.
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

**Commits and pull requests:** never add AI attribution. No `Co-Authored-By` trailers for Claude or any AI, and no "Generated with" lines in commit messages or PR descriptions. Commits are authored by the project members only.
