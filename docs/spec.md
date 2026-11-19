# PrepToPresent: Product Specification

> Status: v1.0 draft, 2026-11-16. Source of truth for _what_ we build. The _how_ lives in [architecture.md](architecture.md).
> UX designs: [PrepToPresent UX Flow canvas](https://claude.ai/artifact/AKFuEWoKLaof4GJQgfdyc6) (private; share from the page if others need it).

## 1. Overview

PrepToPresent is a desktop web app that helps university students prepare for and rehearse presentations. Students upload their slides and marking rubric, get an AI-drafted script with gesture cues, rehearse in front of their webcam, and receive objective feedback on voice, language, body language, content and timing. Progress is tracked across rehearsals.

It is a final-year project built to **commercial-ready quality**: production-grade security, privacy, reliability and polish, not a demo.

### 1.1 Problems addressed

| ID     | Problem                                                                                | How we address it                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | **Public speaking anxiety** harms students' performance                                | Script and gesture cues build preparation; warmups; private, low-stakes practice; AI Q&A rehearsal; encouraging feedback tone; confidence check-ins |
| **P2** | **No objective feedback** when practising alone (pace, fillers, pauses, body language) | Automated speech, voice, body-language, content and timing analysis linked to exact moments in the recording                                        |
| **P3** | **Hard to measure improvement** using self-assessment alone                            | Consistent, versioned scoring; history; run-vs-run comparison; progress trends; confidence trends                                                   |

### 1.2 Scope decisions (fixed)

- **Solo presentations only.** No group presentations.
- **Talk length 1–15 minutes.** Recording stops automatically at the project's time limit (max 15:00). Runs under 1 minute can be played back but get no score. The Q&A drill is separate from this cap.
- **Desktop web app**, desktop-first layout, no mobile support. Optionally installable as a PWA.
- **Webcam and microphone required** for full feedback. An audio-only rehearsal mode exists (no body-language score).
- **Launch language: English.** Other languages are a later decision (depends on speech-provider support).

### 1.3 Product principles

1. **One primary job per screen.** Details go behind tabs, expandable sections and popovers. Avoid clutter.
2. **Encourage, then coach.** Feedback leads with strengths, then gives at most 2–3 focus areas. Never a wall of red flags.
3. **Private by default.** Body tracking runs on the user's device; only numeric features leave it. Video is saved only on opt-in.
4. **Fast feedback.** A full report within about a minute of finishing; results appear progressively.
5. **Raw data is the source of truth.** Scores are always recomputable from stored raw data, and every score records the scoring version it came from.
6. **Every metric links to a moment.** Feedback points to timestamps and slides, not vague advice.

## 2. Users

**Primary:** university students (18+) preparing graded presentations: class presentations, FYP / viva, pitches.
**Context:** practising alone on a laptop, often anxious, often short on time before a deadline.

## 3. Features

Priority: **MVP** = needed for the first end-to-end usable version · **V1** = needed for commercial launch · **Later** = post-launch.

### 3.1 Account & onboarding

| ID   | Feature                                                                                                                                                                                      | Problem | Priority                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------ |
| F-01 | Sign up / sign in with Google or passwordless email link                                                                                                                                     | –       | MVP                      |
| F-02 | Onboarding 1/3: name, university, field of study, goal chips                                                                                                                                 | P1      | MVP                      |
| F-03 | Onboarding 2/3: baseline confidence check-in (4 items, 1–5). For the evaluation study, swap in a validated instrument (e.g. the public-speaking items of PRCA-24)                            | P1, P3  | MVP                      |
| F-04 | Onboarding 3/3: camera/mic data consent (required), age 18+ (required), save-video default (optional), study participation (optional). Consent records are stored with version and timestamp | –       | MVP                      |
| F-05 | Periodic re-check of baseline confidence (every 4 weeks)                                                                                                                                     | P1, P3  | V1                       |
| F-06 | Settings: profile, privacy & data (video default, retention, data export, delete recordings, delete account), rehearsal defaults, notifications                                              | –       | MVP (privacy), V1 (rest) |

### 3.2 Projects & preparation

| ID   | Feature                                                                                                                                                        | Problem | Priority |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| F-10 | Projects list: active/archived, rename, settings, duplicate, archive, delete                                                                                   | P3      | MVP      |
| F-11 | New project: preset (Class presentation, FYP/viva, Pitch, Custom), title, time limit (1–15 min), date; more options (audience, Q&A yes/no, script style, tone) | P2      | MVP      |
| F-12 | Slide upload (PDF, PPTX; ≤100 MB; ≤60 slides): render slide images, extract text, titles, speaker notes, count of visuals                                      | P2      | MVP      |
| F-13 | Script generation progress screen and extraction-failure states (e.g. scanned PDF without text, corrupt file)                                                  | –       | MVP      |
| F-14 | Rubric/brief upload (PDF, DOCX, image) or paste, or none. AI parses criteria (name, weight, descriptors)                                                       | P2      | MVP      |
| F-15 | Rubric review: user edits criteria names and weights (total 100%); shows deck coverage per criterion with "Fix in script" / "Suggest content"                  | P2      | MVP      |
| F-16 | Script generator: per-slide script (key points or full script; formal or conversational), keywords, estimated duration, rubric criteria touched                | P1, P2  | MVP      |
| F-17 | Prep workspace: slide list, slide-by-slide script editor, regenerate / shorten / make conversational, editable per-slide time budget, total estimate vs limit  | P1, P2  | MVP      |
| F-18 | Gesture cues: AI places cues from a fixed gesture library into the script; preview popover with animation; change/remove/add                                   | P1      | V1       |
| F-19 | Slide deck re-upload: match unchanged slides, keep their script and budgets, flag changed slides for regeneration                                              | P2      | V1       |

### 3.3 Rehearsal

| ID   | Feature                                                                                                                                                                                                                                                       | Problem | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| F-20 | Rehearsal setup: camera preview with framing outline, camera and microphone pickers, checks (mic level, lighting, framing with hands visible), pre-session confidence (1–5), session type: Full run / Some slides (from–to range) / Q&A only (examiner style) | P1, P2  | MVP      |
| F-21 | Session options: script on screen (full / keywords / hidden), gesture cues on/off, live nudges on/off, show my camera (default off), save video (default from settings)                                                                                       | P1      | MVP      |
| F-22 | Permission-blocked state with recovery steps and audio-only fallback                                                                                                                                                                                          | –       | MVP      |
| F-23 | Warmup (optional, ~2 min): box breathing, pitch glide (records natural pitch range = vocal baseline), read-your-opener                                                                                                                                        | P1      | V1       |
| F-24 | Live rehearsal (dark focus mode): current slide, keyword teleprompter with current line, gesture cue animation, elapsed / limit, slide progress, keyboard slide control (→ ← Space), pause, finish                                                            | P1, P2  | MVP      |
| F-25 | Live warnings: 1 minute left, automatic stop at limit, "we can't see you" when tracking is lost (that span is excluded from body-language scoring)                                                                                                            | P2      | MVP      |
| F-26 | Live nudges: gentle hints such as "a little fast" (pace), max one visible at a time, rate-limited                                                                                                                                                             | P2      | V1       |
| F-27 | 3-2-1 countdown before recording; discard-run option                                                                                                                                                                                                          | –       | V1       |
| F-28 | 1-minute practice with a given topic, no project needed                                                                                                                                                                                                       | P1      | V1       |

### 3.4 Feedback & tracking

| ID   | Feature                                                                                                                                                                         | Problem | Priority                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------- |
| F-30 | Processing screen: staged progress; asks the post-session confidence check-in while waiting; shows what's ready early                                                           | P1, P3  | MVP                           |
| F-31 | Upload interruption recovery: recording kept on the device, automatic resume, retry, notify when ready                                                                          | –       | MVP                           |
| F-32 | Report Overview: overall score and change since last comparable run, one-line summary, felt-before/after, 2 strengths, 2 focus areas with "watch the moment", 5 category scores | P2, P3  | MVP                           |
| F-33 | Report Playback: video (if saved) or audio, timeline lanes (slides, fillers, eye contact, pace), moments-to-review list including positive moments                              | P2      | MVP (audio), V1 (video lanes) |
| F-34 | Report Slides tab: time per slide vs budget, per-slide flags                                                                                                                    | P2      | MVP                           |
| F-35 | Report Transcript tab: full transcript with fillers, long pauses and unclear segments highlighted                                                                               | P2      | MVP                           |
| F-36 | Report Rubric tab: coverage per criterion based on what was actually said                                                                                                       | P2      | V1                            |
| F-37 | Data-quality notice when inputs were poor (low light, tracking lost, noisy audio) and a "how scores work" explainer                                                             | P3      | V1                            |
| F-38 | "Practise this" actions: start a Some-slides drill on a weak section                                                                                                            | P2      | V1                            |
| F-39 | History: all sessions per project, filter, select two to compare                                                                                                                | P3      | MVP                           |
| F-40 | Compare two runs: scores, felt-before/after, "what changed" summary, per-metric table                                                                                           | P3      | MVP                           |
| F-41 | Dashboard: next-step card, progress chart (score and confidence), recent sessions; first-visit empty state with 3-step checklist                                                | P3      | MVP                           |

### 3.5 AI Q&A drill

| ID   | Feature                                                                                                                                                    | Problem | Priority |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| F-50 | Examiner styles: Friendly (classmate), Lecturer (fair, probing), Tough (challenges claims)                                                                 | P1      | V1       |
| F-51 | Questions generated from slides, script and rubric; spoken aloud (TTS) with text option; 3–10 questions per drill                                          | P1, P2  | V1       |
| F-52 | Answers recorded per question; live "listening" state; target 30–60 s                                                                                      | P1, P2  | V1       |
| F-53 | Q&A results: answered-the-question count, average length, fillers/min; per question: transcript excerpt, feedback, stronger example answer, practise again | P2      | V1       |

### 3.6 Later

Billing and plans, presentation-date reminders (email), help centre and feedback widget, gesture library browser, additional languages, live pace nudges via streaming transcription if not in V1, mobile companion.

## 4. Key user flows

1. **First run:** Sign up → About you → Baseline check-in → Consent → First-visit dashboard → New project → upload slides (+ rubric) → script generation → Rubric review (if a rubric was given) → Prep workspace.
2. **Rehearse:** Prep or Dashboard → Setup (devices, check-in, session type) → [Warmup] → Countdown → Live → Finish → Processing (post check-in) → Report.
3. **Improve:** Report → "Watch the moment" / Playback → "Practise this" (Some-slides drill) → Report → History → Compare.
4. **Q&A:** Report or Prep → Setup (Q&A only, examiner style) → Q&A drill → Q&A results.
5. **Recovery paths:** permission blocked → recovery steps or audio-only; upload interrupted → local buffer → auto-resume; tracking lost → live hint + excluded span.

Screen inventory: see the canvas rows _Prepare_, _Rehearse_, _Supporting screens_, _Manage and track_, _Onboarding steps, edge cases and recovery_, and _Data_.

## 5. Scoring framework

Scoring must be **consistent across sessions** (P3), **explainable**, and **recomputable**. All thresholds below are initial values, stored as a versioned scoring config (`scoring_version`, e.g. `2026.1`). Changing any threshold or weight bumps the version. Comparisons and trends only use scores from the same version, or re-score old sessions from raw data first.

### 5.1 Metrics

| Metric                 | Definition                                                                                                                                                                                       | Initial "good" band                       | Source                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | -------------------------- |
| **Pace**               | Words per minute over speaking time (excludes pauses > 2 s)                                                                                                                                      | 130–160 wpm (adjustable per user)         | Transcript word timestamps |
| **Fillers / min**      | Count of filler tokens per speaking minute. Acoustic fillers (um, uh, er, hmm) from the transcriber; discourse fillers (like, you know, basically, so at sentence start) classified from context | ≤ 2 / min                                 | Transcript (+ classifier)  |
| **Long pauses**        | Pauses ≥ 3 s not at a slide change (penalised) vs 0.5–2 s pauses at sentence boundaries (positive)                                                                                               | ≤ 1 long pause per 5 min                  | Transcript timing          |
| **Pitch variety**      | Std. dev. of F0 in semitones over voiced frames, relative to the user's baseline range (warmup) when available                                                                                   | ≥ 2.5 semitones; < 1.5 flagged "monotone" | Audio F0 contour           |
| **Volume consistency** | Std. dev. of loudness (dB) over speech; flags sustained drops at sentence ends                                                                                                                   | Within ±6 dB                              | Audio RMS                  |
| **Clarity**            | Share of words with transcriber confidence < 0.6; groups them into "possibly unclear" segments for review                                                                                        | ≤ 5% words                                | Transcript confidence      |
| **Eye contact**        | % of tracked speaking time with head yaw within ±15° and pitch within ±12° of a calibrated "looking at camera" pose (captured in setup)                                                          | ≥ 60%                                     | Face landmarks / head pose |
| **Posture**            | % of tracked time upright: shoulder tilt ≤ 8°, no forward slump vs calibrated baseline (nose–shoulder distance)                                                                                  | ≥ 80%                                     | Pose landmarks             |
| **Gestures**           | Hand visibility and movement: flags "too still" (hands hidden/static > 60% of time) and "fidgeting" (high-frequency repetitive motion)                                                           | Balanced                                  | Pose landmarks (wrists)    |
| **Expression**         | Share of time with a neutral-positive expression vs tense (brow/lip-press blendshapes); smile moments                                                                                            | Advisory only in v1                       | Face blendshapes           |
| **Total time**         | Duration vs time limit                                                                                                                                                                           | Within −15% … +0% of limit                | Session timeline           |
| **Slide timing**       | Per-slide duration vs budget; slides > +25% over budget flagged                                                                                                                                  | ≥ 80% of slides within budget             | Slide events               |
| **Rubric coverage**    | Per criterion: covered / partial / missing, judged from the transcript against criterion descriptors                                                                                             | All weighted criteria covered             | LLM on transcript          |
| **Structure**          | Presence of opening, outline/roadmap, signposting, conclusion                                                                                                                                    | All present                               | LLM on transcript          |

### 5.2 Categories and overall score

| Category      | Metrics                                              | Weight (v2026.1) |
| ------------- | ---------------------------------------------------- | ---------------- |
| Voice & pace  | Pace, long pauses, pitch variety, volume consistency | 20%              |
| Language      | Fillers, clarity                                     | 20%              |
| Body language | Eye contact, posture, gestures (expression advisory) | 20%              |
| Content       | Rubric coverage, structure                           | 25%              |
| Timing        | Total time, slide timing                             | 15%              |

- Each metric maps to 0–100 with a piecewise-linear curve: 100 inside the good band, falling linearly to 0 at a defined "poor" bound.
- Category score = mean of its metrics' scores. Overall = weighted mean of categories.
- **Data quality:** a metric with insufficient coverage (e.g. < 60% of speaking time tracked, or audio SNR too low) is marked _low confidence_, shown with a notice, and excluded from the overall score (weights renormalise). Audio-only sessions exclude Body language.
- **Comparable runs:** "change since last time" compares against the previous session of the same type (full run vs full run; drills and Q&A separately).

### 5.3 Self-report measures

- **Session check-in:** confidence 1–5 before (setup) and after (processing screen) each session.
- **Baseline / periodic:** 4-item confidence scale at onboarding and every 4 weeks. For the FYP study, use a validated instrument and check its licence terms first.

## 6. Feedback content rules (AI)

- Tone: supportive, specific, plain English, second person. Strengths first.
- Max 2 strengths and 2 focus areas on Overview; each focus area must cite a timestamp or slide and a concrete next action.
- Never invent metrics. AI text may only reference computed metrics, transcript content and the rubric.
- Slide text, rubric text and transcripts are **untrusted input** to AI prompts. They are data, never instructions.
- Stronger-answer examples in Q&A must stay faithful to the student's own project content (no invented results).

## 7. Non-functional requirements

| Area              | Requirement                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Performance**   | Report fully ready ≤ 90 s (p90) after a 15-min run on a normal connection; first results ≤ 10 s. Live tracking ≥ 10 fps with adaptive drop to 5 fps; UI stays smooth (tracking off the main thread). Script generation ≤ 60 s for a 20-slide deck                                                                        |
| **Browsers**      | Latest two versions of Chrome, Edge, Firefox. Safari best-effort                                                                                                                                                                                                                                                         |
| **Reliability**   | No rehearsal is lost to a network failure: local buffering (IndexedDB) and resumable uploads. Jobs are idempotent and retried                                                                                                                                                                                            |
| **Privacy**       | Explicit consent before first camera use; only numeric body features leave the device unless video saving is on; recordings auto-deleted after the user's retention period (default 90 days); scores kept; data export and full deletion self-service; AI and speech providers configured not to retain or train on data |
| **Security**      | Row-level security on every table; private storage with short-lived signed URLs; provider API keys only on the server; per-user rate limits on AI-heavy actions; upload validation (type, size, page count)                                                                                                              |
| **Accessibility** | WCAG 2.1 AA: keyboard operable, visible focus, 4.5:1 text contrast, 44 px targets, reduced-motion respected, captions/transcripts for audio                                                                                                                                                                              |
| **Observability** | Error monitoring, job durations and failure rates, AI/speech usage and cost per session                                                                                                                                                                                                                                  |
| **Cost**          | Target ≤ US$0.25 API cost per 15-min full run including feedback (measured, then tuned)                                                                                                                                                                                                                                  |

## 8. Evaluation plan (FYP)

| Problem | Measure                                                                                                                        | Method                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| P1      | Change in baseline confidence (onboarding vs ≥ 4 weeks later); pre→post session confidence deltas                              | Within-subject, consenting participants            |
| P2      | Accuracy of metrics vs human annotation (filler counts, pace, eye contact) on a labelled sample; perceived usefulness (survey) | Annotated recordings + usability survey (e.g. SUS) |
| P3      | Score trends across ≥ 3 rehearsals; users' ability to name what improved (interview)                                           | Session logs + short interviews                    |

Participation is opt-in at onboarding (F-04), with anonymised data only.

## 9. Out of scope

Group presentations; talks over 15 minutes; mobile apps; live audience or remote-presenter mode; real-time collaborative editing; instructor/teacher dashboards; languages other than English at launch.

## 10. Open questions

1. Validated anxiety instrument for the study: which one, and licence terms?
2. Gesture library: final list of gestures (initial set in architecture.md §6).
3. V1 vs Later for live pace nudges (needs streaming transcription; adds cost).
4. Commercial model (free tier limits, pricing) when billing is added.
5. Additional speaking languages: which first, and provider quality for them.
