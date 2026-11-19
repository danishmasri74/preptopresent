import { Button } from "@/components/ui/button";

// Phase 0 placeholder: proves tokens, fonts and components render.
// Replaced by the real landing / dashboard in Phase 1.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-semibold text-muted-foreground">PrepToPresent · scaffold</p>
      <h1 className="text-4xl font-extrabold">Walk in prepared. Walk out proud.</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">
        Practise your presentation privately and get honest feedback on your voice, body language
        and content.
      </p>
      <div className="flex gap-3">
        <Button size="lg">Get started</Button>
        <Button size="lg" variant="outline">
          Sign in
        </Button>
      </div>
      <p className="w-fit rounded-full bg-attention-soft px-3 py-1 text-sm font-semibold text-attention-foreground">
        Phase 0: nothing here is wired up yet
      </p>
    </main>
  );
}
