import type { SupabaseClient } from "@supabase/supabase-js";

export function extractJobSuffixFromEmail(
  toAddress: string,
  subject?: string,
): string | null {
  // Primary: check To address
  const toMatch = toAddress.match(
    /apply\.kharta\+job([a-z0-9]+)@gmail\.com/i,
  );
  if (toMatch?.[1]) return toMatch[1];

  // Fallback: check if subject contains the job suffix
  // (for email clients that normalise the To address)
  if (subject) {
    const subjectMatch = subject.match(/job([a-z0-9]{6,})/i);
    if (subjectMatch?.[1]) return subjectMatch[1];
  }

  return null;
}

export async function resolveJobFromSuffix(
  suffix: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const email = `apply.kharta+job${suffix}@gmail.com`;
  const { data } = await supabase
    .from("role_briefs")
    .select("id")
    .eq("inbound_email", email)
    .eq("inbound_email_active", true)
    .single();
  return data?.id != null ? String(data.id) : null;
}
