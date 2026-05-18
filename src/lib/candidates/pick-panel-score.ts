import type { CandidateRoleFitScore } from "@/types/candidate";

export function scoresWithSnapshots(
  scores: CandidateRoleFitScore[],
): CandidateRoleFitScore[] {
  return scores
    .filter((f) => f.score_snapshot != null)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

/**
 * Priority 1: most recent saved score for this job (contextJobId).
 * Priority 2: most recent saved score across any job.
 */
export function pickDefaultScoreId(
  scores: CandidateRoleFitScore[],
  contextJobId?: string | null,
): string | null {
  const withSnap = scoresWithSnapshots(scores);
  if (contextJobId) {
    const forJob = withSnap.find((f) => f.role_brief_id === contextJobId);
    if (forJob) return forJob.id;
  }
  return withSnap[0]?.id ?? null;
}
