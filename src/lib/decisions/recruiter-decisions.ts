import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import { buildProfileSkillHaystack } from "@/lib/recommendations/local-recommendation";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";

export type RecruiterDecisionType =
  | "shortlisted"
  | "skipped"
  | "manually_rejected"
  | "scored";

/**
 * Persists recruiter decisions for the learning intelligence layer.
 * This table will be used to train the recommendation engine on recruiter
 * preferences over time (which profiles get shortlisted, skipped, or rejected).
 */
export async function recordRecruiterDecision(input: {
  candidateId: string;
  jobId?: string | null;
  decisionType: RecruiterDecisionType;
  reasonCategory?: string | null;
  reasonDetail?: string | null;
  candidateProfile?: CandidateSignalProfile | null;
  roleBrief?: RoleBrief | null;
}): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const userId = await getAuthenticatedUserId(supabase);

    const workspaceId = userId;

    const { error } = await supabase.from("recruiter_decisions").insert({
      workspace_id: workspaceId,
      user_id: userId,
      candidate_id: input.candidateId,
      job_id: input.jobId ?? null,
      decision_type: input.decisionType,
      reason_category: input.reasonCategory?.trim() || null,
      reason_detail: input.reasonDetail?.trim() || null,
      candidate_signal_snapshot: input.candidateProfile
        ? buildCandidateSignalSnapshot(input.candidateProfile)
        : null,
      job_signal_snapshot: input.roleBrief
        ? buildJobSignalSnapshot(input.roleBrief)
        : null,
    });

    if (error && !error.message?.includes("does not exist")) {
      console.warn("[recruiter_decisions]", error.message);
    }
  } catch {
    // Non-blocking: decision logging must not break primary workflows.
  }
}

export function buildCandidateSignalSnapshot(
  profile: CandidateSignalProfile,
): Record<string, unknown> {
  const skills = [
    ...(profile.skills_verified ?? []).map((v) => v.skill).filter(Boolean),
    ...(profile.skills_listed_only ?? []),
  ].slice(0, 12);

  return {
    core_strength_primary: profile.core_strength_primary,
    core_strength_secondary: profile.core_strength_secondary,
    title_band: profile.title_band,
    total_years_experience: profile.total_years_experience,
    top_skills: skills,
    skills_haystack: buildProfileSkillHaystack(profile).slice(0, 2000),
  };
}

export function buildJobSignalSnapshot(roleBrief: RoleBrief): Record<string, unknown> {
  return {
    title: roleBrief.title,
    title_band: roleBrief.title_band,
    deal_breakers: roleBrief.deal_breakers ?? [],
    core_signals: (roleBrief.core_signals ?? []).map((s) => s.skill),
    preferred_signals: roleBrief.preferred_signals ?? [],
  };
}
