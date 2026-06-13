import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import {
  getServerSuperAdminEmails,
  isSuperAdminEmail,
} from "@/lib/admin/super-admin-emails";

async function userIsSuperAdmin(
  user: { id: string; email?: string | null },
): Promise<boolean> {
  if (isSuperAdminEmail(user.email, getServerSuperAdminEmails())) {
    return true;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return false;
  return data?.is_super_admin === true;
}

export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return userIsSuperAdmin(user);
}

/** Redirects unauthenticated or non-admin users; returns admin user id. */
export async function requireSuperAdmin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  if (await userIsSuperAdmin(user)) return user.id;

  redirect("/jobs");
}
