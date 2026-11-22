"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeckDropzone } from "@/components/deck-dropzone";
import { ChoicePill, FormError } from "@/components/form";
import { uploadDeck } from "@/components/deck-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUDIENCES, MAX_MINUTES, MIN_MINUTES, PRESETS, validateDeckFile } from "@/lib/projects";
import { createProject } from "../actions";

const selectClass =
  "h-12 w-full rounded-xl border border-input bg-card px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Phase = "idle" | "creating" | "uploading";

export function NewProjectForm() {
  const router = useRouter();
  const [preset, setPreset] = useState<string>("fyp_viva");
  const [minutes, setMinutes] = useState<number>(15);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  function choosePreset(id: string) {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p && id !== "custom") setMinutes(p.minutes);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fileError = validateDeckFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    setPhase("creating");
    const created = await createProject(new FormData(event.currentTarget));
    if (!created.ok) {
      setError(created.message);
      setPhase("idle");
      return;
    }

    setPhase("uploading");
    const { projectId, userId } = created.data;
    const uploadError = await uploadDeck(file!, userId, projectId);
    // Even if the upload failed, the project exists: its page lets the user try again.
    router.push(`/projects/${projectId}${uploadError ? "?upload=failed" : ""}`);
  }

  const busy = phase !== "idle";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold">What kind of presentation?</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <ChoicePill
              key={p.id}
              type="radio"
              name="preset"
              value={p.id}
              checked={preset === p.id}
              onChange={() => choosePreset(p.id)}
            >
              {p.label}
            </ChoicePill>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title" className="font-semibold">
          Title
        </Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="e.g. Final Year Project defence"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="time_limit_min" className="font-semibold">
            Time limit
          </Label>
          <select
            id="time_limit_min"
            name="time_limit_min"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={selectClass}
          >
            {Array.from({ length: MAX_MINUTES - MIN_MINUTES + 1 }, (_, i) => i + MIN_MINUTES).map(
              (m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ),
            )}
          </select>
          <span className="text-xs text-muted-foreground">1 to 15 minutes</span>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="present_on" className="font-semibold">
            Presentation date
          </Label>
          <Input id="present_on" name="present_on" type="date" />
          <span className="text-xs text-muted-foreground">Optional, for reminders</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span id="slides-label" className="text-sm font-semibold">
          Slides
        </span>
        <DeckDropzone file={file} onFile={setFile} disabled={busy} labelledBy="slides-label" />
      </div>

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">
          More options
        </summary>
        <div className="grid grid-cols-2 gap-4 pt-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="audience" className="font-semibold">
              Audience
            </Label>
            <select id="audience" name="audience" defaultValue="examiners" className={selectClass}>
              {AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="qa_enabled" className="font-semibold">
              Q&amp;A after the talk
            </Label>
            <select id="qa_enabled" name="qa_enabled" defaultValue="yes" className={selectClass}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="script_style" className="font-semibold">
              Script style
            </Label>
            <select
              id="script_style"
              name="script_style"
              defaultValue="key_points"
              className={selectClass}
            >
              <option value="key_points">Key points</option>
              <option value="full">Full script</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tone" className="font-semibold">
              Tone
            </Label>
            <select id="tone" name="tone" defaultValue="formal" className={selectClass}>
              <option value="formal">Formal</option>
              <option value="conversational">Conversational</option>
            </select>
          </div>
        </div>
      </details>

      <FormError message={error} />

      <Button type="submit" size="lg" disabled={busy}>
        {phase === "creating"
          ? "Creating project…"
          : phase === "uploading"
            ? "Uploading slides…"
            : "Create project"}
      </Button>
    </form>
  );
}
