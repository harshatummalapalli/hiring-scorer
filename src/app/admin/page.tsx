/*
 * Super admin access
 * ------------------
 * Grant super admin only via Supabase SQL Editor (never from the app UI):
 *
 *   update public.profiles
 *   set is_super_admin = true, updated_at = now()
 *   where id = (
 *     select id from auth.users where email = 'you@company.com' limit 1
 *   );
 *
 * Run supabase/admin-platform.sql first if profiles / activity_log do not exist.
 *
 * Cost dashboard env (see src/lib/admin/required-env.ts):
 *   OPENAI_ADMIN_KEY — OpenAI admin key with usage read access
 *   ANTHROPIC_ADMIN_KEY — Anthropic API key (same as ANTHROPIC_API_KEY)
 */

import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default function AdminPage() {
  return <AdminDashboard />;
}
