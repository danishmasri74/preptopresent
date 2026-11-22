import { AppShell } from "@/components/app-shell";
import { getProfile } from "@/lib/auth/session";

type Props = {
  active: "/home" | "/projects" | "/history";
  title: string;
  body: string;
};

/** Temporary page for areas whose slice hasn't been built yet. */
export async function ComingSoon({ active, title, body }: Props) {
  const { profile } = await getProfile();
  return (
    <AppShell active={active} displayName={profile.display_name}>
      <div className="mx-auto flex max-w-[720px] flex-col gap-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </AppShell>
  );
}
