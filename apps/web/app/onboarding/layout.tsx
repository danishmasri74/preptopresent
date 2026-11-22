// Layouts sit outside the segment's loading.tsx boundary, so they must not read the session.
// Each onboarding page calls requireOnboarding() instead.
export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
