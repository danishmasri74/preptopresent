import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function OnboardingHeader({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <header className="flex items-center justify-between px-10 py-5">
      <Logo />
      <div className="flex items-center gap-2.5">
        <span className="text-sm text-muted-foreground">
          Step {step} of {total}
        </span>
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn("h-1 w-8 rounded-full", i < step ? "bg-primary" : "bg-input")}
            />
          ))}
        </span>
      </div>
    </header>
  );
}

export { ChoicePill, FormError } from "@/components/form";
