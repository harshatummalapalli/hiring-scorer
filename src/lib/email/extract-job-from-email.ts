import type { SupabaseClient } from "@supabase/supabase-js";

export function extractJobSuffixFromEmail(toAddress: string): string | null {
  const match = toAddress.match(
    /apply\.kharta\+job([a-z0-9]+)@gmail\.com/i,
  );
  return match?.[1] ?? null;
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
