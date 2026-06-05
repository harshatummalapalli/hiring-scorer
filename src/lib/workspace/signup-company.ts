import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractCompanyDomain,
  extractCompanyName,
} from "@/lib/auth/email-domains";

export type SignupEmailType = "corporate" | "personal";

export type SignupCompanyMetadata = {
  company_domain: string | null;
  company_name: string | null;
  signup_email_type: SignupEmailType;
};

export function signupCompanyMetadataFromEmail(
  email: string,
): SignupCompanyMetadata {
  const domain = extractCompanyDomain(email);
  const companyName = extractCompanyName(email);
  return {
    company_domain: domain,
    company_name: companyName,
    signup_email_type: domain ? "corporate" : "personal",
  };
}

export async function applySignupCompanyMetadata(
  supabase: SupabaseClient,
  userId: string,
  email: string,
): Promise<SignupCompanyMetadata> {
  const meta = signupCompanyMetadataFromEmail(email.trim());

  const { error } = await supabase
    .from("workspace_settings")
    .update({
      company_domain: meta.company_domain,
      company_name: meta.company_name,
      signup_email_type: meta.signup_email_type,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return meta;
}
