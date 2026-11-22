import Link from "next/link";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/history", label: "History" },
] as const;

type Props = {
  active: (typeof NAV)[number]["href"];
  displayName: string | null;
  children: React.ReactNode;
};

/** Signed-in layout: left navigation + main content (matches the canvas). */
export function AppShell({ active, displayName, children }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-wrap">
      <aside className="flex max-w-[220px] flex-[1_1_200px] flex-col gap-8 px-4 py-7">
        <Link href="/home" className="px-2.5" aria-label="PrepToPresent home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.href === active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-[10px] px-3.5 font-medium text-[#3a3f48] hover:bg-[#ececE8] hover:text-foreground",
                item.href === active &&
                  "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(20,20,30,0.06)] hover:bg-card",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link
            href="/settings"
            className="flex min-h-11 items-center rounded-[10px] px-3.5 font-medium text-[#3a3f48] hover:bg-[#ececE8]"
          >
            {displayName ? `${displayName} · Settings` : "Settings"}
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center rounded-[10px] px-3.5 text-left font-medium text-muted-foreground hover:bg-[#ececE8] hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-[999_1_560px] px-12 py-12">{children}</main>
    </div>
  );
}
