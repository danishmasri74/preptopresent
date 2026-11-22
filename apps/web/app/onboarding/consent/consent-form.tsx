"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/onboarding";
import { saveConsent } from "../actions";
import { FormError } from "../_components";

const items = [
  {
    name: "analysis",
    label: "I agree to camera and microphone analysis as described above.",
    required: true,
  },
  { name: "age_18_plus", label: "I am 18 or older.", required: true },
  { name: "save_video_default", label: "Save my rehearsal videos by default.", required: false },
  {
    name: "study_participation",
    label: "Use my anonymised scores in the PrepToPresent evaluation study.",
    required: false,
  },
] as const;

export function ConsentForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(saveConsent, {
    status: "idle",
  });

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <label
            key={item.name}
            className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-sm leading-relaxed"
          >
            <input
              type="checkbox"
              name={item.name}
              required={item.required}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              {item.label}{" "}
              <span className="text-muted-foreground">
                {item.required ? "Required" : "Optional"}
              </span>
            </span>
          </label>
        ))}
      </div>

      <FormError message={state.status === "error" ? state.message : null} />

      <div className="flex items-center justify-between">
        <Link
          href="/onboarding/check-in"
          className="flex min-h-11 items-center font-semibold text-primary"
        >
          Back
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Agree and continue"}
        </Button>
      </div>
    </form>
  );
}
