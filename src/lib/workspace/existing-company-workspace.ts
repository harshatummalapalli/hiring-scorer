import type { SupabaseClient } from "@supabase/supabase-js";
import { extractCompanyName } from "@/lib/auth/email-domains";

export type ExistingCompanyWorkspace = {
  company_name: string;
};

export async function findExistingCompanyWorkspace(
  supabase: SupabaseClient,
  domain: string,
  excludeUserId: string,
): Promise<ExistingCompanyWorkspace | null> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("workspace_settings")
    .select("user_id, company_name")
    .eq("company_domain", normalized)
    .neq("user_id", excludeUserId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const companyName =
    (data.company_name as string | null)?.trim() ||
    extractCompanyName(`user@${normalized}`) ||
    normalized;

  return { company_name: companyName };
}

export function existingCompanySignupMessage(
  companyName: string,
): string {
  return `It looks like ${companyName} already uses Kharta. Contact your admin to join the existing workspace, or continue with your own workspace.`;
}
