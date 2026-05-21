import type { CandidateScoringStatus } from "@/types/job";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";

/** Status after a completed AI score. Weak fits go to Unlikely; others to Assessed. */
export function scoringStatusFromOverall(
  overallScore: number,
): CandidateScoringStatus {
  const verdict = scoreToVerdict(overallScore);
  if (verdict === "NOT A MATCH" || verdict === "WEAK MATCH") {
    return "low_relevance";
  }
  return "scored";
}

/** True when recruiter has already run AI scoring — do not reset via prefilter. */
export function isPostScoreStatus(status: string | null | undefined): boolean {
  return (
    status === "scored" ||
    status === "needs_scoring" ||
    status === "low_relevance" ||
    status === "skipped" ||
    status === "manually_rejected"
  );
}
