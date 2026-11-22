"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  labelledBy?: string;
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** File picker with drag-and-drop. A real <input type="file"> keeps it keyboard accessible. */
export function DeckDropzone({ file, onFile, disabled, labelledBy }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cn(
        "flex items-center gap-4 rounded-2xl border-[1.5px] border-dashed border-[#c9ccd3] bg-card p-6",
        file && "border-solid border-primary",
        dragging && "border-primary bg-accent",
      )}
    >
      {file ? (
        <>
          <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
            PDF
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{file.name}</span>
            <span className="block text-sm text-muted-foreground">{formatSize(file.size)}</span>
          </span>
        </>
      ) : (
        <span className="flex-1">
          <span className="block font-semibold">Drop your slides here, or choose a file</span>
          <span className="block text-sm text-muted-foreground">
            PDF up to 100 MB. From PowerPoint or Google Slides, export as PDF.
          </span>
        </span>
      )}
      <label
        htmlFor={inputId}
        className={cn(
          "flex min-h-11 shrink-0 cursor-pointer items-center rounded-xl border border-input bg-background px-4 font-semibold hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {file ? "Replace" : "Choose file"}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-labelledby={labelledBy}
          disabled={disabled}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
