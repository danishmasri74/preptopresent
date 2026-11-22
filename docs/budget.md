# Development budget (FYP, 4 months)

Agreed 2026-11-19. Unfunded project: two team members plus the demo, no participant study.
Prices in USD converted at ~RM4.07/US$ (mid-November 2026). Foreign services may add 8% SST and 1–3% card fees.

## Allocations

| Item                                                                | Estimate                                                                                   | Allocated                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| **Anthropic API** (Claude Opus 5.5, prepaid credits)                | $32.40 ≈ RM140 of expected use                                                             | **RM200** (includes buffer) |
| **ResoNode CLI VPS** (2 vCPU / 4 GB, worker host, 6-month plan)     | RM37.50                                                                                    | **RM37.50**                 |
| **Domain** preptopresent.com (Porkbun, 1 year)                      | $11.81                                                                                     | **RM51**                    |
| **ElevenLabs** (Eleven v4 examiner voice + Scribe v3 transcription) | Starter $1 (month 3) + $6 (month 4) ≈ RM30.10, plus ~RM4 API usage beyond included credits | **RM40** (includes buffer)  |
| **Total**                                                           |                                                                                            | **RM328.50**                |
| **Approved budget**                                                 | Total plus currency conversion, card fees, SST and extra buffer                            | **~RM350**                  |

Free (RM0): Supabase Free (Singapore), Vercel Hobby, GitHub, Google sign-in, Cloudflare R2 free tier (rehearsal videos; a card must be on file to enable it).

## Assumptions

- **Anthropic:** ~150 prompt-tuning calls, ~40 rubric reads, ~30 scripts + ~60 revisions, ~70 rehearsals, ~20 Q&A drills, demo. Mock AI mode and recorded responses for UI work and tests. Console spend alerts set.
- **ElevenLabs:** Free plan in months 1–2; Starter (monthly, not yearly) in months 3–4, cancelled before renewal. Included credits are one shared pool (Starter ≈ 30 min of voice _or_ ~1 h 31 min of transcription). Beyond credits: transcription $0.20/hour via API, voice $0.20/min on Starter. Saved transcripts are reused in development.
- **Worker:** ResoNode chosen provisionally (server in Pahang); Railway Hobby (~$5/month, usage limit $10) is the fallback.
- **Supabase Free limits:** 500 MB database, 1 GB storage, 5 GB egress, 50 MB max file size, no automatic backups (weekly backup via GitHub Action before the demo). Supabase holds decks, audio, transcripts, features and scores; rehearsal videos go to Cloudflare R2.
- **Cloudflare R2:** 10 GB free with no egress fees. Video is VP9 720p at ~1 Mbps: ~37 MB per 5-minute and ~110 MB per 15-minute rehearsal, so 10 GB holds ~270 or ~90 of them. Above 10 GB it costs $0.015 per GB per month.

## Not included

- Claude plan used to build the app (Pro ≈ $20/month), if the faculty counts development tools.
- Supabase Pro ($25/month), only if guaranteed backups become necessary.
- Card fees and a general contingency (~10%).
- Domain renewal after year 1.

## Per-session cost reference (Opus 5.5 + ElevenLabs API rates)

| Session                 | Cost              |
| ----------------------- | ----------------- |
| 5-minute rehearsal      | ~$0.11 (≈ RM0.48) |
| 15-minute rehearsal     | ~$0.17 (≈ RM0.75) |
| Q&A drill (5 questions) | ~$0.25 (≈ RM1.10) |
