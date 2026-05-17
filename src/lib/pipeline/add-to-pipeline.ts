import { getCandidateById } from "@/lib/supabase/candidates";
import {
  getPipelineEntry,
  insertPipelineCandidate,
} from "@/lib/supabase/pipeline";
import { extractContactFromResume } from "@/lib/pipeline/extract-contact";
import {
  insightsFromProfile,
  insightsFromScoreResult,
} from "@/lib/pipeline/insights-from-score";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import type { CandidateScoreResult } from "@/types/score";
import type { PipelineCandidateRow } from "@/types/pipeline";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";

async function loadScoreForRole(
  candidateId: string,
  roleBriefId: string,
): Promise<{
  overall_score: number;
  verdict: string;
  score_snapshot: CandidateScoreResult | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_scores")
    .select("overall_score, score_snapshot")
    .eq("candidate_id", candidateId)
    .eq("role_brief_id", roleBriefId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const score = Number(data.overall_score ?? 0);
  return {
    overall_score: score,
    verdict: scoreToVerdict(score),
    score_snapshot: (data.score_snapshot as CandidateScoreResult) ?? null,
  };
}

/** Latest score for this candidate on any role (talent-pool adds). */
async function loadLatestScoreAnyRole(
  candidateId: string,
): Promise<{
  overall_score: number;
  verdict: string;
  score_snapshot: CandidateScoreResult | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_scores")
    .select("overall_score, score_snapshot")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const score = Number(data.overall_score ?? 0);
  return {
    overall_score: score,
    verdict: scoreToVerdict(score),
    score_snapshot: (data.score_snapshot as CandidateScoreResult) ?? null,
  };
}

export async function addCandidateToPipeline(
  candidateId: string,
  roleBriefId: string,
): Promise<{ row: PipelineCandidateRow; created: boolean }> {
  const existing = await getPipelineEntry(roleBriefId, candidateId);
  if (existing) return { row: existing, created: false };

  const candidate = await getCandidateById(candidateId);
  if (!candidate) {
    throw new Error("Candidate not found.");
  }

  const scoreForRole = await loadScoreForRole(candidateId, roleBriefId);
  const score =
    scoreForRole ?? (await loadLatestScoreAnyRole(candidateId));
  const contact = extractContactFromResume(candidate.resume_text);
  const profile = candidate.signal_profile;

  const insights = score?.score_snapshot
    ? insightsFromScoreResult(score.score_snapshot)
    : insightsFromProfile(profile);

  const fit_score =
    score?.overall_score ??
    candidate.role_fit_scores.find((f) => f.role_brief_id === roleBriefId)
      ?.overall_score ??
    candidate.role_fit_scores[0]?.overall_score ??
    null;

  const fit_verdict =
    score?.verdict ??
    (fit_score != null ? scoreToVerdict(fit_score) : null);

  const row = await insertPipelineCandidate({
    role_brief_id: roleBriefId,
    candidate_id: candidateId,
    candidate_name: getCandidateHeaderName(profile),
    email: contact.email,
    phone: contact.phone,
    location: profile.location,
    fit_score: fit_score != null ? Math.round(fit_score) : null,
    fit_verdict,
    insights,
  });

  return { row, created: true };
}
