/**
 * After sign-in, every client navigates to /onboarding first so the gate cannot be
 * skipped (client-side router.replace("/jobs") does not reliably re-run middleware).
 */

/** Same-origin relative path only; blocks open redirects and auth loops. */
export function safeIntendedPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (s.includes("://")) return null;
  if (s.length > 512 || /[<>"`]/.test(s)) return null;

  const pathOnly = s.split("?")[0] ?? "";
  if (pathOnly.startsWith("/auth")) return null;
  if (pathOnly.startsWith("/api")) return null;
  if (pathOnly === "/onboarding" || pathOnly === "/login") return null;

  return s;
}

/** Build /onboarding URL, preserving a safe post-onboarding destination. */
export function onboardingLandingUrl(intended: string | null | undefined): string {
  const safe = safeIntendedPath(intended);
  if (safe) return `/onboarding?next=${encodeURIComponent(safe)}`;
  return "/onboarding";
}

/**
 * Full page navigation so Supabase session cookies are on the next request.
 * Client router.replace() often runs before cookies are visible to middleware/RSC.
 */
export function navigateAfterAuth(url: string): void {
  if (typeof window !== "undefined") {
    window.location.assign(url);
  }
}

/** Full-page handoff so the server reads session cookies before routing. */
export function authFinishUrl(intended?: string | null): string {
  const safe = safeIntendedPath(intended) ?? "/jobs";
  return `/auth/finish?intended=${encodeURIComponent(safe)}`;
}
