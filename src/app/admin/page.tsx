/*
 * Super admin access
 * ------------------
 * Grant super admin via SUPER_ADMIN_EMAILS (server) or profiles.is_super_admin.
 *
 * Cost dashboard env (see src/lib/admin/required-env.ts):
 *   OPENAI_ADMIN_KEY — OpenAI admin key with usage read access
 *   ANTHROPIC_ADMIN_KEY — Anthropic API key (same as ANTHROPIC_API_KEY)
 */

import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import {
  getServerSuperAdminEmails,
  isSuperAdminEmail,
} from "@/lib/admin/super-admin-emails";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const adminEmails = getServerSuperAdminEmails();
  if (isSuperAdminEmail(user.email, adminEmails)) {
    return <AdminDashboard />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_super_admin) {
    return <AdminDashboard />;
  }

  redirect("/jobs");
}
