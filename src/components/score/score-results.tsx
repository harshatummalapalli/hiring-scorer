"use client";

import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";
import { CandidateScoreCard } from "./candidate-score-card";

type ScoreResultsProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
  candidateFilename?: string;
};

/** @deprecated Use CandidateScoreCard directly. Kept for saved-score modal. */
export function ScoreResults({
  result,
  roleBrief,
  candidateFilename = "candidate.pdf",
}: ScoreResultsProps) {
  return (
    <CandidateScoreCard
      result={result}
      roleBrief={roleBrief}
      candidateFilename={candidateFilename}
    />
  );
}
