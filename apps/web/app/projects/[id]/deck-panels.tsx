"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DeckDropzone } from "@/components/deck-dropzone";
import { uploadDeck } from "@/components/deck-upload";
import { FormError } from "@/components/form";
import { Button } from "@/components/ui/button";
import { validateDeckFile } from "@/lib/projects";

/** Re-renders the page every 2 s while the worker is reading the slides. */
export function ProcessingWatcher({ startedAt }: { startedAt: string }) {
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
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-8"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-3 border-accent border-t-primary motion-reduce:animate-none"
        />
        <h2 className="text-lg font-bold">Reading your slides…</h2>
      </div>
      <p className="text-muted-foreground">
        We&apos;re rendering each slide and pulling out its text. This usually takes under a minute.
      </p>
      {slow ? (
        <p className="text-sm text-muted-foreground">
          This is taking longer than usual. You can leave this page; we&apos;ll keep working.
        </p>
      ) : null}
    </div>
  );
}

/** Upload (or replace) the deck for an existing project. */
export function DeckUploader({
  userId,
  projectId,
  heading,
  intro,
  initialError,
}: {
  userId: string;
  projectId: string;
  heading: string;
  intro: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function onUpload() {
    const fileError = validateDeckFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setBusy(true);
    setError(null);
    const uploadError = await uploadDeck(file!, userId, projectId);
    setBusy(false);
    if (uploadError) {
      setError(uploadError);
      return;
    }
    setFile(null);
    router.replace(`/projects/${projectId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-8">
      <h2 id="uploader-heading" className="text-lg font-bold">
        {heading}
      </h2>
      <p className="text-muted-foreground">{intro}</p>
      <DeckDropzone file={file} onFile={setFile} disabled={busy} labelledBy="uploader-heading" />
      <FormError message={error} />
      <Button onClick={onUpload} disabled={busy || !file} size="lg" className="self-start">
        {busy ? "Uploading…" : "Upload slides"}
      </Button>
    </div>
  );
}
