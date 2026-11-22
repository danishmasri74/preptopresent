import { redirect } from "next/navigation";

// proxy.ts sends "/" to /home (signed in) or /sign-in before this renders.
// This static fallback only applies if the proxy is bypassed.
export default function Root() {
  redirect("/sign-in");
}
