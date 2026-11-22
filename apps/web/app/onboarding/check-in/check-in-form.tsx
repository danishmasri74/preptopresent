"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { BASELINE_QUESTIONS, type FormState } from "@/lib/onboarding";
import { saveCheckIn } from "../actions";
import { ChoicePill, FormError } from "../_components";

export function CheckInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCheckIn, {
    status: "idle",
  });

  return (
    <form action={action} className="flex flex-col gap-6">
      <p className="text-right text-xs text-muted-foreground">1 = not at all · 5 = very much</p>
      <div>
        {BASELINE_QUESTIONS.map((q, i) => (
          <fieldset key={q} className="flex flex-col gap-3 border-t border-border py-5">
            <legend className="float-left mb-3 w-full text-[15px] font-semibold">{q}</legend>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <ChoicePill
                  key={n}
                  type="radio"
                  name={`q${i}`}
                  value={n}
                  required
                  className="rounded-xl"
                  aria-label={`${n} of 5`}
                >
                  {n}
                </ChoicePill>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <FormError message={state.status === "error" ? state.message : null} />

      <div className="flex items-center justify-between">
        <Link
          href="/onboarding/about"
          className="flex min-h-11 items-center font-semibold text-primary"
        >
          Back
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
