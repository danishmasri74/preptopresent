import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireUser();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="px-10 py-4">
        <Link
          href="/projects"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
        >
          <span aria-hidden="true">←</span> Projects
        </Link>
      </header>
      <main className="flex-1 px-10 pt-2 pb-14">
        <div className="mx-auto flex max-w-[640px] flex-col gap-8">
          <h1 className="text-[32px] font-bold">New project</h1>
          <NewProjectForm />
        </div>
      </main>
    </div>
  );
}
