import type { CandidateScoringStatus } from "@/types/job";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";

export function scoringStatusFromOverall(
  overallScore: number,
): CandidateScoringStatus {
  const verdict = scoreToVerdict(overallScore);
  if (verdict === "NOT SUITABLE" || verdict === "WEAK FIT") {
    return "low_relevance";
  }
  return "scored";
}
