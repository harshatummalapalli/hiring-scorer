import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

let adminClient: SupabaseClient | null = null;

/** Service-role client for trusted server routes (e.g. public job applications). Bypasses RLS. */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();
  if (!url.startsWith("https://") || !key.trim()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for server-side application submissions.",
    );
  }
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
