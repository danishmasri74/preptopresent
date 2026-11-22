"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELDS_OF_STUDY, GOALS, type FormState } from "@/lib/onboarding";
import { saveAbout } from "../actions";
import { ChoicePill, FormError } from "../_components";

type Defaults = {
  display_name: string;
  university: string;
  field_of_study: string;
  goals: string[];
};

const selectClass =
  "h-12 w-full rounded-xl border border-input bg-card px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AboutForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAbout, {
    status: "idle",
  });

  return (
    <form action={action} className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name" className="font-semibold">
          What should we call you?
        </Label>
        <Input
          id="display_name"
          name="display_name"
          autoComplete="given-name"
          required
          maxLength={80}
          defaultValue={defaults.display_name}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="university" className="font-semibold">
            University <span className="font-normal text-muted-foreground">· optional</span>
          </Label>
          <Input
            id="university"
            name="university"
            autoComplete="organization"
            maxLength={160}
            defaultValue={defaults.university}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="field_of_study" className="font-semibold">
            Field of study
          </Label>
          <select
            id="field_of_study"
            name="field_of_study"
            required
            defaultValue={defaults.field_of_study}
            className={selectClass}
          >
            <option value="" disabled>
              Choose…
            </option>
            {FIELDS_OF_STUDY.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">
          What do you most want help with?{" "}
          <span className="font-normal text-muted-foreground">Pick any</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <ChoicePill
              key={g.id}
              type="checkbox"
              name="goals"
              value={g.id}
              defaultChecked={defaults.goals.includes(g.id)}
            >
              {g.label}
            </ChoicePill>
          ))}
        </div>
      </fieldset>

      <FormError message={state.status === "error" ? state.message : null} />

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
