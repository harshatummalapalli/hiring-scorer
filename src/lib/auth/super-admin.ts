import type { SupabaseClient } from "@supabase/supabase-js";

/** Matches workspace unlimited / super-admin email allowlist in limits.ts */
const SUPER_ADMIN_EMAILS = new Set(["recruiter.harsha@gmail.com"]);

export function isHardcodedSuperAdminEmail(
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase();
  return normalized ? SUPER_ADMIN_EMAILS.has(normalized) : false;
}

/** Super admins skip onboarding and workspace caps. */
export async function isSuperAdminUser(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<boolean> {
  if (isHardcodedSuperAdminEmail(user.email)) return true;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) {
      return false;
    }
    return false;
  }

  return data?.is_super_admin === true;
}
