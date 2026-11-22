import { cn } from "@/lib/utils";

type LogoProps = {
  inverted?: boolean;
  className?: string;
};

/** PrepToPresent wordmark. `inverted` for dark backgrounds. */
export function Logo({ inverted = false, className }: LogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill={inverted ? "#ffffff" : "#3846c4"} />
        <path
          d="M9 20V8h6a4 4 0 0 1 0 8H9"
          fill="none"
          stroke={inverted ? "#1e2a78" : "#ffffff"}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="20" r="1.8" fill="#f2a65a" />
      </svg>
      <span className="font-heading text-lg font-extrabold">PrepToPresent</span>
    </span>
  );
}
