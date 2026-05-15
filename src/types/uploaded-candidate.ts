import type { CandidateScoreResult } from "./score";

export type UploadedCandidate = {
  id: string;
  file: File;
  /** Raw text extracted from the file (never sent to AI). */
  resumeTextRaw: string;
  /** PII-stripped text sent to the scoring API. */
  resumeText: string;
  status: "parsing" | "ready" | "scoring" | "scored" | "error";
  result?: CandidateScoreResult;
  error?: string;
  savedId?: string;
};

export function createCandidateId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
