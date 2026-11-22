"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { FormError } from "@/components/form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DELETE_CONFIRM_PHRASE, PRIVACY_PREFERENCES, type PreferenceKind } from "@/lib/settings";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { deleteAccount, setPreference, type DeleteAccountState } from "./actions";

type Props = {
  preferences: Record<PreferenceKind, boolean>;
  recordingCount: number;
};

export function PrivacySettings({ preferences, recordingCount }: Props) {
  const online = useOnline();

  return (
    <div className="flex flex-col gap-7">
      {!online ? (
        <p
          role="status"
          className="rounded-xl bg-attention-soft px-4 py-3 text-sm font-medium text-attention-foreground"
        >
          You&apos;re offline. Changes will be available again when you reconnect.
        </p>
      ) : null}

      <section
        aria-labelledby="prefs-heading"
        className="rounded-[20px] border border-border bg-card px-7 py-2"
      >
        <h2 id="prefs-heading" className="sr-only">
          Preferences
        </h2>
        {PRIVACY_PREFERENCES.map((p) => (
          <PreferenceRow key={p.kind} {...p} initial={preferences[p.kind]} disabled={!online} />
        ))}
      </section>

      <section
        aria-labelledby="data-heading"
        className="rounded-[20px] border border-border bg-card px-7 py-2"
      >
        <h2 id="data-heading" className="sr-only">
          Your data
        </h2>
        <Row
          title="Download my data"
          description="Your profile, projects, slides and settings as a JSON file. Rehearsal data is added as those features arrive."
        >
          <a
            href="/settings/export"
            download
            aria-disabled={!online || undefined}
            className={cn(
              buttonVariants({ variant: "outline" }),
              !online && "pointer-events-none opacity-50",
            )}
          >
            Download
          </a>
        </Row>
        <Row
          title="Delete all recordings"
          description={
            recordingCount === 0
              ? "You have no recordings yet. Scores and transcripts stay when recordings are deleted."
              : "Removes saved video and audio. Scores and transcripts stay."
          }
        >
          <Button variant="destructive" disabled={recordingCount === 0 || !online}>
            Delete recordings
          </Button>
        </Row>
        <Row
          title="Delete account"
          description="Permanently removes your account, projects, slides and recordings. This can't be undone."
        >
          <DeleteAccountDialog disabled={!online} />
        </Row>
      </section>
    </div>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-[#eeeff2] py-[18px] first-of-type:border-t-0">
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">{title}</p>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function PreferenceRow({
  kind,
  label,
  description,
  initial,
  disabled,
}: {
  kind: PreferenceKind;
  label: string;
  description: string;
  initial: boolean;
  disabled: boolean;
}) {
  const id = useId();
  const [checked, setChecked] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: boolean) {
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const result = await setPreference({ kind, granted: next });
      if (!result.ok) {
        setChecked(!next);
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[#eeeff2] py-[18px] first-of-type:border-t-0">
      <div className="flex items-center justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id} className="font-semibold">
            {label}
          </Label>
          <p id={`${id}-desc`} className="text-[13px] text-muted-foreground">
            {description}
          </p>
        </div>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled || pending}
          aria-describedby={`${id}-desc`}
          // Larger than the shadcn default; the off track is dark enough for 3:1 non-text contrast.
          className="h-[26px] w-[44px] data-unchecked:bg-[#868c98] [&>span]:size-5 [&>span]:data-checked:translate-x-[18px]"
        />
      </div>
      <FormError message={error} />
    </div>
  );
}

const initialDeleteState: DeleteAccountState = { status: "idle" };

function DeleteAccountDialog({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState(deleteAccount, initialDeleteState);
  const [confirm, setConfirm] = useState("");
  const error = state.status === "error" ? state.message : null;

  return (
    <AlertDialog onOpenChange={(open) => !open && setConfirm("")}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled}>
          Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="flex flex-col gap-5">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your profile, projects, slides, scripts, rehearsals and
              recordings. You&apos;ll be signed out on every device. This can&apos;t be undone, so
              download your data first if you want a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-confirm" className="text-sm font-semibold">
              Type {DELETE_CONFIRM_PHRASE} to confirm
            </Label>
            <Input
              id="delete-confirm"
              name="confirm"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "delete-error" : undefined}
            />
            <FormError id="delete-error" message={error} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Keep my account
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || confirm.trim() !== DELETE_CONFIRM_PHRASE}
            >
              {pending ? "Deleting…" : "Delete account"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
