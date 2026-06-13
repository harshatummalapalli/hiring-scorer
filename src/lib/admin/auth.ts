import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { hasUnlimitedWorkspaceEmail } from "@/lib/workspace/limits";

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  if (hasUnlimitedWorkspaceEmail(user.email)) return true;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return false;
  return data?.is_super_admin === true;
}

/** Returns the signed-in super admin user id, or triggers a 404 page. */
export async function requireSuperAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  if (hasUnlimitedWorkspaceEmail(user.email)) return user.id;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data?.is_super_admin) notFound();
  return user.id;
}
