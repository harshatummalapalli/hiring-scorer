import { hasEvaluatedScoreForRole } from "@/lib/candidates/list-filters";
import type { CandidateListItem } from "@/types/candidate";

export const STUCK_PROCESSING_MS = 300_000;

export function candidateProcessingAgeMs(
  candidate: Pick<CandidateListItem, "updated_at" | "created_at" | "applied_at">,
): number {
  const stamp =
    candidate.updated_at ?? candidate.applied_at ?? candidate.created_at;
  return Date.now() - new Date(stamp).getTime();
}

export function hasRetryableIngestionFailure(
  candidate: Pick<
    CandidateListItem,
    | "ingestion_job_status"
    | "ingestion_attempts"
    | "ingestion_max_attempts"
  >,
): boolean {
  return (
    candidate.ingestion_job_status === "failed" &&
    (candidate.ingestion_attempts ?? 0) <
      (candidate.ingestion_max_attempts ?? 3)
  );
}

export function isStuckCandidate(
  candidate: CandidateListItem,
  jobId?: string,
): boolean {
  if (hasRetryableIngestionFailure(candidate)) {
    return true;
  }

  if (candidateProcessingAgeMs(candidate) <= STUCK_PROCESSING_MS) {
    return false;
  }

  if (
    candidate.parsing_status === "pending" ||
    (candidate.parsing_status as string) === "parsing"
  ) {
    return true;
  }

  const scoring = candidate.scoring_status as string;
  if (scoring === "evaluating") return true;

  if (
    jobId &&
    candidate.parsing_status === "complete" &&
    (candidate.scoring_status === "unscored" ||
      candidate.scoring_status === "needs_scoring") &&
    !hasEvaluatedScoreForRole(candidate, jobId)
  ) {
    return true;
  }

  return false;
}
