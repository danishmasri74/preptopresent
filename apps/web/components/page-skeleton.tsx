/** Loading placeholder shown while a signed-in page reads the session (Suspense fallback). */
export function PageSkeleton({ withNav = true }: { withNav?: boolean }) {
  return (
    <div className="flex min-h-full flex-1 flex-wrap" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {withNav ? (
        <div
          className="flex max-w-[220px] flex-[1_1_200px] flex-col gap-4 px-4 py-7"
          aria-hidden="true"
        >
          <div className="mx-2.5 h-7 w-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div className="mt-6 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-[10px] bg-muted motion-reduce:animate-none"
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="min-w-0 flex-[999_1_560px] px-12 py-12" aria-hidden="true">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          <div className="mt-4 h-64 animate-pulse rounded-[20px] bg-muted motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
