import { createSupabaseClient } from "@/lib/supabase/client";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { RecommendationCandidateInput } from "./local-recommendation";

function hasUsableProfile(raw: unknown): raw is CandidateSignalProfile {
  if (!raw || typeof raw !== "object") return false;
  const p = raw as CandidateSignalProfile;
  return (
    Array.isArray(p.skills_verified) ||
    Array.isArray(p.skills_listed_only) ||
    Boolean(p.total_years_experience?.trim())
  );
}

export async function fetchCandidatesForRecommendations(): Promise<
  RecommendationCandidateInput[]
> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("candidates")
    .select("id, display_name, signal_profile")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) return [];
    throw new Error(error.message);
  }

  const out: RecommendationCandidateInput[] = [];
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const profile = r.signal_profile;
    if (!hasUsableProfile(profile)) continue;
    const name = String(r.display_name ?? "").trim() || "Candidate";
    out.push({
      id: String(r.id),
      display_name: name,
      signal_profile: profile,
    });
  }
  return out;
}
