import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

// Fully static shell; only the form (which reads ?next and ?error) renders per request.
export default function SignInPage() {
  return (
    <div className="flex min-h-full flex-1 flex-wrap">
      <section className="flex min-w-0 flex-[1_1_520px] flex-col justify-between gap-10 bg-[#1e2a78] p-14 text-white">
        <Logo inverted />
        <div className="flex max-w-md flex-col gap-4">
          <h1 className="text-[44px] leading-[1.1] font-bold">Walk in prepared. Walk out proud.</h1>
          <p className="text-lg leading-relaxed text-[#d3d8ff]">
            Practise your presentation privately and get honest feedback on your voice, body
            language and content.
          </p>
        </div>
        <p className="text-sm text-[#aeb7ff]">
          Body tracking runs on your device. Your video stays yours.
        </p>
      </section>

      <section className="flex min-w-0 flex-[1_1_480px] items-center justify-center p-14">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <h2 className="text-[28px] font-bold">Sign in or create an account</h2>
          <Suspense fallback={<FormSkeleton />}>
            <SignInForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="h-5 w-12 rounded bg-muted" />
      <div className="h-12 rounded-xl bg-muted" />
      <div className="h-12 rounded-xl bg-muted" />
    </div>
  );
}
