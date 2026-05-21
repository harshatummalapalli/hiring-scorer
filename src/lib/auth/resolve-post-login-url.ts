import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSuperAdminUser } from "@/lib/auth/super-admin";
import {
  onboardingLandingUrl,
  safeIntendedPath,
} from "@/lib/auth/post-login-redirect";
import {
  getWorkspaceProfileRow,
  needsOnboarding,
} from "@/lib/workspace/workspace-profiles";

/** Where to send the user immediately after a successful sign-in. */
export async function resolvePostLoginUrl(
  supabase: SupabaseClient,
  user: User,
  intended?: string | null,
): Promise<string> {
  const fallback = safeIntendedPath(intended) ?? "/jobs";

  if (await isSuperAdminUser(supabase, user)) {
    return fallback;
  }

  let profile = null;
  try {
    profile = await getWorkspaceProfileRow(supabase, user.id);
  } catch {
    profile = null;
  }

  if (needsOnboarding(profile)) {
    return onboardingLandingUrl(fallback);
  }

  return fallback;
}
