"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { pasteRubric } from "@/app/projects/actions";
import { DeckDropzone } from "@/components/deck-dropzone";
import { ChoicePill, FormError } from "@/components/form";
import { uploadRubric } from "@/components/rubric-upload";
import { Button } from "@/components/ui/button";
import {
  MAX_PASTE_CHARS,
  RUBRIC_ACCEPT,
  RUBRIC_ERROR_MESSAGES,
  type RubricCriterion,
  type RubricStatus,
  formatWeight,
  rubricBadge,
  validateRubricFile,
  weightTotal,
} from "@/lib/rubrics";
import { useOnline } from "@/lib/use-online";

export type RubricSummary = {
  id: string;
  status: RubricStatus;
  error_code: string | null;
  source_kind: "file" | "paste";
  original_filename: string | null;
  weights_suggested: boolean;
  model: string | null;
  created_at: string;
};

type Props = {
  userId: string;
  projectId: string;
  rubric: RubricSummary | null;
  criteria: RubricCriterion[];
};

/** Marking rubric for a project (F-14): add one, watch it being read, see the criteria. */
export function RubricPanel({ userId, projectId, rubric, criteria }: Props) {
  const [replacing, setReplacing] = useState(false);
  const reading = rubric?.status === "uploaded" || rubric?.status === "processing";

  if (reading) return <ReadingRubric startedAt={rubric.created_at} />;

  if (rubric && rubric.status !== "failed" && !replacing) {
    return (
      <RubricCriteria rubric={rubric} criteria={criteria} onReplace={() => setReplacing(true)} />
    );
  }

  return (
    <RubricForm
      userId={userId}
      projectId={projectId}
      failure={rubric?.status === "failed" ? rubric.error_code : null}
      onCancel={replacing ? () => setReplacing(false) : undefined}
      onDone={() => setReplacing(false)}
    />
  );
}

function ReadingRubric({ startedAt }: { startedAt: string }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => router.refresh(), 2000);
    const started = new Date(startedAt).getTime();
    const slowCheck = setInterval(() => setSlow(Date.now() - started > 90_000), 5000);
    return () => {
      clearInterval(tick);
      clearInterval(slowCheck);
    };
  }, [router, startedAt]);

  return (
    <section
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-3 border-accent border-t-primary motion-reduce:animate-none"
        />
        <h2 className="text-lg font-bold">Reading your rubric…</h2>
      </div>
      <p className="text-muted-foreground">
        We&apos;re finding each marking criterion and its weight. This usually takes under a minute.
      </p>
      {slow ? (
        <p className="text-sm text-muted-foreground">
          This is taking longer than usual. You can leave this page; we&apos;ll keep working.
        </p>
      ) : null}
    </section>
  );
}

function RubricCriteria({
  rubric,
  criteria,
  onReplace,
}: {
  rubric: RubricSummary;
  criteria: RubricCriterion[];
  onReplace: () => void;
}) {
  const total = weightTotal(criteria);
  const source = rubric.source_kind === "paste" ? "pasted text" : rubric.original_filename;

  return (
    <section
      aria-labelledby="rubric-heading"
      className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="rubric-heading" className="text-lg font-bold">
            Marking rubric
          </h2>
          <p className="text-sm text-muted-foreground">
            {criteria.length} criteria from {source}
          </p>
        </div>
        <Button variant="outline" onClick={onReplace}>
          Replace rubric
        </Button>
      </div>

      {rubric.model === "mock" ? (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Test mode: these criteria come from the offline test reader, not from Claude. Add the
          Anthropic API key to read rubrics properly.
        </p>
      ) : null}

      <ol className="flex flex-col">
        {criteria.map((c) => (
          <li
            key={c.id}
            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border py-3 first:border-t-0"
          >
            <span className="font-semibold">{c.name}</span>
            <span className="text-right font-bold tabular-nums">{formatWeight(c.weight)}</span>
            {c.description ? (
              <span className="col-span-2 line-clamp-2 text-sm text-muted-foreground">
                {c.description}
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatWeight(total)}</span>
        </p>
        {total !== 100 ? (
          <p className="rounded-xl bg-attention-soft px-4 py-3 text-sm text-attention-foreground">
            These weights add up to {formatWeight(total)}, not 100%. You&apos;ll be able to fix this
            when you review the rubric.
          </p>
        ) : null}
        {rubric.weights_suggested ? (
          <p className="text-sm text-muted-foreground">
            Your brief didn&apos;t give weights, so these are suggestions based on what it
            emphasises.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RubricForm({
  userId,
  projectId,
  failure,
  onCancel,
  onDone,
}: {
  userId: string;
  projectId: string;
  failure: string | null;
  onCancel?: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const online = useOnline();
  const textId = useId();
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = failure ? "We couldn't read that rubric" : "Add your marking rubric";
  const intro = failure
    ? (RUBRIC_ERROR_MESSAGES[failure] ?? RUBRIC_ERROR_MESSAGES.internal)
    : "Optional. We'll pull out each criterion and its weight, so your script and feedback can follow how you're marked.";

  async function onSubmit() {
    setError(null);
    let message: string | null;
    if (mode === "file") {
      message = validateRubricFile(file);
      if (message) return setError(message);
      setBusy(true);
      message = await uploadRubric(file!, userId, projectId);
    } else {
      setBusy(true);
      const result = await pasteRubric({ projectId, text });
      message = result.ok ? null : result.message;
    }
    setBusy(false);
    if (message) return setError(message);
    setFile(null);
    setText("");
    onDone();
    router.refresh();
  }

  const ready = mode === "file" ? Boolean(file) : text.trim().length > 0;

  return (
    <section
      aria-labelledby="rubric-form-heading"
      className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-6"
    >
      <h2 id="rubric-form-heading" className="text-lg font-bold">
        {heading}
      </h2>
      <p className="text-muted-foreground">{intro}</p>

      {!online ? (
        <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm">
          You&apos;re offline. Reconnect to add a rubric.
        </p>
      ) : null}

      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">How do you want to add it?</legend>
        <ChoicePill
          type="radio"
          name="rubric-mode"
          checked={mode === "file"}
          onChange={() => setMode("file")}
        >
          Upload a file
        </ChoicePill>
        <ChoicePill
          type="radio"
          name="rubric-mode"
          checked={mode === "paste"}
          onChange={() => setMode("paste")}
        >
          Paste text
        </ChoicePill>
      </fieldset>

      {mode === "file" ? (
        <DeckDropzone
          file={file}
          onFile={setFile}
          disabled={busy || !online}
          labelledBy="rubric-form-heading"
          accept={RUBRIC_ACCEPT}
          prompt="Drop your rubric or brief here, or choose a file"
          hint="PDF, Word (.docx) or a photo of a printed rubric, up to 20 MB."
          badge={rubricBadge}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor={textId} className="text-sm font-semibold">
            Rubric or brief text
          </label>
          <textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy || !online}
            maxLength={MAX_PASTE_CHARS}
            rows={8}
            placeholder="Paste the marking criteria from your module guide or assignment brief."
            className="min-h-40 rounded-xl border border-input bg-background px-4 py-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <p className="text-right text-xs text-muted-foreground">
            {text.length.toLocaleString("en")} / {MAX_PASTE_CHARS.toLocaleString("en")}
          </p>
        </div>
      )}

      <FormError message={error} />

      <div className="flex flex-wrap gap-3">
        <Button onClick={onSubmit} disabled={busy || !ready || !online} size="lg">
          {busy ? "Sending…" : "Read rubric"}
        </Button>
        {onCancel ? (
          <Button variant="ghost" size="lg" onClick={onCancel} disabled={busy}>
            Keep current rubric
          </Button>
        ) : null}
      </div>
    </section>
  );
}
