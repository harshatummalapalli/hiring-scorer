import type { SupabaseClient } from "@supabase/supabase-js";

const JOB_ADDRESS_RE = /apply\.kharta\+job([a-z0-9]+)@gmail\.com/i;
const JOB_SUBJECT_RE = /job([a-z0-9]{6,})/i;

function suffixFromText(text: string): string | null {
  const match = text.match(JOB_ADDRESS_RE);
  return match?.[1] ?? null;
}

/** Find job suffix from To/Delivered-To headers or subject line. */
export function extractJobSuffixFromEmail(
  addresses: string | string[],
  subject?: string,
): string | null {
  const hints = (Array.isArray(addresses) ? addresses : [addresses]).filter(
    Boolean,
  );
  for (const hint of hints) {
    const suffix = suffixFromText(hint);
    if (suffix) return suffix;
  }

  // Fallback: subject (some clients strip plus-addressing from To)
  if (subject) {
    const subjectMatch = subject.match(JOB_SUBJECT_RE);
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
