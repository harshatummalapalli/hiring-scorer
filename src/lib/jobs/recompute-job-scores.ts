import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { scoringStatusFromOverall } from "@/lib/jobs/scoring-status";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import {
  recomputeOverallFromSnapshot,
  type RoleBriefWeights,
} from "@/lib/scoring/recompute-from-snapshot";
import type { CandidateScoreResult } from "@/types/score";
import type { DimensionKey } from "@/types/score";

function dimensionScoresFromSnapshot(
  snapshot: CandidateScoreResult | null,
): Record<string, { score: number }> | null {
  if (!snapshot?.dimension_scores) return null;
  const out: Record<string, { score: number }> = {};
  const keys: DimensionKey[] = [
    "skills",
    "trajectory",
    "domain",
    "seniority",
    "tenure",
  ];
  for (const key of keys) {
    const row = snapshot.dimension_scores[key];
    if (row && typeof row.score === "number") {
      out[key] = { score: row.score };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function recomputeSavedScoresForJob(
  roleBriefId: string,
  weights: RoleBriefWeights,
): Promise<{ updatedCount: number }> {
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase
    .from("saved_scores")
    .select("id, candidate_id, overall_score, score_snapshot")
    .eq("role_brief_id", roleBriefId);

  if (error) throw new Error(error.message);
  if (!rows?.length) return { updatedCount: 0 };

  let updatedCount = 0;

  for (const row of rows) {
    const snapshot = row.score_snapshot as CandidateScoreResult | null;
    const dims = dimensionScoresFromSnapshot(snapshot);
    if (!dims) continue;

    const overall = recomputeOverallFromSnapshot(dims, weights);

    const { error: updateError } = await supabase
      .from("saved_scores")
      .update({ overall_score: overall })
      .eq("id", String(row.id));

    if (updateError) throw new Error(updateError.message);
    updatedCount += 1;

    const candidateId =
      row.candidate_id != null ? String(row.candidate_id) : null;
    if (candidateId) {
      const status = scoringStatusFromOverall(overall);
      await supabase
        .from("candidates")
        .update({ scoring_status: status })
        .eq("id", candidateId);

      const verdict = scoreToVerdict(overall);
      await supabase
        .from("pipeline_candidates")
        .update({
          fit_score: overall,
          fit_verdict: verdict,
        })
        .eq("role_brief_id", roleBriefId)
        .eq("candidate_id", candidateId);
    }
  }

  return { updatedCount };
}
