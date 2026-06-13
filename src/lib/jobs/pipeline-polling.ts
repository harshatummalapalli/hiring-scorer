import { hasEvaluatedScoreForRole } from "@/lib/candidates/list-filters";
import type { CandidateListItem } from "@/types/candidate";
import { isUnlikelyFitStatus } from "@/types/job";

export const PIPELINE_POLL_INTERVAL_MS = 2000;

/** Keep polling while parse or auto-score is still in flight. */
export function candidateNeedsPipelinePoll(
  candidate: CandidateListItem,
  jobId: string,
): boolean {
  if (hasEvaluatedScoreForRole(candidate, jobId)) return false;

  const parsing = candidate.parsing_status as string;
  if (parsing === "pending" || parsing === "parsing") return true;

  const scoring = candidate.scoring_status as string;
  if (scoring === "unscored" || scoring === "evaluating") return true;

  return false;
}

export function candidateIsPipelineTerminal(
  candidate: CandidateListItem,
  jobId: string,
): boolean {
  if (hasEvaluatedScoreForRole(candidate, jobId)) return true;

  const parsing = candidate.parsing_status as string;
  if (parsing !== "complete" && parsing !== "failed") return false;

  const scoring = candidate.scoring_status as string;
  return (
    scoring === "scored" ||
    scoring === "failed" ||
    scoring === "needs_scoring" ||
    scoring === "low_relevance" ||
    isUnlikelyFitStatus(scoring as CandidateListItem["scoring_status"])
  );
}

export function getPipelinePollIntervalMs(
  candidates: CandidateListItem[],
  jobId: string,
): number {
  if (candidates.length === 0) return PIPELINE_POLL_INTERVAL_MS;

  const hasEvaluating = candidates.some(
    (c) => (c.scoring_status as string) === "evaluating",
  );
  const allTerminal = candidates.every((c) =>
    candidateIsPipelineTerminal(c, jobId),
  );

  if (hasEvaluating) return 1000;
  if (allTerminal) return 5000;
  return PIPELINE_POLL_INTERVAL_MS;
}

export function countPipelineProgress(
  candidates: CandidateListItem[],
  jobId: string,
): { total: number; parsing: number; scoring: number; done: number } {
  const parsing = candidates.filter((c) =>
    ["pending", "parsing"].includes(c.parsing_status as string),
  ).length;

  const scoring = candidates.filter(
    (c) =>
      c.parsing_status === "complete" &&
      ["unscored", "evaluating"].includes(c.scoring_status as string) &&
      !hasEvaluatedScoreForRole(c, jobId),
  ).length;

  const done = candidates.filter(
    (c) =>
      c.parsing_status === "complete" &&
      (["scored", "needs_scoring"].includes(c.scoring_status as string) ||
        hasEvaluatedScoreForRole(c, jobId) ||
        isUnlikelyFitStatus(c.scoring_status)),
  ).length;

  return { total: candidates.length, parsing, scoring, done };
}
