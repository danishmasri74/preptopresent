export const DEFAULT_AFTER_SIGN_IN = "/home";

/**
 * Returns a safe in-app path to redirect to after sign-in.
 * Only same-origin relative paths are allowed, which prevents open-redirect attacks
 * (e.g. `?next=https://evil.example` or `?next=//evil.example`).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_AFTER_SIGN_IN;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  if (/[\u0000-\u001f]/.test(next)) return DEFAULT_AFTER_SIGN_IN;
  return next;
}

/** Routes that require a signed-in user. */
export const PROTECTED_PREFIXES = ["/home", "/onboarding", "/projects", "/history", "/settings"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
