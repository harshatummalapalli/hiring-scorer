import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import type { CandidateRoleFitScore } from "@/types/candidate";
import type { CandidateScoreResult } from "@/types/score";
import type { PipelineCandidateRow } from "@/types/pipeline";
import type { CandidateSignalProfile } from "@/types/candidate";

export type PublicShortlistCandidate = {
  pipeline: PipelineCandidateRow;
  score: CandidateRoleFitScore | null;
  currentTitle: string | null;
  yearsExperience: string | null;
  location: string | null;
};

export type PublicShortlistData = {
  companyName: string | null;
  jobTitle: string;
  preparedAt: string;
  candidates: PublicShortlistCandidate[];
};

export async function loadPublicShortlist(
  token: string,
): Promise<PublicShortlistData | null> {
  const supabase = createSupabaseAdminClient();

  const { data: brief, error: briefError } = await supabase
    .from("role_briefs")
    .select("id, title, company_name, client_company_name, share_enabled")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();

  if (briefError || !brief) return null;

  const jobId = String(brief.id);

  const { data: pipelineRows, error: pipeError } = await supabase
    .from("pipeline_candidates")
    .select("*")
    .eq("role_brief_id", jobId)
    .order("added_at", { ascending: false });

  if (pipeError) return null;

  const candidates: PublicShortlistCandidate[] = [];

  for (const row of pipelineRows ?? []) {
    const r = row as Record<string, unknown>;
    const candidateId = String(r.candidate_id);

    const { data: cand } = await supabase
      .from("candidates")
      .select("signal_profile, application_location")
      .eq("id", candidateId)
      .maybeSingle();

    const profile = (cand?.signal_profile ??
      null) as CandidateSignalProfile | null;

    const { data: scoreRow } = await supabase
      .from("saved_scores")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("role_brief_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let fitScore: CandidateRoleFitScore | null = null;
    if (scoreRow) {
      const s = scoreRow as Record<string, unknown>;
      const overall = Number(s.overall_score ?? 0);
      fitScore = {
        id: String(s.id),
        role_brief_id: jobId,
        role_brief_title: String(brief.title ?? ""),
        overall_score: overall,
        verdict: scoreToVerdict(overall),
        created_at: String(s.created_at),
        score_snapshot: (s.score_snapshot as CandidateScoreResult) ?? null,
        role_brief_snapshot: s.role_brief_snapshot,
      };
    }

    const pipeline: PipelineCandidateRow = {
      id: String(r.id),
      role_brief_id: jobId,
      candidate_id: candidateId,
      candidate_name: String(r.candidate_name ?? "Candidate"),
      email: r.email != null ? String(r.email) : null,
      phone: r.phone != null ? String(r.phone) : null,
      location: r.location != null ? String(r.location) : null,
      fit_score: r.fit_score != null ? Number(r.fit_score) : null,
      fit_verdict: r.fit_verdict != null ? String(r.fit_verdict) : null,
      insights:
        typeof r.insights === "object" && r.insights !== null
          ? (r.insights as PipelineCandidateRow["insights"])
          : { signals: [] },
      relocation: r.relocation != null ? String(r.relocation) : null,
      present_salary:
        r.present_salary != null ? String(r.present_salary) : null,
      expected_salary:
        r.expected_salary != null ? String(r.expected_salary) : null,
      recruiter_notes:
        r.recruiter_notes != null ? String(r.recruiter_notes) : null,
      added_at: String(r.added_at ?? new Date().toISOString()),
      created_by: r.created_by != null ? String(r.created_by) : null,
    };

    candidates.push({
      pipeline,
      score: fitScore,
      currentTitle: profile?.current_title?.trim() || null,
      yearsExperience: profile?.total_years_experience?.trim() || null,
      location:
        pipeline.location?.trim() ||
        cand?.application_location?.trim() ||
        profile?.location?.trim() ||
        null,
    });
  }

  return {
    companyName:
      brief.company_name != null
        ? String(brief.company_name)
        : brief.client_company_name != null
          ? String(brief.client_company_name)
          : null,
    jobTitle: String(brief.title ?? "Role"),
    preparedAt: new Date().toISOString(),
    candidates,
  };
}
