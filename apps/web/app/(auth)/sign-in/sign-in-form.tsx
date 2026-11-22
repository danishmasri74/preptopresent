"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/auth/redirect";
import { sendSignInLink, type SignInState } from "./actions";

const initialState: SignInState = { status: "idle" };

export function SignInForm() {
  const params = useSearchParams();
  const rawNext = params.get("next");
  const next = rawNext ? safeNextPath(rawNext) : undefined;
  const linkError = params.get("error") === "link";
  const accountDeleted = params.get("deleted") === "1";
  const [state, formAction, pending] = useActionState(sendSignInLink, initialState);

  if (state.status === "sent") {
    const restart = next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
    return (
      <div className="flex flex-col gap-4" role="status">
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="leading-relaxed text-muted-foreground">
          We sent a sign-in link to <strong className="text-foreground">{state.email}</strong>. Open
          it on this device to continue. The link expires in an hour.
        </p>
        <p className="text-sm text-muted-foreground">
          Nothing arrived? Check your spam folder, or{" "}
          <a
            href={restart}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            use a different email
          </a>
          .
        </p>
      </div>
    );
  }

  const error =
    state.status === "error"
      ? state.message
      : linkError
        ? "That sign-in link has expired or was already used. Send yourself a new one."
        : null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {accountDeleted ? (
        <p role="status" className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
          Your account is being deleted. Your files and data will be removed within a few minutes.
        </p>
      ) : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-sm font-semibold">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@university.edu"
          required
          defaultValue={state.status === "error" ? state.email : undefined}
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={error ? "email-error" : undefined}
        />
        {error ? (
          <p
            id="email-error"
            role="alert"
            className="text-sm font-medium text-attention-foreground"
          >
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send me a sign-in link"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        No password needed. New here? The same link creates your account.
      </p>
    </form>
  );
}
