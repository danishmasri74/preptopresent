import { cn } from "@/lib/utils";

export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="rounded-xl bg-attention-soft px-4 py-3 text-sm font-medium text-attention-foreground"
    >
      {message}
    </p>
  );
}

/** Pill-shaped choice wrapping a real checkbox or radio (keyboard and screen-reader friendly). */
export function ChoicePill({
  className,
  children,
  ...input
}: React.ComponentProps<"input"> & { children: React.ReactNode }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-input bg-card px-4 text-sm font-medium transition-colors select-none",
        "hover:border-primary/60 has-checked:border-primary has-checked:bg-accent has-checked:font-semibold has-checked:text-accent-foreground",
        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        className,
      )}
    >
      <input className="sr-only" {...input} />
      {children}
    </label>
  );
}
